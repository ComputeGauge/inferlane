import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { lookupKvCache } from '@/lib/nodes/kv-cache';
import { handleApiError } from '@/lib/api-errors';
import { withTiming } from '@/lib/api-timing';

// ---------------------------------------------------------------------------
// GET /api/kv/lookup — Consumer searches for available cached context
// ---------------------------------------------------------------------------

async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await rateLimit(`kv-lookup:${session.user.id}`, 60, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const modelId = req.nextUrl.searchParams.get('modelId');
    const promptContent = req.nextUrl.searchParams.get('promptContent');

    if (!modelId) {
      return NextResponse.json({ error: 'modelId query parameter is required' }, { status: 400 });
    }
    if (!promptContent) {
      return NextResponse.json({ error: 'promptContent query parameter is required' }, { status: 400 });
    }

    const matches = await lookupKvCache(modelId, promptContent);

    return NextResponse.json({ matches });
  } catch (error) {
    return handleApiError(error, 'kv-lookup');
  }
}

export const GET = withTiming(handleGET);
