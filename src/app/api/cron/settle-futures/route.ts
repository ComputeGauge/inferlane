import { NextRequest, NextResponse } from 'next/server';
import { settleExpiredContracts } from '@/lib/trading/futures';
import { verifyCronSecret, unauthorizedResponse } from '@/lib/cron-auth';

// ---------------------------------------------------------------------------
// Cron: Settle Expired Futures — runs daily at 00:05 UTC
// ---------------------------------------------------------------------------
// Settles FORWARD, OPTION_CALL, and OPTION_PUT contracts whose delivery
// date has passed. Settlement price = current IL index value for the
// contract's quality tier. PnL calculated and applied.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  try {
    const settledCount = await settleExpiredContracts();
    return NextResponse.json({
      success: true,
      settledCount,
      settledAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Cron] settle-futures error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Futures settlement failed' },
      { status: 500 },
    );
  }
}
