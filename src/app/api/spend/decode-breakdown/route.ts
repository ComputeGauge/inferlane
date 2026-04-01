import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import { handleApiError } from '@/lib/api-errors';
import { withTiming } from '@/lib/api-timing';

/**
 * GET /api/spend/decode-breakdown
 *
 * Returns daily phase-aware cost breakdown (prefill / decode / KV cache)
 * for the authenticated user over the last 30 days.
 */
async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  // Rate limit: 30 req/min
  const rl = await rateLimit(`decode-breakdown:${userId}`, 30, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    // Get user's API key IDs
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId },
      select: { id: true },
    });
    const keyIds = apiKeys.map((k) => k.id);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const requests = await prisma.proxyRequest.findMany({
      where: {
        apiKeyId: { in: keyIds },
        timestamp: { gte: thirtyDaysAgo },
      },
      select: {
        timestamp: true,
        costUsd: true,
        prefillCost: true,
        decodeCost: true,
        kvCacheCost: true,
      },
      orderBy: { timestamp: 'asc' },
    });

    // Group by date string (YYYY-MM-DD)
    const dailyMap = new Map<
      string,
      { prefill: number; decode: number; kvCache: number; total: number }
    >();

    for (const r of requests) {
      const date = r.timestamp.toISOString().slice(0, 10);
      const entry = dailyMap.get(date) || { prefill: 0, decode: 0, kvCache: 0, total: 0 };

      entry.prefill += Number(r.prefillCost ?? 0);
      entry.decode += Number(r.decodeCost ?? 0);
      entry.kvCache += Number(r.kvCacheCost ?? 0);
      entry.total += Number(r.costUsd ?? 0);

      dailyMap.set(date, entry);
    }

    // Build breakdown array
    const breakdown = Array.from(dailyMap.entries()).map(([date, costs]) => ({
      date,
      prefill: Math.round(costs.prefill * 1_000_000) / 1_000_000,
      decode: Math.round(costs.decode * 1_000_000) / 1_000_000,
      kvCache: Math.round(costs.kvCache * 1_000_000) / 1_000_000,
      total: Math.round(costs.total * 1_000_000) / 1_000_000,
    }));

    // Calculate summary
    const totalPrefill = breakdown.reduce((sum, d) => sum + d.prefill, 0);
    const totalDecode = breakdown.reduce((sum, d) => sum + d.decode, 0);
    const totalKvCache = breakdown.reduce((sum, d) => sum + d.kvCache, 0);
    const totalCost = breakdown.reduce((sum, d) => sum + d.total, 0);

    const summary = {
      totalPrefill: Math.round(totalPrefill * 100) / 100,
      totalDecode: Math.round(totalDecode * 100) / 100,
      totalKvCache: Math.round(totalKvCache * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      decodePercentage:
        totalCost > 0 ? Math.round((totalDecode / totalCost) * 1000) / 10 : 0,
    };

    return NextResponse.json({ breakdown, summary });
  } catch (error) {
    return handleApiError(error, 'DecodeBreakdown');
  }
}

export const GET = withTiming(handleGET);
