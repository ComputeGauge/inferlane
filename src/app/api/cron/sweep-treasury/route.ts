// GET /api/cron/sweep-treasury — daily treasury sweep.
//
// Walks buyer wallet and operator pending balances and moves idle
// working capital into the configured yield vehicle (default:
// Stripe Treasury). The adapter runs in stub mode until
// STRIPE_TREASURY_ENABLED is set, so this cron is safe to leave
// enabled before the contract is in place — it logs the intent
// without moving real money.

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret, unauthorizedResponse } from '@/lib/cron-auth';
import { sweepToYieldVehicle } from '@/lib/treasury';
import { checkReadiness } from '@/lib/treasury/adapters/stripe-treasury';
import { logger } from '@/lib/telemetry';

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) return unauthorizedResponse();

  // GATED: earning yield on customer float is regulated banking / MSB
  // activity. Do not enable this sweep without banking counsel sign-off
  // AND the regulated-entity registrations required in the jurisdictions
  // where customers are served. See _internal/HUMAN_TASKS.md task F1.
  // The hard gate is separate from the downstream stub-mode check below
  // so that even if STRIPE_TREASURY_ENABLED is accidentally set, this
  // cron still refuses to move money without the explicit compliance
  // acknowledgement.
  if (process.env.TREASURY_SWEEP_COMPLIANCE_ACKNOWLEDGED !== '1') {
    return NextResponse.json({
      ok: true,
      swept: false,
      stub: true,
      disabled: true,
      message: 'Treasury sweep disabled pending banking / MSB compliance review. kT credits are not a financial product; customer funds are held by the payment processor.',
    });
  }

  const started = Date.now();
  try {
    // Short-circuit: if the treasury adapter is in stub mode we
    // have nothing to sweep, and retrying doesn't change anything.
    // Distinguishing stub-mode from real failure prevents oncall
    // pager noise during pre-contract development (red-team M-2).
    const readiness = await checkReadiness();
    if (!readiness.enabled || !readiness.envComplete) {
      return NextResponse.json({
        ok: true,
        swept: false,
        stub: true,
        message: `Treasury stub mode: ${readiness.issues.join('; ')}`,
        durationMs: Date.now() - started,
      });
    }

    // Phase F2.1: placeholder sweep amount. The real calculation
    // comes from getCurrentFloat() - minimum operating reserve;
    // wired when Stripe Treasury goes live.
    const result = await sweepToYieldVehicle({
      fromPool: 'BUYER_WALLETS',
      vehicle: 'STRIPE_TREASURY',
      amountUsdCents: BigInt(0),
      reason: 'nightly-sweep',
    });

    return NextResponse.json({
      ok: true,
      swept: result.swept,
      message: result.message,
      durationMs: Date.now() - started,
    });
  } catch (err) {
    logger.error('cron.sweep.failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Sweep failed' },
      { status: 500 },
    );
  }
}
