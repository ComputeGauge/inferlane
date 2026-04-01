// ---------------------------------------------------------------------------
// Cron: Process Dispatch Queue (Stream D2)
// ---------------------------------------------------------------------------
// Called by external cron to process queued IMMEDIATE and OPTIMAL_WINDOW
// dispatch tasks. Authenticated via x-cron-secret header.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { asyncTaskRunner } from '@/lib/dispatch/async-runner';
import { verifyCronSecret, unauthorizedResponse } from '@/lib/cron-auth';

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  try {
    const [queueResult, batchResult] = await Promise.all([
      asyncTaskRunner.processQueue(),
      asyncTaskRunner.processBatchQueue(),
    ]);

    return NextResponse.json({
      queue: {
        processed: queueResult.processed,
        failed: queueResult.failed,
      },
      batch: {
        processed: batchResult.processed,
      },
      totalProcessed: queueResult.processed + batchResult.processed,
      totalFailed: queueResult.failed,
    });
  } catch (err) {
    console.error('[Cron: process-dispatch] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
