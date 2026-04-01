import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { withTiming } from '@/lib/api-timing';
import { handleApiError } from '@/lib/api-errors';
import { sessionManager } from '@/lib/dispatch/session-manager';

// GET /api/sessions/[sessionId] — Get session by ID (ownership verified)
async function handleGET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (authSession.user as Record<string, unknown>).id as string;
  const { sessionId } = await params;

  try {
    const session = await sessionManager.getSession(sessionId, userId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    return NextResponse.json(session);
  } catch (error) {
    return handleApiError(error, 'GetSession');
  }
}

// DELETE /api/sessions/[sessionId] — Delete session file (ownership verified)
async function handleDELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (authSession.user as Record<string, unknown>).id as string;
  const { sessionId } = await params;

  try {
    const deleted = await sessionManager.deleteSession(sessionId, userId);
    if (!deleted) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'DeleteSession');
  }
}

export const GET = withTiming(handleGET);
export const DELETE = withTiming(handleDELETE);
