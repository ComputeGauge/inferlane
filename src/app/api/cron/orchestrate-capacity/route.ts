import { NextRequest, NextResponse } from 'next/server';
import { capacityOrchestrator } from '@/lib/nodes/orchestrator';
import { verifyCronSecret, unauthorizedResponse } from '@/lib/cron-auth';

// ---------------------------------------------------------------------------
// Cron: Orchestrate Capacity — runs every 5 minutes
// ---------------------------------------------------------------------------
// 1. Matches idle nodes to queued scheduled prompts
// 2. Pre-warms nodes for upcoming jobs (next 15 minutes)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  try {
    // 1. Allocate idle nodes to queued prompts
    const allocations = await capacityOrchestrator.allocateToScheduledWork();

    // 2. Pre-warm nodes for upcoming jobs
    const warmResult = await capacityOrchestrator.preWarmNodes();

    // 3. Snapshot for logging
    const snapshot = await capacityOrchestrator.getCapacitySnapshot();

    return NextResponse.json({
      success: true,
      allocations: {
        total: allocations.length,
        dispatched: allocations.filter((a) => a.dispatched).length,
        failed: allocations.filter((a) => !a.dispatched).length,
        details: allocations,
      },
      preWarm: warmResult,
      capacity: snapshot,
      orchestratedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Cron] orchestrate-capacity error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Capacity orchestration failed' },
      { status: 500 },
    );
  }
}
