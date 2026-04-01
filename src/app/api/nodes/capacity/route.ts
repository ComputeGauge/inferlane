import { NextResponse } from 'next/server';
import { capacityOrchestrator } from '@/lib/nodes/orchestrator';

// ---------------------------------------------------------------------------
// GET /api/nodes/capacity — Public network capacity stats
// ---------------------------------------------------------------------------
// Returns current network state: total/online/idle/reserved nodes,
// aggregate decode and prefill throughput, and utilisation percentage.
// No auth required — public network stats.
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const snapshot = await capacityOrchestrator.getCapacitySnapshot();
    return NextResponse.json(snapshot);
  } catch (err) {
    console.error('[Capacity] snapshot error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to get capacity snapshot' },
      { status: 500 },
    );
  }
}
