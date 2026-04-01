// ---------------------------------------------------------------------------
// Commit-Reveal Verification for Node Results
// ---------------------------------------------------------------------------
// Inspired by Hyperspace AGI's 7-step protocol, simplified to 3 steps:
//   1. Challenge — inject a hidden verification prompt into the request
//   2. Verify   — check the response contains the correct answer
//   3. Score    — update the node's reputation based on verification
//
// This ensures decentralised nodes actually performed the computation
// rather than returning garbage or cached/stale results.
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db';

// ── Types ────────────────────────────────────────────────────────────────

export interface VerificationChallenge {
  /** A simple math question, e.g. "What is 347 + 829?" */
  question: string;
  /** The correct answer as a string, e.g. "1176" */
  answer: string;
  /** Unique marker string the node must include in its response */
  marker: string;
}

export interface VerificationResult {
  passed: boolean;
  /** 0-1 confidence that the node performed real computation */
  confidence: number;
}

export interface VerificationStats {
  total: number;
  passed: number;
  rate: number;
}

// ── Constants ────────────────────────────────────────────────────────────

const MARKER_PREFIX = '__IL_VERIFY_';
const REPUTATION_PASS_BONUS = 0.25;
const REPUTATION_FAIL_PENALTY = 8;

// ── ResultVerifier ───────────────────────────────────────────────────────

class ResultVerifier {
  /**
   * Generate a random verification challenge.
   * Uses addition of two 3-digit numbers — trivial for any LLM,
   * impossible to guess without actually running inference.
   */
  generateChallenge(): VerificationChallenge {
    const a = Math.floor(Math.random() * 900) + 100; // 100-999
    const b = Math.floor(Math.random() * 900) + 100;
    const answer = String(a + b);
    const marker = `${MARKER_PREFIX}${Math.random().toString(36).slice(2, 10)}`;

    return {
      question: `What is ${a} + ${b}?`,
      answer,
      marker,
    };
  }

  /**
   * Inject a verification challenge into a request's messages array.
   * Appends a hidden system-level instruction asking the model to include
   * the answer at the end of its response, wrapped in the marker.
   *
   * Returns a new messages array (does not mutate the input).
   */
  injectChallenge<T extends { role: string; content: string }>(
    messages: T[],
    challenge: VerificationChallenge,
  ): T[] {
    const verificationInstruction = [
      `IMPORTANT: At the very end of your response, on a new line, include exactly this verification block:`,
      `${challenge.marker}_START`,
      `Answer to "${challenge.question}": [your answer]`,
      `${challenge.marker}_END`,
      `This is required for quality assurance. Do not omit this block.`,
    ].join('\n');

    // Find existing system message and append, or add a new one
    const cloned: T[] = messages.map((m) => ({ ...m }));
    const systemIdx = cloned.findIndex((m) => m.role === 'system');

    if (systemIdx >= 0) {
      cloned[systemIdx] = {
        ...cloned[systemIdx],
        content: `${cloned[systemIdx].content}\n\n${verificationInstruction}`,
      };
    } else {
      cloned.unshift({
        role: 'system',
        content: verificationInstruction,
      } as T);
    }

    return cloned;
  }

  /**
   * Verify that a node's response contains the correct verification answer.
   *
   * Checks for the marker block and extracts the answer. Returns a confidence
   * score based on how closely the answer matches.
   */
  verifyResponse(
    responseText: string,
    challenge: VerificationChallenge,
  ): VerificationResult {
    // Check if the marker block exists at all
    const startMarker = `${challenge.marker}_START`;
    const endMarker = `${challenge.marker}_END`;

    const startIdx = responseText.indexOf(startMarker);
    const endIdx = responseText.indexOf(endMarker);

    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      // Marker block not found — node may not have processed the system message
      // Try a looser check: does the response contain the answer number at all?
      if (responseText.includes(challenge.answer)) {
        return { passed: true, confidence: 0.5 };
      }
      return { passed: false, confidence: 0 };
    }

    // Extract the content between markers
    const block = responseText.slice(startIdx + startMarker.length, endIdx).trim();

    // Check if the correct answer appears in the block
    if (block.includes(challenge.answer)) {
      return { passed: true, confidence: 1.0 };
    }

    // The block exists but answer is wrong — the node ran inference
    // but may have computed incorrectly (low confidence pass)
    // Check if the answer is at least a plausible number
    const numberMatch = block.match(/\d+/);
    if (numberMatch) {
      // Node attempted the math — partial confidence
      return { passed: false, confidence: 0.3 };
    }

    return { passed: false, confidence: 0 };
  }

  /**
   * Update a node's reputation based on verification result.
   * Passes get a small bonus; failures get a significant penalty.
   */
  async updateReputation(nodeId: string, passed: boolean): Promise<void> {
    const delta = passed ? REPUTATION_PASS_BONUS : -REPUTATION_FAIL_PENALTY;

    try {
      const node = await prisma.nodeOperator.findUnique({
        where: { id: nodeId },
        select: { reputationScore: true },
      });

      if (!node) return;

      const newScore = Math.max(0, Math.min(100, node.reputationScore + delta));

      await prisma.nodeOperator.update({
        where: { id: nodeId },
        data: { reputationScore: newScore },
      });
    } catch (err) {
      console.error('[ResultVerifier] Failed to update reputation:', err);
    }
  }

  /**
   * Get verification stats for a node from its transaction history.
   * Uses the node's overall success/failure rate as a proxy since
   * individual verification results are reflected in reputation changes.
   */
  async getVerificationStats(nodeId: string): Promise<VerificationStats> {
    try {
      const node = await prisma.nodeOperator.findUnique({
        where: { id: nodeId },
        select: { totalRequests: true, failedRequests: true },
      });

      if (!node) {
        return { total: 0, passed: 0, rate: 0 };
      }

      const total = node.totalRequests;
      const passed = total - node.failedRequests;
      const rate = total > 0 ? passed / total : 0;

      return { total, passed, rate };
    } catch {
      return { total: 0, passed: 0, rate: 0 };
    }
  }

  /**
   * Strip the verification block from a response before returning to the user.
   * The user should never see the internal verification markers.
   */
  stripVerificationBlock(responseText: string, challenge: VerificationChallenge): string {
    const startMarker = `${challenge.marker}_START`;
    const endMarker = `${challenge.marker}_END`;

    const startIdx = responseText.indexOf(startMarker);
    const endIdx = responseText.indexOf(endMarker);

    if (startIdx === -1 || endIdx === -1) {
      return responseText;
    }

    // Remove the block and any surrounding whitespace
    const before = responseText.slice(0, startIdx).trimEnd();
    const after = responseText.slice(endIdx + endMarker.length).trimStart();

    return (before + (after ? '\n' + after : '')).trimEnd();
  }
}

// ── Singleton ────────────────────────────────────────────────────────────

export const resultVerifier = new ResultVerifier();
