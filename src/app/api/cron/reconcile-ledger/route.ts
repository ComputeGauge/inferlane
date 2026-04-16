// GET /api/cron/reconcile-ledger — nightly ledger reconciliation.
//
// Walks every LedgerEntry and verifies debits == credits. Any
// violation is a catastrophic bug in the money layer and is
// alerted at severity=error so oncall pages.
//
// Run nightly at 03:10 UTC via vercel.json cron config.

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret, unauthorizedResponse } from '@/lib/cron-auth';
import { reconcileLedger } from '@/lib/billing/escrow-ledger';
import { logger } from '@/lib/telemetry';

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) return unauthorizedResponse();

  const started = Date.now();
  try {
    const violations = await reconcileLedger();
    const durationMs = Date.now() - started;

    if (violations.length === 0) {
      return NextResponse.json({
        ok: true,
        violations: 0,
        durationMs,
      });
    }

    logger.error('cron.reconcile.violations', {
      count: violations.length,
      durationMs,
    });

    return NextResponse.json({
      ok: false,
      violations: violations.length,
      sample: violations.slice(0, 10).map((v) => ({
        entryId: v.entryId,
        imbalance: v.imbalance.toString(),
      })),
      durationMs,
    }, { status: 500 });
  } catch (err) {
    logger.error('cron.reconcile.failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Reconciliation failed' },
      { status: 500 },
    );
  }
}
