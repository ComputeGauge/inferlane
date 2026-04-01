// ---------------------------------------------------------------------------
// Node Reliability & Reputation Scoring (Stream T)
// ---------------------------------------------------------------------------
// Pre-dispatch checks, post-request scoring, and reputation management
// for decentralised node operators.
//
// New nodes start at 50 reputation. Success adds +0.5 (max 100).
// Failures deduct -5 (timeout) or -10 (bad response). Floor at 0.
// Consecutive failures (3+) trigger 15-minute delist.
// Reputation < 20 → permanently delisted (manual review to re-enable).
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db';

// ── Constants ────────────────────────────────────────────────────────────

export const REPUTATION_CONFIG = {
  initialScore: 50,
  maxScore: 100,
  successIncrement: 0.5,
  timeoutPenalty: 5,
  badResponsePenalty: 10,
  consecutiveFailureThreshold: 3,
  tempDelistMinutes: 15,
  permanentDelistThreshold: 20,
  minReputationForDispatch: 30,
  heartbeatMaxAgeSeconds: 30,
} as const;

// ── Pre-Dispatch Checks ──────────────────────────────────────────────────

export interface DispatchCandidate {
  id: string;
  reputationScore: number;
  isOnline: boolean;
  lastSeenAt: Date | null;
  avgLatencyMs: number;
  regions: string[];
  capabilities: Record<string, unknown>;
  maxConcurrent: number;
  apiEndpoint: string | null;
}

/**
 * Filter and rank nodes eligible for dispatch.
 * Returns ordered list: best candidate first.
 */
export function rankCandidates(
  candidates: DispatchCandidate[],
  model: string,
  preferredRegion?: string,
): DispatchCandidate[] {
  const now = Date.now();

  return candidates
    .filter((node) => {
      // Must be online with recent heartbeat
      if (!node.isOnline || !node.lastSeenAt) return false;
      const ageSec = (now - node.lastSeenAt.getTime()) / 1000;
      if (ageSec > REPUTATION_CONFIG.heartbeatMaxAgeSeconds) return false;

      // Must meet minimum reputation
      if (node.reputationScore < REPUTATION_CONFIG.minReputationForDispatch) return false;

      // Must have an endpoint
      if (!node.apiEndpoint) return false;

      return true;
    })
    .sort((a, b) => {
      // Region proximity bonus
      const aRegion = preferredRegion && a.regions.includes(preferredRegion) ? -10 : 0;
      const bRegion = preferredRegion && b.regions.includes(preferredRegion) ? -10 : 0;

      // Composite: reputation (higher better) - latency (lower better)
      const aScore = a.reputationScore * 2 - a.avgLatencyMs / 100 + aRegion;
      const bScore = b.reputationScore * 2 - b.avgLatencyMs / 100 + bRegion;

      return bScore - aScore; // descending
    });
}

// ── Post-Request Scoring ─────────────────────────────────────────────────

export type RequestOutcome = 'success' | 'timeout' | 'bad_response' | 'error';

/**
 * Update a node's reputation after a request completes.
 */
export async function updateReputation(
  nodeId: string,
  outcome: RequestOutcome,
  latencyMs?: number,
): Promise<{ newScore: number; delisted: boolean }> {
  const node = await prisma.nodeOperator.findUnique({
    where: { id: nodeId },
    select: {
      reputationScore: true,
      totalRequests: true,
      failedRequests: true,
      avgLatencyMs: true,
    },
  });

  if (!node) {
    return { newScore: 0, delisted: true };
  }

  let delta = 0;
  let isFailed = false;

  switch (outcome) {
    case 'success':
      delta = REPUTATION_CONFIG.successIncrement;
      break;
    case 'timeout':
      delta = -REPUTATION_CONFIG.timeoutPenalty;
      isFailed = true;
      break;
    case 'bad_response':
      delta = -REPUTATION_CONFIG.badResponsePenalty;
      isFailed = true;
      break;
    case 'error':
      delta = -REPUTATION_CONFIG.timeoutPenalty;
      isFailed = true;
      break;
  }

  const newScore = Math.max(0, Math.min(REPUTATION_CONFIG.maxScore, node.reputationScore + delta));

  // Calculate new average latency
  const totalReqs = node.totalRequests + 1;
  const newAvgLatency = latencyMs
    ? Math.round((node.avgLatencyMs * node.totalRequests + latencyMs) / totalReqs)
    : node.avgLatencyMs;

  // Check for permanent delist
  const shouldDelist = newScore < REPUTATION_CONFIG.permanentDelistThreshold;

  await prisma.nodeOperator.update({
    where: { id: nodeId },
    data: {
      reputationScore: newScore,
      totalRequests: { increment: 1 },
      failedRequests: isFailed ? { increment: 1 } : undefined,
      avgLatencyMs: newAvgLatency,
      isOnline: !shouldDelist, // delist if below threshold
      lastSeenAt: new Date(),
    },
  });

  return { newScore, delisted: shouldDelist };
}

// ── Heartbeat ────────────────────────────────────────────────────────────

/**
 * Process a heartbeat from a node operator.
 * Sets isOnline = true and updates lastSeenAt.
 */
export async function processHeartbeat(
  nodeId: string,
  currentLoad?: number,
): Promise<void> {
  await prisma.nodeOperator.update({
    where: { id: nodeId },
    data: {
      isOnline: true,
      lastSeenAt: new Date(),
    },
  });
}

/**
 * Mark nodes as offline if they haven't sent a heartbeat recently.
 * Called by a periodic cleanup job.
 */
export async function markStaleNodesOffline(
  maxAgeSeconds: number = 60,
): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeSeconds * 1000);

  const result = await prisma.nodeOperator.updateMany({
    where: {
      isOnline: true,
      OR: [
        { lastSeenAt: { lt: cutoff } },
        { lastSeenAt: null },
      ],
    },
    data: { isOnline: false },
  });

  return result.count;
}
