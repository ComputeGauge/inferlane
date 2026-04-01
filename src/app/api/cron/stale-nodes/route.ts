import { NextRequest, NextResponse } from 'next/server';
import { markStaleNodesOffline } from '@/lib/nodes/reliability';
import { verifyCronSecret, unauthorizedResponse } from '@/lib/cron-auth';

// ---------------------------------------------------------------------------
// Cron: Mark Stale Nodes Offline — runs every 2 minutes
// ---------------------------------------------------------------------------
// Nodes that haven't sent a heartbeat within 60 seconds are marked offline.
// This prevents dispatching to dead/unresponsive nodes.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  try {
    const markedOffline = await markStaleNodesOffline(60);
    return NextResponse.json({
      success: true,
      markedOffline,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Cron] stale-nodes error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Stale node check failed' },
      { status: 500 },
    );
  }
}
