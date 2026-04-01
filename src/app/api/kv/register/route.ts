import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { registerKvCache } from '@/lib/nodes/kv-cache';
import { handleApiError } from '@/lib/api-errors';
import { withTiming } from '@/lib/api-timing';

// ---------------------------------------------------------------------------
// POST /api/kv/register — Node registers a cached context
// ---------------------------------------------------------------------------

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await rateLimit(`kv-register:${session.user.id}`, 60, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { nodeOperatorId, promptContent, modelId, tokenRangeStart, tokenRangeEnd, cacheSizeGB, ttlHours, pricePerGBHour } = body;

    if (!nodeOperatorId || typeof nodeOperatorId !== 'string') {
      return NextResponse.json({ error: 'nodeOperatorId is required' }, { status: 400 });
    }
    if (!promptContent || typeof promptContent !== 'string') {
      return NextResponse.json({ error: 'promptContent is required' }, { status: 400 });
    }
    if (!modelId || typeof modelId !== 'string') {
      return NextResponse.json({ error: 'modelId is required' }, { status: 400 });
    }
    if (typeof tokenRangeEnd !== 'number' || tokenRangeEnd <= 0) {
      return NextResponse.json({ error: 'tokenRangeEnd must be a positive number' }, { status: 400 });
    }
    if (typeof cacheSizeGB !== 'number' || cacheSizeGB <= 0) {
      return NextResponse.json({ error: 'cacheSizeGB must be a positive number' }, { status: 400 });
    }

    const result = await registerKvCache({
      nodeOperatorId,
      promptContent,
      modelId,
      tokenRangeStart,
      tokenRangeEnd,
      cacheSizeGB,
      ttlHours,
      pricePerGBHour,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'kv-register');
  }
}

export const POST = withTiming(handlePOST);
