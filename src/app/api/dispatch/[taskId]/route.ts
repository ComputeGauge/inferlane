// ---------------------------------------------------------------------------
// API: Dispatch Task Status by ID (Stream D1)
// ---------------------------------------------------------------------------
// GET /api/dispatch/[taskId] — Get specific task status by path param
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { withTiming } from '@/lib/api-timing';
import { handleApiError } from '@/lib/api-errors';
import { rateLimit } from '@/lib/rate-limit';
import { authenticateRequest } from '@/lib/auth-api-key';
import { universalDispatcher } from '@/lib/dispatch/universal-dispatch';

// ---------------------------------------------------------------------------
// GET /api/dispatch/[taskId]
// ---------------------------------------------------------------------------

async function handleGET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await rateLimit(`dispatch-task-get:${auth.userId}`, 60, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', remaining: rl.remaining },
      { status: 429 },
    );
  }

  try {
    const { taskId } = await params;

    if (!taskId || typeof taskId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid taskId' },
        { status: 400 },
      );
    }

    const result = await universalDispatcher.getTaskStatus(taskId, auth.userId);
    if (!result) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, 'DispatchTaskGET');
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const GET = withTiming(handleGET);
