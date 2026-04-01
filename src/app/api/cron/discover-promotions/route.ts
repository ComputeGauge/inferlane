// ---------------------------------------------------------------------------
// POST /api/cron/discover-promotions — Crawl for ad-hoc provider promotions
// ---------------------------------------------------------------------------
// Runs every 30 minutes. Analyses accumulated rate limit observations,
// checks status pages, and detects geo/time-based promotion patterns.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { promotionCrawler } from '@/lib/promotions/crawler';
import { verifyCronSecret, unauthorizedResponse } from '@/lib/cron-auth';

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  try {
    const discovered = await promotionCrawler.discoverPromotions();

    return NextResponse.json({
      discovered: discovered.length,
      promotions: discovered.map((p) => ({
        provider: p.provider,
        title: p.title,
        type: p.type,
        confidence: p.confidence,
        multiplier: p.multiplier,
      })),
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Cron] discover-promotions error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Promotion discovery failed' },
      { status: 500 },
    );
  }
}
