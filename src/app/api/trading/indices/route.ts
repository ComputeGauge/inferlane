import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';
import { getCurrentIndices, getIndexHistory } from '@/lib/trading/indices';

// ---------------------------------------------------------------------------
// GET /api/trading/indices — current compute price indices
// GET /api/trading/indices?history=IL-FRONTIER&days=30 — historical data
// ---------------------------------------------------------------------------

async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const rl = await rateLimit(`indices-read:${userId}`, 60, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const historyIndex = req.nextUrl.searchParams.get('history');
  const days = parseInt(req.nextUrl.searchParams.get('days') || '30', 10);

  if (historyIndex) {
    const history = await getIndexHistory(historyIndex, Math.min(365, days));
    return NextResponse.json({ index: historyIndex, days, history });
  }

  const indices = await getCurrentIndices();
  return NextResponse.json({ indices });
}

export const GET = withTiming(handleGET);
