import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import { handleApiError } from '@/lib/api-errors';
import { withTiming } from '@/lib/api-timing';
import { createHash } from 'crypto';

const VALID_PERIODS = ['today', 'week', 'month', 'quarter'] as const;
type Period = (typeof VALID_PERIODS)[number];

function getPeriodStart(period: Period): Date {
  const now = new Date();
  switch (period) {
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    case 'week': {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return start;
    }
    case 'month': {
      const start = new Date(now);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    case 'quarter': {
      const start = new Date(now);
      const quarterMonth = Math.floor(start.getMonth() / 3) * 3;
      start.setMonth(quarterMonth, 1);
      start.setHours(0, 0, 0, 0);
      return start;
    }
  }
}

/**
 * Authenticate via session or Bearer token (il_ prefix).
 * Returns the userId or null.
 */
async function resolveUserId(req: NextRequest): Promise<string | null> {
  // Try session first
  const session = await getServerSession(authOptions);
  if (session?.user) {
    return (session.user as { id: string }).id;
  }

  // Fall back to Bearer token
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer il_')) {
    return null;
  }

  const rawKey = authHeader.slice(7);
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  const apiKey = await prisma.apiKey.findFirst({
    where: { keyHash, isActive: true },
    select: { userId: true },
  });

  return apiKey?.userId ?? null;
}

/**
 * POST /api/mcp/spend-summary
 *
 * Returns aggregated spend data from ProxyRequest for the authenticated user,
 * broken down by provider and model for the requested period.
 */
async function handlePOST(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit: 60/min
  const rl = await rateLimit(`spend-summary:${userId}`, 60, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', remaining: rl.remaining },
      { status: 429 },
    );
  }

  // Parse body
  let body: { period?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const period = (body.period || 'month') as string;
  if (!VALID_PERIODS.includes(period as Period)) {
    return NextResponse.json(
      { error: `Invalid period. Must be one of: ${VALID_PERIODS.join(', ')}` },
      { status: 400 },
    );
  }

  const periodStart = getPeriodStart(period as Period);

  try {
    // Get user's API key IDs
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId },
      select: { id: true },
    });

    const apiKeyIds = apiKeys.map((k) => k.id);

    if (apiKeyIds.length === 0) {
      return NextResponse.json({
        period,
        totalCost: 0,
        requestCount: 0,
        byProvider: [],
        byModel: [],
        tokenUsage: { input: 0, output: 0 },
      });
    }

    // Aggregate by provider
    const byProvider = await prisma.proxyRequest.groupBy({
      by: ['routedProvider'],
      where: {
        apiKeyId: { in: apiKeyIds },
        timestamp: { gte: periodStart },
      },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true, latencyMs: true },
      _count: true,
      _avg: { latencyMs: true },
    });

    // Aggregate by model
    const byModel = await prisma.proxyRequest.groupBy({
      by: ['routedModel'],
      where: {
        apiKeyId: { in: apiKeyIds },
        timestamp: { gte: periodStart },
      },
      _sum: { costUsd: true },
      _count: true,
    });

    // Totals
    const totals = await prisma.proxyRequest.aggregate({
      where: {
        apiKeyId: { in: apiKeyIds },
        timestamp: { gte: periodStart },
      },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      _count: true,
    });

    return NextResponse.json({
      period,
      totalCost: Number(totals._sum.costUsd ?? 0),
      requestCount: totals._count,
      byProvider: byProvider.map((row) => ({
        provider: row.routedProvider,
        cost: Number(row._sum.costUsd ?? 0),
        requestCount: row._count,
        avgLatencyMs: Math.round(Number(row._avg.latencyMs ?? 0)),
      })),
      byModel: byModel.map((row) => ({
        model: row.routedModel,
        cost: Number(row._sum.costUsd ?? 0),
        requestCount: row._count,
      })),
      tokenUsage: {
        input: totals._sum.inputTokens ?? 0,
        output: totals._sum.outputTokens ?? 0,
      },
    });
  } catch (error) {
    return handleApiError(error, 'SpendSummary');
  }
}

export const POST = withTiming(handlePOST);
