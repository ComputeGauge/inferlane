import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { getCacheStats } from '@/lib/nodes/kv-cache';
import { handleApiError } from '@/lib/api-errors';
import { withTiming } from '@/lib/api-timing';

// ---------------------------------------------------------------------------
// GET /api/kv/stats — Platform-wide KV cache statistics
// ---------------------------------------------------------------------------

async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id as string | undefined;

  // Public access allowed with stricter rate limit; authenticated users get higher limits
  const rateLimitKey = userId ? `kv-stats:${userId}` : `kv-stats:${req.headers.get('x-forwarded-for') ?? 'anonymous'}`;
  const rateLimitMax = userId ? 60 : 20;

  const rl = await rateLimit(rateLimitKey, rateLimitMax, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const stats = await getCacheStats();

    return NextResponse.json(stats);
  } catch (error) {
    return handleApiError(error, 'kv-stats');
  }
}

export const GET = withTiming(handleGET);
