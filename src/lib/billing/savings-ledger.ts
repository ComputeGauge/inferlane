// ---------------------------------------------------------------------------
// Savings Ledger (Stream Z2)
// ---------------------------------------------------------------------------
// Tracks how much money users save by using InferLane's smart routing,
// cross-platform arbitrage, promotions, off-peak scheduling, and
// decentralized node dispatch.
//
// Uses the existing ProxyRequest.savingsUsd field for per-request savings.
// Aggregation queries run against proxy_requests for summaries.
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db';

// ── Types ──────────────────────────────────────────────────────────────────

export type SavingsReason =
  | 'promotion'
  | 'cross_platform'
  | 'off_peak'
  | 'decentralized'
  | 'budget_routing';

export type SavingsPeriod = 'today' | '7d' | '30d' | 'all';

export interface RecordSavingInput {
  proxyRequestId: string;
  actualCost: number;
  listCost: number;
  queuedAt?: Date;
  executedAt: Date;
  reason: SavingsReason;
  provider: string;
  model: string;
}

export interface SavingsSummary {
  totalSaved: number;
  totalSpent: number;
  savingsPercent: number;
  recordCount: number;
  topSavingsReason: SavingsReason | null;
  bestSingleSaving: number;
  avgSavingPerRequest: number;
  periodLabel: string;
}

export interface LeaderboardEntry {
  reason: SavingsReason;
  label: string;
  totalSaved: number;
  requestCount: number;
  avgSavingPercent: number;
}

// ── 1. Record a saving ────────────────────────────────────────────────────

export async function recordSaving(data: RecordSavingInput): Promise<void> {
  const savingsUsd = Math.max(0, data.listCost - data.actualCost);

  if (savingsUsd <= 0) return; // No saving to record

  // Update the ProxyRequest with the savings amount and routing reason
  await prisma.proxyRequest.update({
    where: { id: data.proxyRequestId },
    data: {
      savingsUsd: savingsUsd,
      routingReason: data.reason,
    },
  });
}

// ── 2. Savings summary ───────────────────────────────────────────────────

export async function getSavingsSummary(
  userId: string,
  period: SavingsPeriod = '30d',
): Promise<SavingsSummary> {
  const since = getPeriodStart(period);
  const periodLabel = getPeriodLabel(period);

  // Find user's API keys to scope the query
  const apiKeys = await prisma.apiKey.findMany({
    where: { userId },
    select: { id: true },
  });
  const apiKeyIds = apiKeys.map((k: any) => k.id);

  if (apiKeyIds.length === 0) {
    return {
      totalSaved: 0,
      totalSpent: 0,
      savingsPercent: 0,
      recordCount: 0,
      topSavingsReason: null,
      bestSingleSaving: 0,
      avgSavingPerRequest: 0,
      periodLabel,
    };
  }

  const where: any = {
    apiKeyId: { in: apiKeyIds },
    savingsUsd: { gt: 0 },
  };
  if (since) {
    where.timestamp = { gte: since };
  }

  // Aggregate savings
  const agg = await prisma.proxyRequest.aggregate({
    where,
    _sum: { savingsUsd: true, costUsd: true },
    _max: { savingsUsd: true },
    _count: true,
  });

  const totalSaved = Number(agg._sum.savingsUsd || 0);
  const totalSpent = Number(agg._sum.costUsd || 0);
  const bestSingleSaving = Number(agg._max.savingsUsd || 0);
  const recordCount = agg._count;

  // Get total spent (including requests with no savings)
  const totalSpentAll = await prisma.proxyRequest.aggregate({
    where: {
      apiKeyId: { in: apiKeyIds },
      ...(since ? { timestamp: { gte: since } } : {}),
    },
    _sum: { costUsd: true },
  });
  const allSpent = Number(totalSpentAll._sum.costUsd || 0);
  const savingsPercent = allSpent + totalSaved > 0
    ? Math.round((totalSaved / (allSpent + totalSaved)) * 10000) / 100
    : 0;

  // Find top savings reason by grouping
  const topReason = await findTopSavingsReason(apiKeyIds, since);

  return {
    totalSaved: Math.round(totalSaved * 1_000_000) / 1_000_000,
    totalSpent: Math.round(allSpent * 1_000_000) / 1_000_000,
    savingsPercent,
    recordCount,
    topSavingsReason: topReason,
    bestSingleSaving: Math.round(bestSingleSaving * 1_000_000) / 1_000_000,
    avgSavingPerRequest: recordCount > 0
      ? Math.round((totalSaved / recordCount) * 1_000_000) / 1_000_000
      : 0,
    periodLabel,
  };
}

// ── 3. Leaderboard by savings reason ──────────────────────────────────────

export async function getLeaderboard(
  userId?: string,
  period: SavingsPeriod = '30d',
): Promise<LeaderboardEntry[]> {
  const since = getPeriodStart(period);

  // Build the where clause
  const where: any = {
    savingsUsd: { gt: 0 },
    routingReason: { not: null },
  };
  if (since) {
    where.timestamp = { gte: since };
  }

  // Scope to user's API keys if userId provided
  if (userId) {
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId },
      select: { id: true },
    });
    where.apiKeyId = { in: apiKeys.map((k: any) => k.id) };
  }

  // Group by routing reason
  const groups = await prisma.proxyRequest.groupBy({
    by: ['routingReason'],
    where,
    _sum: { savingsUsd: true, costUsd: true },
    _count: true,
    orderBy: { _sum: { savingsUsd: 'desc' } },
  });

  const reasonLabels: Record<string, string> = {
    promotion: 'Promotion-based savings',
    cross_platform: 'Cross-platform arbitrage',
    off_peak: 'Off-peak scheduling',
    decentralized: 'Decentralized node savings',
    budget_routing: 'Budget-optimized routing',
    cheapest_equivalent: 'Cheapest equivalent model',
    promotion_active: 'Active promotion routing',
  };

  return groups.map((g: any) => {
    const totalSaved = Number(g._sum.savingsUsd || 0);
    const totalCost = Number(g._sum.costUsd || 0);
    const avgPercent = totalCost + totalSaved > 0
      ? Math.round((totalSaved / (totalCost + totalSaved)) * 100)
      : 0;

    return {
      reason: g.routingReason as SavingsReason,
      label: reasonLabels[g.routingReason] || g.routingReason,
      totalSaved: Math.round(totalSaved * 1_000_000) / 1_000_000,
      requestCount: g._count,
      avgSavingPercent: avgPercent,
    };
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getPeriodStart(period: SavingsPeriod): Date | null {
  const now = new Date();
  switch (period) {
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'all':
      return null;
  }
}

function getPeriodLabel(period: SavingsPeriod): string {
  switch (period) {
    case 'today': return 'Today';
    case '7d': return 'Last 7 days';
    case '30d': return 'Last 30 days';
    case 'all': return 'All time';
  }
}

async function findTopSavingsReason(
  apiKeyIds: string[],
  since: Date | null,
): Promise<SavingsReason | null> {
  const where: any = {
    apiKeyId: { in: apiKeyIds },
    savingsUsd: { gt: 0 },
    routingReason: { not: null },
  };
  if (since) {
    where.timestamp = { gte: since };
  }

  const groups = await prisma.proxyRequest.groupBy({
    by: ['routingReason'],
    where,
    _sum: { savingsUsd: true },
    orderBy: { _sum: { savingsUsd: 'desc' } },
    take: 1,
  });

  if (groups.length === 0) return null;
  return groups[0].routingReason as SavingsReason;
}
