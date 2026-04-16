// GET    /api/fleet/sessions/:sessionId   — fetch session + totals
// PATCH  /api/fleet/sessions/:sessionId   — update status (end session)

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-api-key';
import { checkFleetRateLimit } from '@/lib/fleet/api-rate-limit';
import { prisma } from '@/lib/db';
import { endSession, getSessionTotalCost } from '@/lib/fleet/session-aggregator';
import type { FleetSessionStatus } from '@/generated/prisma/client';

const VALID_STATUSES: FleetSessionStatus[] = [
  'RUNNING',
  'IDLE',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
];

async function ensureOwnedByUser(sessionId: string, userId: string) {
  const session = await prisma.fleetSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) return null;
  return session;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limited = await checkFleetRateLimit('session_read', auth);
  if (limited) return limited;

  const { sessionId } = await params;
  const session = await ensureOwnedByUser(sessionId, auth.userId);
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const totals = await getSessionTotalCost(sessionId);

  return NextResponse.json({ session, totals });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limited = await checkFleetRateLimit('session_update', auth);
  if (limited) return limited;

  const { sessionId } = await params;
  const session = await ensureOwnedByUser(sessionId, auth.userId);
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const status = body.status as FleetSessionStatus;
  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `status is required, must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 },
    );
  }

  // If transitioning to a terminal state, call endSession so endedAt is set
  const isTerminal = status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED';
  const updated = isTerminal
    ? await endSession(sessionId, status)
    : await prisma.fleetSession.update({ where: { id: sessionId }, data: { status } });

  return NextResponse.json({ session: updated });
}
