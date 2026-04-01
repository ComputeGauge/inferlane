import { NextRequest, NextResponse } from 'next/server';
import { updateIndices } from '@/lib/trading/indices';
import { verifyCronSecret, unauthorizedResponse } from '@/lib/cron-auth';

// ---------------------------------------------------------------------------
// Cron: Update Compute Price Indices — runs every hour
// ---------------------------------------------------------------------------
// Recalculates IL-FRONTIER, IL-STANDARD, IL-ECONOMY, IL-OPENWEIGHT using
// VWAP from the last 24h of order fills. Creates index snapshots for
// historical charting and futures settlement.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  try {
    const result = await updateIndices();
    return NextResponse.json({
      success: true,
      updated: result.updated,
      snapshots: result.snapshots,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Cron] update-indices error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Index update failed' },
      { status: 500 },
    );
  }
}
