import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withTiming } from '@/lib/api-timing';
import { handleApiError } from '@/lib/api-errors';

// ---------------------------------------------------------------------------
// GET /api/nodes/network — Aggregate network health (used by MCP skill)
// ---------------------------------------------------------------------------
// Returns: totalNodes, onlineNodes, avgReputation, totalCapacity, regionDistribution.
// No auth required — this is public network information.
// ---------------------------------------------------------------------------

async function handleGET() {
  try {
    const [totalNodes, onlineNodes, reputationAgg, allNodes] = await Promise.all([
      prisma.nodeOperator.count(),
      prisma.nodeOperator.count({ where: { isOnline: true } }),
      prisma.nodeOperator.aggregate({
        where: { isOnline: true },
        _avg: { reputationScore: true },
      }),
      prisma.nodeOperator.findMany({
        where: { isOnline: true },
        select: {
          regions: true,
          memoryProfile: {
            select: {
              vramCapacityGB: true,
            },
          },
        },
      }),
    ]);

    // Build region distribution
    const regionDistribution: Record<string, number> = {};
    let totalCapacityTFLOPS = 0;

    for (const node of allNodes) {
      for (const region of node.regions) {
        regionDistribution[region] = (regionDistribution[region] || 0) + 1;
      }
      // Rough TFLOPS estimate: 1 TFLOPS per 10 GB VRAM (ballpark for modern GPUs)
      if (node.memoryProfile) {
        totalCapacityTFLOPS += node.memoryProfile.vramCapacityGB / 10;
      }
    }

    return NextResponse.json({
      totalNodes,
      onlineNodes,
      avgReputation: reputationAgg._avg.reputationScore ?? 0,
      totalCapacityTFLOPS: Math.round(totalCapacityTFLOPS * 10) / 10,
      regionDistribution,
    });
  } catch (error) {
    return handleApiError(error, 'NetworkHealth');
  }
}

export const GET = withTiming(handleGET);
