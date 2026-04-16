// POST /api/appeals/:appealId/decide — panel reviewer decides an appeal.
//
// ADMIN role + step-up `dispute.resolve`. Panel reviewers only
// (the assigned panel is checked inside decideAppeal()).

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-api-key';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import { decideAppeal } from '@/lib/disputes/appeals';
import { requireStepUp, StepUpRequiredError } from '@/lib/security/step-up';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ appealId: string }> },
) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`appeal-decide:${auth.userId}`, 30, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { role: true },
  });
  if (user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    requireStepUp(
      req.headers.get('x-step-up-token'),
      auth.userId,
      'dispute.resolve',
    );
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

  const overturn = Boolean(body.overturn);
  const reasoning = body.reasoning as string | undefined;
  const overrideRefundCentsRaw = body.overrideRefundCents;

  if (!reasoning || reasoning.length < 20) {
    return NextResponse.json(
      { error: 'reasoning must be at least 20 characters' },
      { status: 400 },
    );
  }

  let overrideRefundCents: bigint | undefined;
  if (overrideRefundCentsRaw != null) {
    try {
      overrideRefundCents = BigInt(overrideRefundCentsRaw as number | string);
    } catch {
      return NextResponse.json(
        { error: 'overrideRefundCents must be a valid integer' },
        { status: 400 },
      );
    }
  }

  const { appealId } = await params;

  try {
    const result = await decideAppeal({
      appealId,
      reviewerId: auth.userId,
      overturn,
      overrideRefundCents,
      reasoning,
    });
    return NextResponse.json({ outcome: result.outcome });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 400 },
    );
  }
}
