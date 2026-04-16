// POST /api/disputes/:disputeId/resolve — reviewer resolves a dispute.
//
// Requires:
//   1. Authenticated user
//   2. User.role === 'ADMIN' (reviewer)
//   3. Step-up token with scope `dispute.resolve` in X-Step-Up-Token
//   4. Body with { outcome, refundCents, reasoning }

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-api-key';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import { DisputeEngine } from '@/lib/disputes/engine';
import { requireStepUp, StepUpRequiredError } from '@/lib/security/step-up';

const engine = new DisputeEngine();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ disputeId: string }> },
) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`disputes-resolve:${auth.userId}`, 30, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // Reviewer gate — only ADMINs may resolve disputes.
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { role: true },
  });
  if (user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Step-up gate — the ADMIN must have a recent re-authentication.
  const stepUpToken = req.headers.get('x-step-up-token');
  try {
    requireStepUp(stepUpToken, auth.userId, 'dispute.resolve');
  } catch (err) {
    if (err instanceof StepUpRequiredError) {
      return NextResponse.json(
        { error: 'Step-up authentication required', scope: err.scope },
        { status: 401 },
      );
    }
    throw err;
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const outcome = body.outcome as 'BUYER' | 'OPERATOR' | 'SPLIT' | undefined;
  const refundCentsRaw = body.refundCents;
  const reasoning = body.reasoning as string | undefined;

  if (!outcome || !['BUYER', 'OPERATOR', 'SPLIT'].includes(outcome)) {
    return NextResponse.json(
      { error: 'outcome must be BUYER | OPERATOR | SPLIT' },
      { status: 400 },
    );
  }
  if (refundCentsRaw == null || !reasoning || reasoning.length < 10) {
    return NextResponse.json(
      { error: 'refundCents and reasoning (>=10 chars) required' },
      { status: 400 },
    );
  }

  let refundCents: bigint;
  try {
    refundCents = BigInt(refundCentsRaw as number | string);
  } catch {
    return NextResponse.json(
      { error: 'refundCents must be a valid integer' },
      { status: 400 },
    );
  }
  if (refundCents < BigInt(0)) {
    return NextResponse.json({ error: 'refundCents must be >= 0' }, { status: 400 });
  }

  const { disputeId } = await params;

  // Load the dispute + its settlement to feed the engine.
  const dispute = await prisma.disputeCase.findUnique({
    where: { id: disputeId },
  });
  if (!dispute) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (
    dispute.status === 'RESOLVED_BUYER' ||
    dispute.status === 'RESOLVED_OPERATOR' ||
    dispute.status === 'RESOLVED_SPLIT' ||
    dispute.status === 'CANCELLED'
  ) {
    return NextResponse.json(
      { error: 'Dispute is already in a terminal state' },
      { status: 409 },
    );
  }

  if (refundCents > dispute.amountUsdCents) {
    return NextResponse.json(
      { error: 'refundCents cannot exceed dispute amount' },
      { status: 400 },
    );
  }

  try {
    const resolution = await engine.resolve({
      disputeId,
      settlementRecordId: dispute.settlementRecordId,
      buyerUserId: dispute.buyerUserId,
      reviewerId: auth.userId,
      outcome,
      refundCents,
      totalWorkloadCents: dispute.amountUsdCents,
      reasoning,
    });

    return NextResponse.json({
      resolution: {
        decidedBy: resolution.decidedBy,
        decidedAt: resolution.decidedAt.toISOString(),
        outcome: resolution.outcome,
        refundCents: resolution.refundCents.toString(),
        reasoning: resolution.reasoning,
        drawdownFromReserve: resolution.drawdownFromReserve,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error resolving dispute' },
      { status: 500 },
    );
  }
}
