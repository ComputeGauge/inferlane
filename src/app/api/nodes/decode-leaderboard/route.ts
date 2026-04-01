// ---------------------------------------------------------------------------
// API: Decode Leaderboard
// ---------------------------------------------------------------------------
// GET — Ranks online nodes by decode value score (tokens/sec per $/hr).
//       Shows which nodes offer the best decode throughput per dollar.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import { valuateDecodeCapacity } from '@/lib/pricing/decode-pricing';
import { handleApiError } from '@/lib/api-errors';
import { withTiming } from '@/lib/api-timing';

async function handleGET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as Record<string, unknown>).id as string;
    const rl = await rateLimit(`decode-leaderboard:${userId}`, 30, 60_000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Get all online nodes with their memory profiles
    const nodes = await prisma.nodeOperator.findMany({
      where: { isOnline: true },
      include: {
        memoryProfile: true,
      },
    });

    const totalOnlineNodes = nodes.length;

    // Build ranked leaderboard from nodes that have a memory profile with decode data
    const scored = nodes
      .filter((n) => n.memoryProfile && Number(n.memoryProfile.decodeThroughputTps) > 0)
      .map((n) => {
        const profile = n.memoryProfile!;
        const decodeTps = Number(profile.decodeThroughputTps);
        const memoryBandwidthGBs = profile.memoryBandwidthGBs ?? 1000;
        const memTech = profile.memoryTechnology ?? 'UNKNOWN';

        const valuation = valuateDecodeCapacity(decodeTps, memoryBandwidthGBs, memTech);

        // Value score: tokens/sec per $/hr — higher = better deal for consumers
        const valueScore = valuation.hourlyValue > 0
          ? decodeTps / valuation.hourlyValue
          : 0;

        return {
          nodeId: n.id,
          nodeName: n.displayName || `Node ${n.id.slice(0, 8)}`,
          region: n.regions?.[0] ?? 'unknown',
          decodeTps,
          memoryTechnology: memTech,
          memoryBandwidthGBs,
          hourlyValue: Math.round(valuation.hourlyValue * 10000) / 10000,
          valueScore: Math.round(valueScore * 10) / 10,
          benchmarkedAt: profile.lastBenchmarkAt?.toISOString() ?? null,
        };
      })
      .sort((a, b) => b.valueScore - a.valueScore);

    // Assign ranks
    const leaderboard = scored.map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }));

    return NextResponse.json({
      leaderboard,
      totalOnlineNodes,
      nodesWithProfiles: leaderboard.length,
    });
  } catch (error) {
    return handleApiError(error, 'DecodeLeaderboard');
  }
}

export const GET = withTiming(handleGET);
