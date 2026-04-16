import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/stats/public — Public aggregate platform stats
// No auth required. Cached at edge for 30 seconds.
// Returns only aggregate counts — no PII, no per-user data.

export async function GET() {
  try {
    const [requestStats, nodeCount] = await Promise.all([
      // Aggregate proxy request metrics
      prisma.proxyRequest.aggregate({
        _sum: {
          inputTokens: true,
          outputTokens: true,
        },
        _count: true,
      }).catch(() => ({ _sum: { inputTokens: null, outputTokens: null }, _count: 0 })),

      // Total registered node operators
      prisma.nodeOperator.count().catch(() => 0),
    ]);

    return NextResponse.json(
      {
        totalRequests: requestStats._count ?? 0,
        totalInputTokens: Number(requestStats._sum?.inputTokens ?? 0),
        totalOutputTokens: Number(requestStats._sum?.outputTokens ?? 0),
        totalModels: 80,
        totalProviders: 23,
        totalNodes: nodeCount,
        uptimePercent: 99.9,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      },
    );
  } catch {
    // Return static fallbacks if DB is unavailable
    return NextResponse.json({
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalModels: 80,
      totalProviders: 23,
      totalNodes: 0,
      uptimePercent: 99.9,
    });
  }
}
