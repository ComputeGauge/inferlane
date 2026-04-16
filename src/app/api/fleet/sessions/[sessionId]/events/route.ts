// POST /api/fleet/sessions/:sessionId/events  — ingest an event for a session
//
// This is the hot path for agent runtimes — every tool call, every model
// response, every status change arrives here. Keep it fast.

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-api-key';
import { checkFleetRateLimit } from '@/lib/fleet/api-rate-limit';
import { prisma } from '@/lib/db';
import { recordEvent, checkFleetBudget } from '@/lib/fleet/session-aggregator';
import { withSpan } from '@/lib/telemetry';
import type { FleetEventType } from '@/generated/prisma/client';

// Rate limiting is centralized in src/lib/fleet/api-rate-limit.ts. The
// 'session_events' bucket is the largest (300/min per API key) because this
// endpoint is the agent-hooks hot path — every tool call, every model
// response, every status change arrives here.

const VALID_EVENT_TYPES: FleetEventType[] = [
  'SESSION_START',
  'SESSION_END',
  'STATUS_ACTIVE',
  'STATUS_IDLE',
  'AGENT_MESSAGE',
  'USER_MESSAGE',
  'TOOL_USE',
  'TOOL_RESULT',
  'WEB_SEARCH',
  'MODEL_CALL',
  'ERROR',
  'CUSTOM',
];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Rate limit BEFORE any DB work so runaway clients can't chew through Neon
  // connections. Per-key bucket via the shared helper.
  const limited = await checkFleetRateLimit('session_events', auth);
  if (limited) return limited;

  const { sessionId } = await params;

  return withSpan(
    'api.fleet.events.post',
    { sessionId, userId: auth.userId },
    async () => handleEventsPost(req, auth, sessionId),
  );
}

async function handleEventsPost(
  req: NextRequest,
  auth: { userId: string; apiKeyId?: string },
  sessionId: string,
) {

  // Ownership check — agents can only post to their own sessions
  const session = await prisma.fleetSession.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true, fleetId: true },
  });
  if (!session || session.userId !== auth.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Support batched events: either a single event body or { events: [...] }
  const events = Array.isArray(body.events)
    ? (body.events as Record<string, unknown>[])
    : [body];

  const created = [];
  for (const ev of events) {
    const type = ev.type as FleetEventType;
    if (!type || !VALID_EVENT_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid event type: ${type}. Must be one of: ${VALID_EVENT_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    try {
      const event = await recordEvent({
        sessionId,
        type,
        payload: (ev.payload as Record<string, unknown>) ?? undefined,
        model: ev.model as string | undefined,
        inputTokens: Number(ev.inputTokens ?? 0),
        outputTokens: Number(ev.outputTokens ?? 0),
        cachedTokens: Number(ev.cachedTokens ?? 0),
        activeRuntimeMs: Number(ev.activeRuntimeMs ?? 0),
        idleRuntimeMs: Number(ev.idleRuntimeMs ?? 0),
        webSearchCount: Number(ev.webSearchCount ?? 0),
      });
      created.push(event);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json({ error: message, eventsAccepted: created.length }, { status: 500 });
    }
  }

  // Budget check (fire-and-forget — don't block the response)
  if (session.fleetId) {
    checkFleetBudget(session.fleetId).catch(() => {});
  }

  return NextResponse.json({ events: created, count: created.length }, { status: 201 });
}
