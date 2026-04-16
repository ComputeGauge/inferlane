// POST /api/fleet/sessions       — start a new fleet session
// GET  /api/fleet/sessions        — list recent sessions (optional ?fleetId, ?status, ?limit)

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-api-key';
import { checkFleetRateLimit } from '@/lib/fleet/api-rate-limit';
import { startSession, listRecentSessions } from '@/lib/fleet/session-aggregator';
import type { FleetRuntime, FleetSessionStatus } from '@/generated/prisma/client';

const VALID_RUNTIMES: FleetRuntime[] = [
  'ANTHROPIC_MANAGED',
  'CLAUDE_AGENT_SDK',
  'CLAUDE_CODE',
  'GOOSE',
  'SWARMCLAW',
  'CUSTOM',
];

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limited = await checkFleetRateLimit('sessions_create', auth);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const runtime = body.runtime as FleetRuntime;
  if (!runtime || !VALID_RUNTIMES.includes(runtime)) {
    return NextResponse.json(
      { error: `runtime is required, must be one of: ${VALID_RUNTIMES.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const session = await startSession({
      userId: auth.userId,
      fleetId: (body.fleetId as string) ?? null,
      runtime,
      externalId: (body.externalId as string) ?? null,
      agentName: (body.agentName as string) ?? null,
      agentVersion: (body.agentVersion as string) ?? null,
      model: (body.model as string) ?? null,
      title: (body.title as string) ?? null,
      metadata: (body.metadata as Record<string, unknown>) ?? null,
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limited = await checkFleetRateLimit('sessions_list', auth);
  if (limited) return limited;

  const url = new URL(req.url);
  const fleetId = url.searchParams.get('fleetId') ?? undefined;
  const status = url.searchParams.get('status') as FleetSessionStatus | null;
  const limitRaw = url.searchParams.get('limit');
  const limit = limitRaw ? Math.min(200, Math.max(1, Number(limitRaw))) : 50;

  const sessions = await listRecentSessions({
    userId: auth.userId,
    fleetId,
    status: status ?? undefined,
    limit,
  });

  return NextResponse.json({ sessions });
}
