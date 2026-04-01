import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withTiming } from '@/lib/api-timing';
import { handleApiError } from '@/lib/api-errors';

// ---------------------------------------------------------------------------
// GET /api/nodes/status — Public list of online nodes (used by MCP skill)
// ---------------------------------------------------------------------------
// Returns all online nodes with: id, displayName, isOnline, reputationScore,
// avgLatencyMs, regions, capabilities, lastSeenAt.
// No auth required — this is public network information.
// ---------------------------------------------------------------------------

async function handleGET() {
  try {
    const nodes = await prisma.nodeOperator.findMany({
      where: { isOnline: true },
      select: {
        id: true,
        displayName: true,
        isOnline: true,
        reputationScore: true,
        avgLatencyMs: true,
        regions: true,
        capabilities: true,
        lastSeenAt: true,
      },
      orderBy: { reputationScore: 'desc' },
    });

    return NextResponse.json(
      nodes.map((n) => ({
        id: n.id,
        displayName: n.displayName,
        isOnline: n.isOnline,
        reputationScore: n.reputationScore,
        avgLatencyMs: n.avgLatencyMs,
        regions: n.regions,
        capabilities: n.capabilities,
        lastSeenAt: n.lastSeenAt?.toISOString() ?? null,
      })),
    );
  } catch (error) {
    return handleApiError(error, 'NodeStatus');
  }
}

export const GET = withTiming(handleGET);
