import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { initiateTransfer } from '@/lib/nodes/kv-cache';
import { handleApiError } from '@/lib/api-errors';
import { withTiming } from '@/lib/api-timing';

// ---------------------------------------------------------------------------
// POST /api/kv/transfer — Initiate P2P cache transfer between nodes
// ---------------------------------------------------------------------------

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await rateLimit(`kv-transfer:${session.user.id}`, 60, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { cacheEntryId, targetNodeId } = body;

    if (!cacheEntryId || typeof cacheEntryId !== 'string') {
      return NextResponse.json({ error: 'cacheEntryId is required' }, { status: 400 });
    }
    if (!targetNodeId || typeof targetNodeId !== 'string') {
      return NextResponse.json({ error: 'targetNodeId is required' }, { status: 400 });
    }

    const result = await initiateTransfer(cacheEntryId, targetNodeId);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, 'kv-transfer');
  }
}

export const POST = withTiming(handlePOST);
