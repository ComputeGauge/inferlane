import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';
import { handleApiError } from '@/lib/api-errors';

// ---------------------------------------------------------------------------
// POST /api/nodes/heartbeat — Lightweight node heartbeat (keep-alive)
// ---------------------------------------------------------------------------
// Nodes send heartbeats every 10-15 seconds to stay in the dispatch pool.
// No heavy auth — just verify the nodeId exists. Rate limited by nodeId.
// Body: { nodeId: string }
// Returns: { ok: true, nextHeartbeatMs: 15000 }
// ---------------------------------------------------------------------------

async function handlePOST(req: NextRequest) {
  try {
    let body: { nodeId?: string } = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { nodeId } = body;
    if (!nodeId || typeof nodeId !== 'string') {
      return NextResponse.json({ error: 'nodeId is required' }, { status: 400 });
    }

    // Rate limit by nodeId: 10 heartbeats per minute
    const rl = await rateLimit(`heartbeat:${nodeId}`, 10, 60_000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Verify nodeId exists
    const node = await prisma.nodeOperator.findUnique({
      where: { id: nodeId },
      select: { id: true },
    });

    if (!node) {
      return NextResponse.json({ error: 'Unknown node ID' }, { status: 404 });
    }

    // Update heartbeat
    await prisma.nodeOperator.update({
      where: { id: nodeId },
      data: {
        isOnline: true,
        lastSeenAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      nextHeartbeatMs: 15_000,
    });
  } catch (error) {
    return handleApiError(error, 'NodeHeartbeat');
  }
}

export const POST = withTiming(handlePOST);
