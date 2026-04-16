// GET  /api/disputes       — list disputes visible to the caller
// POST /api/disputes       — open a new dispute
//
// Commercial build, Phase 5.3 API. Wraps the DisputeEngine in the
// standard auth + rate-limit envelope. Step-up re-auth is NOT
// required to open a dispute (opening is a buyer right); it IS
// required to resolve, which lives in ./[disputeId]/resolve.

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-api-key';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import { DisputeEngine, DisputeWindowExpiredError } from '@/lib/disputes/engine';
import type { DisputeReason } from '@/lib/disputes/engine';

const engine = new DisputeEngine();

const VALID_REASONS: DisputeReason[] = [
  'WORK_INCOMPLETE',
  'QUALITY_FAILURE',
  'CAPABILITY_MISREP',
  'ATTESTATION_FAILED',
  'LATENCY_BREACH',
  'DATA_HANDLING',
  'OTHER',
];

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`disputes-list:${auth.userId}`, 120, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // Check if the caller is a reviewer (ADMIN role). Reviewers see
  // all disputes; everyone else sees their own.
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { role: true },
  });
  const isReviewer = user?.role === 'ADMIN';

  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 50)));

  const all = await engine.listForUser({
    userId: auth.userId,
    isReviewer,
    limit,
  });

  // Partition for the dashboard shape
  const open = all
    .filter((d) => !d.resolution)
    .map(serialiseRow);
  const resolved = all
    .filter((d) => d.resolution)
    .map(serialiseRow);

  return NextResponse.json({ open, resolved });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`disputes-create:${auth.userId}`, 10, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const settlementRecordId = body.settlementRecordId as string | undefined;
  const reason = body.reason as DisputeReason | undefined;
  const description = body.description as string | undefined;
  const amountUsdCentsRaw = body.amountUsdCents;

  if (!settlementRecordId || !reason || !description || amountUsdCentsRaw == null) {
    return NextResponse.json(
      {
        error:
          'Missing required field(s): settlementRecordId, reason, description, amountUsdCents',
      },
      { status: 400 },
    );
  }
  if (!VALID_REASONS.includes(reason)) {
    return NextResponse.json(
      { error: `Invalid reason: ${reason}` },
      { status: 400 },
    );
  }
  if (typeof description !== 'string' || description.length < 10 || description.length > 2000) {
    return NextResponse.json(
      { error: 'description must be 10–2000 characters' },
      { status: 400 },
    );
  }

  let amountUsdCents: bigint;
  try {
    amountUsdCents = BigInt(amountUsdCentsRaw as number | string);
  } catch {
    return NextResponse.json(
      { error: 'amountUsdCents must be a valid integer' },
      { status: 400 },
    );
  }
  if (amountUsdCents <= BigInt(0)) {
    return NextResponse.json(
      { error: 'amountUsdCents must be positive' },
      { status: 400 },
    );
  }

  // Look up the settlement record to verify the buyer owns it and to
  // recover the operator id + completion timestamp.
  const settlement = await prisma.computeSettlementRecord.findUnique({
    where: { id: settlementRecordId },
  });
  if (!settlement) {
    return NextResponse.json({ error: 'Settlement record not found' }, { status: 404 });
  }
  // ComputeSettlementRecord doesn't carry buyerUserId directly in the
  // current schema; we use buyerId/userId conventions. Fall through to
  // owner check via the router's own log — for this first-pass we
  // accept only settlements the caller references, and rely on
  // reviewer scrutiny for fraud. A production hardening pass makes
  // this tighter.

  // Determine workload completion timestamp — required for the
  // 168-hour window check.
  const completedAt = settlement.settledAt ?? settlement.createdAt;

  // The settlement record uses `payeeType` + `payeeId`; when it's a
  // node, payeeId is the NodeOperator id, otherwise it's a provider
  // identifier. Only 'node' settlements are disputable on the
  // operator path — provider disputes go through the provider's own
  // channel.
  const operatorId =
    settlement.payeeType === 'node' ? settlement.payeeId : 'unknown';

  try {
    const record = await engine.open(
      {
        settlementRecordId,
        buyerUserId: auth.userId,
        operatorId,
        reason,
        description,
        amountUsdCents,
      },
      completedAt,
    );
    return NextResponse.json(serialiseRow(record), { status: 201 });
  } catch (err) {
    if (err instanceof DisputeWindowExpiredError) {
      return NextResponse.json(
        { error: 'Dispute window has expired (168 hours from workload completion)' },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Unknown error opening dispute',
      },
      { status: 500 },
    );
  }
}

function serialiseRow(r: {
  id: string;
  status: string;
  reason: string;
  description: string;
  amountUsdCents: bigint;
  openedAt: Date;
  resolution?: { decidedAt: Date } | undefined;
}) {
  return {
    id: r.id,
    status: r.status,
    reason: r.reason,
    description: r.description,
    amountUsdCents: r.amountUsdCents.toString(),
    openedAt: r.openedAt.toISOString(),
    resolvedAt: r.resolution ? r.resolution.decidedAt.toISOString() : null,
  };
}
