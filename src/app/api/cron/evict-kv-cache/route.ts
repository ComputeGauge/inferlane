import { NextRequest, NextResponse } from 'next/server';
import { evictStaleCaches } from '@/lib/nodes/kv-cache';
import { verifyCronSecret, unauthorizedResponse } from '@/lib/cron-auth';

// ---------------------------------------------------------------------------
// Cron: Evict Stale KV Caches — runs every 6 hours
// ---------------------------------------------------------------------------
// Marks expired KV cache entries, downgrades stale WARM→COLD,
// and deletes old expired entries to keep the cache registry clean.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  try {
    const result = await evictStaleCaches();
    return NextResponse.json({
      success: true,
      ...result,
      evictedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Cron] evict-kv-cache error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'KV cache eviction failed' },
      { status: 500 },
    );
  }
}
