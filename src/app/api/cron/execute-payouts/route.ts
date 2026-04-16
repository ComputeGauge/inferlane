// GET /api/cron/execute-payouts — weekly operator payout cycle.
//
// Commercial build, Phase F3.2. Runs weekly and walks every operator
// with an OPERATOR_PENDING balance >= $50, executing the payout flow
// for each one. Bounded at 100 payouts per run to keep the cron
// invocation well under Vercel's 15-min limit.

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret, unauthorizedResponse } from '@/lib/cron-auth';
import { findPayoutCandidates, executePayout } from '@/lib/payouts/operator-payouts';
import { logger } from '@/lib/telemetry';

const MAX_PAYOUTS_PER_RUN = 100;

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) return unauthorizedResponse();

  const started = Date.now();
  const candidates = (await findPayoutCandidates()).slice(0, MAX_PAYOUTS_PER_RUN);

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const result = await executePayout(candidate);
    switch (result.status) {
      case 'SUCCESS':
        succeeded++;
        break;
      case 'TRANSFER_FAILED':
        failed++;
        break;
      case 'BELOW_MINIMUM':
      case 'NO_STRIPE_ACCOUNT':
        skipped++;
        break;
    }
  }

  logger.info('cron.payouts.complete', {
    candidates: candidates.length,
    succeeded,
    failed,
    skipped,
    durationMs: Date.now() - started,
  });

  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    succeeded,
    failed,
    skipped,
    durationMs: Date.now() - started,
  });
}
