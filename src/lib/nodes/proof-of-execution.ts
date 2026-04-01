// ---------------------------------------------------------------------------
// On-Chain Proof of Execution — Trustless Verification for Node Responses
// ---------------------------------------------------------------------------
// Inspired by Bittensor's proof-of-intelligence and Nosana's smart contract
// settlement. Provides a 4-tier verification system that builds an auditable
// proof chain for every OpenClaw node execution.
//
// Verification tiers:
//   1. Challenge-Response (30pts) — injected math problem via ResultVerifier
//   2. Model Fingerprinting (25pts) — vocabulary/style pattern matching
//   3. Cross-Node Consistency (25pts) — Jaccard similarity across nodes
//   4. Hardware Attestation (20pts) — latency vs claimed hardware check
// ---------------------------------------------------------------------------

import { createHash, randomUUID } from 'crypto';
import { resultVerifier, type VerificationChallenge } from './result-verifier';
import { prisma } from '@/lib/db';

// ── Types ────────────────────────────────────────────────────────────────

export interface ExecutionProof {
  proofId: string;
  nodeId: string;
  requestHash: string;
  responseHash: string;
  modelClaimed: string;
  timestamp: Date;
  latencyMs: number;
  tokensGenerated: number;

  // Verification fields
  challengeResponse?: string;
  fingerprintScore: number;
  consistencyScore: number;

  // Proof chain
  previousProofHash?: string;
  proofHash: string;
  signature?: string;
}

export interface VerificationResult {
  verified: boolean;
  confidence: number;
  method: 'challenge' | 'fingerprint' | 'consistency' | 'attestation';
  details: string;
  penaltyApplied: boolean;
  reputationDelta: number;
}

interface ModelFingerprint {
  model: string;
  avgSentenceLength: number;
  punctuationFrequency: number;
  commonOpeners: string[];
  vocabularyDistribution: Map<string, number>;
  sampleCount: number;
}

interface ConsistencyEntry {
  requestHash: string;
  nodeId: string;
  responseWords: Set<string>;
  timestamp: number;
}

// Expected latency ranges per hardware tier (ms per token)
interface HardwareLatencyProfile {
  minMsPerToken: number;
  maxMsPerToken: number;
}

const HARDWARE_PROFILES: Record<string, HardwareLatencyProfile> = {
  h100: { minMsPerToken: 1, maxMsPerToken: 15 },
  a100: { minMsPerToken: 3, maxMsPerToken: 25 },
  l40: { minMsPerToken: 5, maxMsPerToken: 35 },
  rtx4090: { minMsPerToken: 5, maxMsPerToken: 40 },
  rtx3090: { minMsPerToken: 8, maxMsPerToken: 60 },
  t4: { minMsPerToken: 15, maxMsPerToken: 100 },
  cpu: { minMsPerToken: 50, maxMsPerToken: 500 },
};

// Stopwords for Jaccard similarity
const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'each',
  'few', 'more', 'most', 'other', 'some', 'such', 'no', 'only', 'own',
  'same', 'than', 'too', 'very', 'just', 'because', 'if', 'when', 'where',
  'how', 'all', 'any', 'both', 'each', 'every', 'this', 'that', 'these',
  'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him',
  'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their', 'what',
  'which', 'who', 'whom',
]);

// Verification weights
const WEIGHT_CHALLENGE = 30;
const WEIGHT_FINGERPRINT = 25;
const WEIGHT_CONSISTENCY = 25;
const WEIGHT_ATTESTATION = 20;
const TOTAL_WEIGHT = WEIGHT_CHALLENGE + WEIGHT_FINGERPRINT + WEIGHT_CONSISTENCY + WEIGHT_ATTESTATION;

// Fingerprint training threshold
const FINGERPRINT_TRAINING_SIZE = 100;

// Consistency window (keep last 5 min of responses)
const CONSISTENCY_WINDOW_MS = 5 * 60 * 1000;

// ── Helpers ──────────────────────────────────────────────────────────────

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function extractWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOPWORDS.has(w)),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function computeSentenceLength(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length === 0) return 0;
  const totalWords = sentences.reduce(
    (sum, s) => sum + s.trim().split(/\s+/).length,
    0,
  );
  return totalWords / sentences.length;
}

function computePunctuationFrequency(text: string): number {
  const punctuation = text.match(/[.,;:!?'"()\-]/g);
  const words = text.split(/\s+/).length;
  return words > 0 ? (punctuation?.length ?? 0) / words : 0;
}

function extractOpeners(text: string): string[] {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  return sentences
    .slice(0, 5)
    .map((s) => {
      const words = s.trim().split(/\s+/).slice(0, 3);
      return words.join(' ').toLowerCase();
    });
}

function buildVocabularyDistribution(text: string): Map<string, number> {
  const dist = new Map<string, number>();
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
  const total = words.length || 1;
  for (const word of words) {
    if (word.length > 1 && !STOPWORDS.has(word)) {
      dist.set(word, (dist.get(word) ?? 0) + 1);
    }
  }
  // Normalize to frequencies
  for (const [k, v] of dist) {
    dist.set(k, v / total);
  }
  return dist;
}

function cosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>,
): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  const allKeys = new Set([...a.keys(), ...b.keys()]);

  for (const key of allKeys) {
    const va = a.get(key) ?? 0;
    const vb = b.get(key) ?? 0;
    dotProduct += va * vb;
    normA += va * va;
    normB += vb * vb;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator > 0 ? dotProduct / denominator : 0;
}

// ── ProofOfExecution ────────────────────────────────────────────────────

class ProofOfExecution {
  /** Per-node proof chains — last proof hash per node */
  private lastProofHashes = new Map<string, string>();

  /** Model fingerprint profiles built from verified responses */
  private fingerprints = new Map<string, ModelFingerprint>();

  /** Recent responses for cross-node consistency checks */
  private consistencyBuffer: ConsistencyEntry[] = [];

  /** In-memory proof store (recent proofs for API queries) */
  private proofStore: ExecutionProof[] = [];
  private readonly MAX_STORED_PROOFS = 10_000;

  // ── Create Proof ──────────────────────────────────────────────────────

  /**
   * Generate a proof after a node execution completes.
   * Runs all available verification methods and chains to previous proof.
   */
  createProof(
    nodeId: string,
    request: string,
    response: string,
    latencyMs: number,
    model: string,
    challengeResult?: { passed: boolean; confidence: number },
    tokensGenerated?: number,
  ): ExecutionProof {
    const requestHash = sha256(request);
    const responseHash = sha256(response);
    const timestamp = new Date();

    // Compute fingerprint score
    const fingerprintScore = this.computeFingerprintScore(model, response);

    // Update fingerprint training data if we have a verified response
    if (challengeResult?.passed) {
      this.updateFingerprint(model, response);
    }

    // Compute consistency score
    const consistencyScore = this.computeConsistencyScore(
      requestHash,
      nodeId,
      response,
    );

    // Record this response for future consistency checks
    this.recordForConsistency(requestHash, nodeId, response);

    // Chain to previous proof
    const previousProofHash = this.lastProofHashes.get(nodeId);

    // Compute proof hash
    const proofHashInput = `${nodeId}:${requestHash}:${responseHash}:${timestamp.toISOString()}`;
    const proofHash = sha256(proofHashInput);

    // Update chain
    this.lastProofHashes.set(nodeId, proofHash);

    const proof: ExecutionProof = {
      proofId: randomUUID(),
      nodeId,
      requestHash,
      responseHash,
      modelClaimed: model,
      timestamp,
      latencyMs,
      tokensGenerated: tokensGenerated ?? Math.ceil(response.split(/\s+/).length * 1.3),
      challengeResponse: challengeResult
        ? (challengeResult.passed ? 'PASS' : 'FAIL')
        : undefined,
      fingerprintScore,
      consistencyScore,
      previousProofHash,
      proofHash,
    };

    // Store proof
    this.proofStore.push(proof);
    if (this.proofStore.length > this.MAX_STORED_PROOFS) {
      this.proofStore = this.proofStore.slice(-this.MAX_STORED_PROOFS);
    }

    return proof;
  }

  // ── Verify Proof ──────────────────────────────────────────────────────

  /**
   * Verify an existing proof using all available verification methods.
   * Returns a composite result with weighted confidence.
   */
  async verifyProof(
    proof: ExecutionProof,
    nodeCapabilities?: Record<string, unknown>,
  ): Promise<VerificationResult> {
    const scores: Array<{
      method: VerificationResult['method'];
      score: number;
      weight: number;
      details: string;
    }> = [];

    // 1. Challenge-Response (30 pts)
    if (proof.challengeResponse) {
      const passed = proof.challengeResponse === 'PASS';
      scores.push({
        method: 'challenge',
        score: passed ? 1.0 : 0.0,
        weight: WEIGHT_CHALLENGE,
        details: `Challenge ${passed ? 'passed' : 'failed'}`,
      });
    }

    // 2. Model Fingerprinting (25 pts)
    if (proof.fingerprintScore >= 0) {
      scores.push({
        method: 'fingerprint',
        score: proof.fingerprintScore,
        weight: WEIGHT_FINGERPRINT,
        details: `Fingerprint similarity: ${(proof.fingerprintScore * 100).toFixed(1)}%`,
      });
    }

    // 3. Cross-Node Consistency (25 pts)
    if (proof.consistencyScore >= 0) {
      scores.push({
        method: 'consistency',
        score: proof.consistencyScore,
        weight: WEIGHT_CONSISTENCY,
        details: `Cross-node consistency: ${(proof.consistencyScore * 100).toFixed(1)}%`,
      });
    }

    // 4. Hardware Attestation (20 pts)
    const attestationResult = this.checkHardwareAttestation(
      proof,
      nodeCapabilities,
    );
    scores.push({
      method: 'attestation',
      score: attestationResult.score,
      weight: WEIGHT_ATTESTATION,
      details: attestationResult.details,
    });

    // Compute weighted average confidence
    const totalAppliedWeight = scores.reduce((sum, s) => sum + s.weight, 0);
    const weightedSum = scores.reduce(
      (sum, s) => sum + s.score * s.weight,
      0,
    );
    const confidence =
      totalAppliedWeight > 0 ? weightedSum / totalAppliedWeight : 0;

    const verified = confidence >= 0.5;
    const reputationDelta = verified
      ? Math.min(2, confidence * 3)
      : -Math.max(5, (1 - confidence) * 10);

    const primaryMethod =
      scores.length > 0
        ? scores.reduce((a, b) => (a.weight > b.weight ? a : b)).method
        : 'attestation';

    const details = scores
      .map((s) => `[${s.method}] ${s.details}`)
      .join('; ');

    // Apply reputation delta to node
    const penaltyApplied = reputationDelta < 0;
    try {
      await this.applyReputationDelta(proof.nodeId, reputationDelta);
    } catch {
      // Non-critical — log and continue
    }

    return {
      verified,
      confidence,
      method: primaryMethod,
      details,
      penaltyApplied,
      reputationDelta,
    };
  }

  // ── Get Proof Chain ───────────────────────────────────────────────────

  /**
   * Return the chain of proofs for a node (audit trail).
   */
  getProofChain(nodeId: string, limit = 50): ExecutionProof[] {
    return this.proofStore
      .filter((p) => p.nodeId === nodeId)
      .slice(-limit);
  }

  /**
   * Get all proofs, optionally filtered.
   */
  getProofs(nodeId?: string, limit = 50): ExecutionProof[] {
    const filtered = nodeId
      ? this.proofStore.filter((p) => p.nodeId === nodeId)
      : this.proofStore;
    return filtered.slice(-limit);
  }

  // ── Model Fingerprinting ──────────────────────────────────────────────

  private computeFingerprintScore(model: string, response: string): number {
    const fingerprint = this.fingerprints.get(model);
    if (!fingerprint || fingerprint.sampleCount < 10) {
      // Not enough training data — return neutral score
      return 0.5;
    }

    const sentenceLength = computeSentenceLength(response);
    const punctFreq = computePunctuationFrequency(response);
    const vocabDist = buildVocabularyDistribution(response);

    // Sentence length similarity (gaussian distance)
    const sentenceDiff = Math.abs(sentenceLength - fingerprint.avgSentenceLength);
    const sentenceScore = Math.exp(-(sentenceDiff * sentenceDiff) / 200);

    // Punctuation frequency similarity
    const punctDiff = Math.abs(punctFreq - fingerprint.punctuationFrequency);
    const punctScore = Math.exp(-(punctDiff * punctDiff) / 0.5);

    // Vocabulary cosine similarity
    const vocabScore = cosineSimilarity(vocabDist, fingerprint.vocabularyDistribution);

    // Weighted combination
    return sentenceScore * 0.2 + punctScore * 0.2 + vocabScore * 0.6;
  }

  private updateFingerprint(model: string, response: string): void {
    let fp = this.fingerprints.get(model);

    if (!fp) {
      fp = {
        model,
        avgSentenceLength: 0,
        punctuationFrequency: 0,
        commonOpeners: [],
        vocabularyDistribution: new Map(),
        sampleCount: 0,
      };
      this.fingerprints.set(model, fp);
    }

    if (fp.sampleCount >= FINGERPRINT_TRAINING_SIZE) {
      return; // Enough training data
    }

    const sentenceLength = computeSentenceLength(response);
    const punctFreq = computePunctuationFrequency(response);
    const openers = extractOpeners(response);
    const vocabDist = buildVocabularyDistribution(response);

    // Running average
    const n = fp.sampleCount;
    fp.avgSentenceLength = (fp.avgSentenceLength * n + sentenceLength) / (n + 1);
    fp.punctuationFrequency = (fp.punctuationFrequency * n + punctFreq) / (n + 1);

    // Merge openers (keep most common)
    fp.commonOpeners = [...fp.commonOpeners, ...openers].slice(0, 20);

    // Merge vocabulary distribution (running average)
    for (const [word, freq] of vocabDist) {
      const existing = fp.vocabularyDistribution.get(word) ?? 0;
      fp.vocabularyDistribution.set(word, (existing * n + freq) / (n + 1));
    }

    fp.sampleCount++;
  }

  // ── Cross-Node Consistency ────────────────────────────────────────────

  private computeConsistencyScore(
    requestHash: string,
    nodeId: string,
    response: string,
  ): number {
    // Clean old entries
    const now = Date.now();
    this.consistencyBuffer = this.consistencyBuffer.filter(
      (e) => now - e.timestamp < CONSISTENCY_WINDOW_MS,
    );

    // Find other nodes' responses for the same request
    const otherResponses = this.consistencyBuffer.filter(
      (e) => e.requestHash === requestHash && e.nodeId !== nodeId,
    );

    if (otherResponses.length === 0) {
      return 0.5; // No peers to compare — neutral
    }

    const myWords = extractWords(response);
    const similarities = otherResponses.map((other) =>
      jaccardSimilarity(myWords, other.responseWords),
    );

    // Average pairwise similarity
    return similarities.reduce((a, b) => a + b, 0) / similarities.length;
  }

  private recordForConsistency(
    requestHash: string,
    nodeId: string,
    response: string,
  ): void {
    this.consistencyBuffer.push({
      requestHash,
      nodeId,
      responseWords: extractWords(response),
      timestamp: Date.now(),
    });

    // Cap buffer size
    if (this.consistencyBuffer.length > 1000) {
      this.consistencyBuffer = this.consistencyBuffer.slice(-500);
    }
  }

  // ── Hardware Attestation ──────────────────────────────────────────────

  private checkHardwareAttestation(
    proof: ExecutionProof,
    capabilities?: Record<string, unknown>,
  ): { score: number; details: string } {
    if (!capabilities) {
      return { score: 0.5, details: 'No hardware capabilities reported' };
    }

    // Check TEE attestation
    const teeAttested = capabilities.teeAttested === true;

    // Check latency vs claimed hardware
    const claimedHardware = (capabilities.gpu as string)?.toLowerCase() ?? '';
    const tokensGenerated = proof.tokensGenerated || 1;
    const msPerToken = proof.latencyMs / tokensGenerated;

    let hardwareMatch = '';
    let profile: HardwareLatencyProfile | undefined;

    for (const [hw, p] of Object.entries(HARDWARE_PROFILES)) {
      if (claimedHardware.includes(hw)) {
        hardwareMatch = hw;
        profile = p;
        break;
      }
    }

    if (!profile) {
      // Unknown hardware — partial score
      const teeScore = teeAttested ? 0.8 : 0.5;
      return {
        score: teeScore,
        details: `Unknown hardware "${claimedHardware}"; TEE ${teeAttested ? 'attested' : 'not attested'}`,
      };
    }

    // Check if latency is within expected range for claimed hardware
    const withinRange =
      msPerToken >= profile.minMsPerToken * 0.5 &&
      msPerToken <= profile.maxMsPerToken * 2;

    if (!withinRange) {
      // Latency doesn't match claimed hardware — suspicious
      const penalty = msPerToken > profile.maxMsPerToken * 5 ? 0.0 : 0.2;
      return {
        score: penalty,
        details: `Claimed ${hardwareMatch} but ${msPerToken.toFixed(1)}ms/token outside expected range (${profile.minMsPerToken}-${profile.maxMsPerToken}ms)`,
      };
    }

    const rangeWidth = profile.maxMsPerToken - profile.minMsPerToken;
    const positionInRange =
      rangeWidth > 0
        ? 1 - (msPerToken - profile.minMsPerToken) / rangeWidth
        : 1;
    const latencyScore = Math.max(0, Math.min(1, positionInRange));

    const baseScore = teeAttested ? 0.9 : 0.7;
    const finalScore = baseScore * 0.6 + latencyScore * 0.4;

    return {
      score: finalScore,
      details: `${hardwareMatch} at ${msPerToken.toFixed(1)}ms/token (expected ${profile.minMsPerToken}-${profile.maxMsPerToken}ms); TEE ${teeAttested ? 'attested' : 'not attested'}`,
    };
  }

  // ── Reputation ────────────────────────────────────────────────────────

  private async applyReputationDelta(
    nodeId: string,
    delta: number,
  ): Promise<void> {
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
      console.error('[ProofOfExecution] Failed to update reputation:', err);
    }
  }

  // ── Challenge Integration ─────────────────────────────────────────────

  /**
   * Generate a verification challenge using the existing ResultVerifier.
   * Convenience wrapper for proxy integration.
   */
  generateChallenge(): VerificationChallenge {
    return resultVerifier.generateChallenge();
  }
}

// ── Singleton ────────────────────────────────────────────────────────────

export const proofOfExecution = new ProofOfExecution();
