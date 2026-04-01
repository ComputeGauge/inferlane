import { NextRequest, NextResponse } from 'next/server';
import { expireOrders } from '@/lib/trading/order-book';
import { verifyCronSecret, unauthorizedResponse } from '@/lib/cron-auth';

// ---------------------------------------------------------------------------
// Cron: Expire Stale Orders — runs every 15 minutes
// ---------------------------------------------------------------------------
// Marks OPEN/PARTIALLY_FILLED orders as EXPIRED when their expiresAt
// timestamp has passed. Prevents stale liquidity in the order book.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  try {
    const expiredCount = await expireOrders();
    return NextResponse.json({
      success: true,
      expiredCount,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Cron] expire-orders error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Order expiry failed' },
      { status: 500 },
    );
  }
}
