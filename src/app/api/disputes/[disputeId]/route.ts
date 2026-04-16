// GET /api/disputes/:disputeId — fetch a dispute with evidence

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-api-key';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import { DisputeEngine } from '@/lib/disputes/engine';

const engine = new DisputeEngine();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ disputeId: string }> },
) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`disputes-get:${auth.userId}`, 120, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { disputeId } = await params;
  const record = await engine.get(disputeId);
  if (!record) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Authorisation: caller must be the buyer, the operator-owner, or
  // an ADMIN/reviewer.
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { role: true },
  });
  const isReviewer = user?.role === 'ADMIN';

  if (!isReviewer) {
    const raw = await prisma.disputeCase.findUnique({
      where: { id: disputeId },
      select: { buyerUserId: true, operatorId: true },
    });
    if (!raw) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const ownsAsBuyer = raw.buyerUserId === auth.userId;
    let ownsAsOperator = false;
    if (raw.operatorId) {
      const op = await prisma.nodeOperator.findUnique({
        where: { id: raw.operatorId },
        select: { userId: true },
      });
      ownsAsOperator = op?.userId === auth.userId;
    }
    if (!ownsAsBuyer && !ownsAsOperator) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  return NextResponse.json({
    dispute: {
      id: record.id,
      status: record.status,
      reason: record.reason,
      description: record.description,
      amountUsdCents: record.amountUsdCents.toString(),
      openedAt: record.openedAt.toISOString(),
      evidence: record.evidence.map((e) => ({
        id: e.id,
        kind: e.kind,
        submittedBy: e.submittedBy,
        submittedAt: e.submittedAt.toISOString(),
        contentHash: e.contentHash,
        contentUrl: e.contentUrl ?? null,
      })),
      resolution: record.resolution
        ? {
            decidedBy: record.resolution.decidedBy,
            decidedAt: record.resolution.decidedAt.toISOString(),
            outcome: record.resolution.outcome,
            refundCents: record.resolution.refundCents.toString(),
            reasoning: record.resolution.reasoning,
            drawdownFromReserve: record.resolution.drawdownFromReserve,
          }
        : null,
    },
  });
}
