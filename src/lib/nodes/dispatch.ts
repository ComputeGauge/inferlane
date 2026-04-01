// ---------------------------------------------------------------------------
// Node Dispatch Engine (Stream T)
// ---------------------------------------------------------------------------
// Per-request micropayment flow for decentralised node operators.
// Zero real-money transactions per request — all internal ledger entries.
//
// Flow:
// 1. Estimate cost → reserve credits from user
// 2. Select best node → dispatch request
// 3. Node responds → calculate actual cost
// 4. Deduct user credits → credit node pendingBalance
// 5. Create transaction records on both sides
//
// The user sees the same response as a regular proxy call.
// The node operator sees earnings accumulate in their dashboard.
// Real money only moves in daily/weekly batch payouts via Stripe Connect.
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db';
import { rankCandidates, updateReputation } from './reliability';
import { calculatePhaseAwareCost } from '@/lib/pricing/decode-pricing';
import type { RequestOutcome } from './reliability';
import { processReferralBonus } from './referral-bonus';

// ── Types ────────────────────────────────────────────────────────────────

export interface DispatchMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DispatchRequest {
  userId: string;
  model: string;
  prompt: string;
  messages?: DispatchMessage[];
  maxTokens: number;
  preferredRegion?: string;
  maxRetries?: number;
}

export interface DispatchResult {
  success: boolean;
  nodeId: string | null;
  response: string | null;
  latencyMs: number;
  actualCostUsd: number;
  error?: string;
  phaseBreakdown?: {
    prefillCost: number;
    decodeCost: number;
    kvCacheCost: number;
    memoryTechnology: string;
  };
}

// ── Platform Take Rate ───────────────────────────────────────────────────

/** Platform take rate on node-routed requests */
export const PLATFORM_TAKE_RATE = 0.20; // 20%

/** Minimum payout thresholds by lifetime earnings */
export const PAYOUT_THRESHOLDS = {
  UNDER_100: { frequency: 'weekly', minimumUsd: 5.00 },
  UNDER_1000: { frequency: 'daily', minimumUsd: 1.00 },
  OVER_1000: { frequency: 'daily', minimumUsd: 1.00 },
} as const;

// ── Dispatch ─────────────────────────────────────────────────────────────

/**
 * Dispatch a request to the best available node.
 *
 * This is the core micropayment function. Every step is an internal
 * ledger entry — zero payment processing cost per request.
 */
export async function dispatchToNode(
  request: DispatchRequest,
): Promise<DispatchResult> {
  const startTime = Date.now();
  const maxRetries = request.maxRetries ?? 1;

  // 1. Find eligible nodes
  const allNodes = await prisma.nodeOperator.findMany({
    where: { isOnline: true },
    select: {
      id: true,
      reputationScore: true,
      isOnline: true,
      lastSeenAt: true,
      avgLatencyMs: true,
      regions: true,
      capabilities: true,
      maxConcurrent: true,
      apiEndpoint: true,
      memoryProfile: {
        select: {
          memoryTechnology: true,
          memoryBandwidthGBs: true,
        },
      },
    },
  });

  const candidates = rankCandidates(
    allNodes.map((n) => ({
      ...n,
      capabilities: (n.capabilities as Record<string, unknown>) ?? {},
    })),
    request.model,
    request.preferredRegion,
  );

  if (candidates.length === 0) {
    return {
      success: false,
      nodeId: null,
      response: null,
      latencyMs: Date.now() - startTime,
      actualCostUsd: 0,
      error: 'No available nodes for this model',
    };
  }

  // 2. Attempt dispatch with retry
  for (let attempt = 0; attempt <= maxRetries && attempt < candidates.length; attempt++) {
    const node = candidates[attempt];
    const nodeStartTime = Date.now();

    try {
      const response = await callNode(node.apiEndpoint!, request);
      const latencyMs = Date.now() - nodeStartTime;

      // Calculate cost from actual token usage returned by the node
      const usage = consumeLastNodeUsage();
      const inputTokens = usage?.prompt_tokens ?? Math.ceil(request.prompt.length / 4);
      const outputTokens = usage?.completion_tokens ?? Math.ceil(response.length / 4);

      // Phase-aware pricing using the node's actual memory hardware
      const memTech = (node as any).memoryProfile?.memoryTechnology ?? 'UNKNOWN';
      const memBw = (node as any).memoryProfile?.memoryBandwidthGBs ?? 1000;
      const phaseResult = calculatePhaseAwareCost({
        inputTokens,
        outputTokens,
        memoryTechnology: memTech,
        memoryBandwidthGBs: memBw,
      });
      const totalCost = Math.max(0.0001, phaseResult.totalCost);
      const nodePayout = totalCost * (1 - PLATFORM_TAKE_RATE);

      // 3. Credit the node operator
      await creditNodeOperator(node.id, nodePayout, totalCost);

      // 4. Update reputation
      await updateReputation(node.id, 'success', latencyMs);

      return {
        success: true,
        nodeId: node.id,
        response,
        latencyMs,
        actualCostUsd: totalCost,
        phaseBreakdown: {
          prefillCost: phaseResult.prefillCost,
          decodeCost: phaseResult.decodeCost,
          kvCacheCost: phaseResult.kvCacheCost,
          memoryTechnology: memTech,
        },
      };
    } catch (err) {
      const latencyMs = Date.now() - nodeStartTime;
      const outcome: RequestOutcome = latencyMs > 30000 ? 'timeout' : 'error';
      await updateReputation(node.id, outcome, latencyMs);

      // Try next node
      if (attempt === maxRetries || attempt === candidates.length - 1) {
        return {
          success: false,
          nodeId: node.id,
          response: null,
          latencyMs: Date.now() - startTime,
          actualCostUsd: 0,
          error: err instanceof Error ? err.message : 'Node dispatch failed',
        };
      }
    }
  }

  return {
    success: false,
    nodeId: null,
    response: null,
    latencyMs: Date.now() - startTime,
    actualCostUsd: 0,
    error: 'All nodes failed',
  };
}

// ── Node Call ─────────────────────────────────────────────────────────────

/** Timeout for node inference calls (30 seconds) */
const NODE_CALL_TIMEOUT_MS = 30_000;

/**
 * Expected OpenAI-compatible response from a node.
 * Nodes MUST expose an OpenAI-compatible /v1/chat/completions endpoint.
 */
interface NodeChatResponse {
  id?: string;
  choices?: Array<{
    index?: number;
    message?: { role?: string; content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string };
}

/**
 * Call a node's inference endpoint.
 *
 * Nodes expose an OpenAI-compatible chat completions API.
 * Endpoint formats supported:
 *   - https://node.example.com/v1          → appends /chat/completions
 *   - https://node.example.com/v1/         → appends chat/completions
 *   - https://node.example.com/v1/chat/completions → used as-is
 *   - https://node.example.com             → appends /v1/chat/completions
 *
 * Returns the assistant message content string.
 * Throws on network error, timeout, non-2xx status, or empty response.
 */
export async function callNode(
  endpoint: string,
  request: DispatchRequest,
): Promise<string> {
  // Normalise the endpoint URL to always target /v1/chat/completions
  let url = endpoint.replace(/\/+$/, ''); // strip trailing slashes
  if (!url.includes('/chat/completions')) {
    if (url.endsWith('/v1')) {
      url += '/chat/completions';
    } else {
      url += '/v1/chat/completions';
    }
  }

  // Build the messages array.  If the caller passed a single prompt string
  // we wrap it as a user message.  In future we could accept a full
  // messages array for multi-turn dispatch.
  const messages = request.messages && request.messages.length > 0
    ? request.messages
    : [{ role: 'user' as const, content: request.prompt }];

  const body = {
    model: request.model,
    messages,
    max_tokens: request.maxTokens,
    stream: false,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NODE_CALL_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Nodes can optionally require an auth header — future: per-node token
        // 'Authorization': `Bearer ${nodeToken}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Node timeout after ${NODE_CALL_TIMEOUT_MS}ms: ${url}`);
    }
    throw new Error(`Node unreachable: ${url} — ${err instanceof Error ? err.message : 'network error'}`);
  } finally {
    clearTimeout(timeout);
  }

  // Non-2xx → throw so dispatch can retry with next node
  if (!res.ok) {
    let errorMsg = `Node returned HTTP ${res.status}`;
    try {
      const errBody = await res.json() as NodeChatResponse;
      if (errBody.error?.message) errorMsg += `: ${errBody.error.message}`;
    } catch { /* body not JSON — use status alone */ }
    throw new Error(errorMsg);
  }

  const data = (await res.json()) as NodeChatResponse;

  // Extract the assistant message
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Node returned empty response — no content in choices[0].message.content');
  }

  // Attach usage info to the request for cost calculation upstream
  // We store it on a module-level variable so dispatchToNode can read it
  // without changing the return type of callNode.
  lastNodeUsage = data.usage ?? null;

  return content;
}

/**
 * Last node response usage data — set by callNode(), read by dispatchToNode().
 * This avoids changing callNode's return type while still surfacing token counts.
 */
let lastNodeUsage: NodeChatResponse['usage'] | null = null;

/** Read and clear the last node usage data */
export function consumeLastNodeUsage() {
  const u = lastNodeUsage;
  lastNodeUsage = null;
  return u;
}

// ── Ledger Operations ────────────────────────────────────────────────────

/**
 * Credit a node operator's pendingBalance and create transaction record.
 * All internal — zero payment processing cost.
 */
async function creditNodeOperator(
  nodeId: string,
  payoutAmount: number,
  totalCost: number,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const node = await tx.nodeOperator.findUnique({
      where: { id: nodeId },
      select: { pendingBalance: true },
    });

    if (!node) return;

    const balanceBefore = Number(node.pendingBalance);
    const balanceAfter = balanceBefore + payoutAmount;

    await tx.nodeOperator.update({
      where: { id: nodeId },
      data: {
        pendingBalance: { increment: payoutAmount },
        lifetimeEarned: { increment: payoutAmount },
      },
    });

    await tx.nodeTransaction.create({
      data: {
        nodeOperatorId: nodeId,
        type: 'NODE_EARNING',
        amount: payoutAmount,
        balanceBefore,
        balanceAfter,
        description: `Earned $${payoutAmount.toFixed(6)} (${((1 - PLATFORM_TAKE_RATE) * 100).toFixed(0)}% of $${totalCost.toFixed(6)} request)`,
      },
    });
  });

  // Process referral bonus (fire-and-forget — don't block the response)
  processReferralBonus(nodeId, payoutAmount).catch((err) => {
    console.error('[Dispatch] referral bonus error:', err);
  });
}

/**
 * Get payout eligibility based on lifetime earnings tier.
 */
export function getPayoutTier(lifetimeEarnings: number) {
  if (lifetimeEarnings >= 1000) return PAYOUT_THRESHOLDS.OVER_1000;
  if (lifetimeEarnings >= 100) return PAYOUT_THRESHOLDS.UNDER_1000;
  return PAYOUT_THRESHOLDS.UNDER_100;
}

// ── Disaggregated Prefill/Decode Dispatch (Stream W5) ───────────────────

/**
 * Dispatch with phase-aware node selection.
 *
 * For large requests (long prompts + significant generation), this splits
 * dispatch into two phases routed to the optimal node type:
 *
 *   1. PREFILL phase → routed to compute-optimised node (high FLOPs)
 *   2. KV cache transfer → P2P from prefill node to decode node
 *   3. DECODE phase → routed to memory-optimised node (high bandwidth)
 *
 * For small requests, falls back to unified dispatch (single node).
 *
 * Threshold: disaggregate when prompt > 4K tokens AND max_tokens > 512.
 */
export async function disaggregatedDispatch(
  request: DispatchRequest,
): Promise<DispatchResult> {
  const estimatedInputTokens = request.prompt.length / 4;

  // Only disaggregate for large requests where the overhead is justified
  const DISAGGREGATE_INPUT_THRESHOLD = 4000;
  const DISAGGREGATE_OUTPUT_THRESHOLD = 512;

  if (
    estimatedInputTokens < DISAGGREGATE_INPUT_THRESHOLD ||
    request.maxTokens < DISAGGREGATE_OUTPUT_THRESHOLD
  ) {
    // Small request — unified dispatch is more efficient
    return dispatchToNode(request);
  }

  // Find nodes with memory profiles for role-based selection
  const allNodes = await prisma.nodeOperator.findMany({
    where: { isOnline: true },
    select: {
      id: true,
      reputationScore: true,
      isOnline: true,
      lastSeenAt: true,
      avgLatencyMs: true,
      regions: true,
      capabilities: true,
      maxConcurrent: true,
      apiEndpoint: true,
      memoryProfile: {
        select: {
          nodeRole: true,
          decodeThroughputTps: true,
          prefillThroughputTps: true,
          memoryBandwidthGBs: true,
          kvSharingEnabled: true,
        },
      },
    },
  });

  // Separate nodes by role
  const prefillNodes = allNodes.filter(
    (n) => n.memoryProfile?.nodeRole === 'PREFILL_OPTIMISED' || n.memoryProfile?.nodeRole === 'HYBRID',
  );
  const decodeNodes = allNodes.filter(
    (n) => n.memoryProfile?.nodeRole === 'DECODE_OPTIMISED' || n.memoryProfile?.nodeRole === 'HYBRID',
  );

  // If we don't have role-differentiated nodes, fall back to unified
  if (prefillNodes.length === 0 || decodeNodes.length === 0) {
    return dispatchToNode(request);
  }

  // Sort decode nodes by decode throughput (highest first)
  const sortedDecodeNodes = decodeNodes
    .filter((n) => n.memoryProfile)
    .sort((a, b) => {
      const aTps = Number(a.memoryProfile?.decodeThroughputTps ?? 0);
      const bTps = Number(b.memoryProfile?.decodeThroughputTps ?? 0);
      return bTps - aTps;
    });

  // For now, use unified dispatch but prefer decode-optimised nodes
  // In future: implement actual phase split with KV cache transfer
  //
  // The ranking candidates function already handles basic scoring;
  // here we boost memory-optimised nodes for decode-heavy requests
  const candidates = rankCandidates(
    sortedDecodeNodes.map((n) => ({
      ...n,
      capabilities: (n.capabilities as Record<string, unknown>) ?? {},
      // Boost reputation for decode-optimised nodes on decode-heavy requests
      reputationScore: n.memoryProfile?.nodeRole === 'DECODE_OPTIMISED'
        ? Math.min(100, n.reputationScore + 10)
        : n.reputationScore,
    })),
    request.model,
    request.preferredRegion,
  );

  if (candidates.length === 0) {
    return dispatchToNode(request); // fallback
  }

  // Dispatch to best decode-optimised node
  const startTime = Date.now();
  const node = candidates[0];

  try {
    const response = await callNode(node.apiEndpoint!, request);
    const latencyMs = Date.now() - startTime;

    const usage = consumeLastNodeUsage();
    const inputTokens = usage?.prompt_tokens ?? Math.ceil(request.prompt.length / 4);
    const outputTokens = usage?.completion_tokens ?? Math.ceil(response.length / 4);

    // Phase-aware cost using the decode-optimised node's memory profile
    // Look up from original allNodes since rankCandidates strips memoryProfile
    const originalNode = allNodes.find((n) => n.id === node.id);
    const memTech = originalNode?.memoryProfile?.memoryBandwidthGBs
      ? 'HBM3' // decode-optimised nodes are high-bandwidth by definition
      : 'UNKNOWN';
    const memBw = originalNode?.memoryProfile?.memoryBandwidthGBs ?? 2000;
    const phaseResult = calculatePhaseAwareCost({
      inputTokens,
      outputTokens,
      memoryTechnology: memTech,
      memoryBandwidthGBs: memBw,
    });
    const totalCost = Math.max(0.0001, phaseResult.totalCost);
    const nodePayout = totalCost * (1 - PLATFORM_TAKE_RATE);

    await creditNodeOperator(node.id, nodePayout, totalCost);
    await updateReputation(node.id, 'success', latencyMs);

    return {
      success: true,
      nodeId: node.id,
      response,
      latencyMs,
      actualCostUsd: totalCost,
      phaseBreakdown: {
        prefillCost: phaseResult.prefillCost,
        decodeCost: phaseResult.decodeCost,
        kvCacheCost: phaseResult.kvCacheCost,
        memoryTechnology: memTech,
      },
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const outcome: RequestOutcome = latencyMs > 30000 ? 'timeout' : 'error';
    await updateReputation(node.id, outcome, latencyMs);

    // Fallback to standard dispatch on failure
    return dispatchToNode(request);
  }
}
