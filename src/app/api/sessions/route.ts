import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { withTiming } from '@/lib/api-timing';
import { handleApiError } from '@/lib/api-errors';
import { sessionManager } from '@/lib/dispatch/session-manager';

// POST /api/sessions — Create a new cross-provider conversation session
async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  try {
    let metadata: Record<string, unknown> | undefined;
    try {
      const body = await req.json();
      metadata = body.metadata;
    } catch {
      // No body or invalid JSON — that's fine, metadata is optional
    }

    const newSession = await sessionManager.createSession(userId, metadata);
    return NextResponse.json(newSession, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'CreateSession');
  }
}

// GET /api/sessions — List user's recent sessions
async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const limitParam = req.nextUrl.searchParams.get('limit');
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10) || 20), 100) : 20;

  try {
    const sessions = await sessionManager.getSessionHistory(userId, limit);
    return NextResponse.json({ sessions });
  } catch (error) {
    return handleApiError(error, 'ListSessions');
  }
}

export const POST = withTiming(handlePOST);
export const GET = withTiming(handleGET);
