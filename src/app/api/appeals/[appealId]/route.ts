// GET /api/appeals/:appealId — appeal detail.

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-api-key';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ appealId: string }> },
) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`appeal-get:${auth.userId}`, 120, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { appealId } = await params;

  const appeal = await prisma.disputeAppeal.findUnique({
    where: { id: appealId },
  });
  if (!appeal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Authorisation: appellant, operator owner, or ADMIN
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { role: true },
  });
  const isReviewer = user?.role === 'ADMIN';

  if (!isReviewer) {
    const dispute = await prisma.disputeCase.findUnique({
      where: { id: appeal.disputeCaseId },
      select: { buyerUserId: true, operatorId: true },
    });
    let allowed = appeal.appellantUserId === auth.userId;
    if (!allowed && dispute?.operatorId) {
      const op = await prisma.nodeOperator.findUnique({
        where: { id: dispute.operatorId },
        select: { userId: true },
      });
      if (op?.userId === auth.userId) allowed = true;
    }
    if (!allowed && dispute?.buyerUserId === auth.userId) allowed = true;
    if (!allowed) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const dispute = await prisma.disputeCase.findUnique({
    where: { id: appeal.disputeCaseId },
  });

  return NextResponse.json({
    appeal: {
      id: appeal.id,
      disputeCaseId: appeal.disputeCaseId,
      appellantRole: appeal.appellantRole,
      statement: appeal.statement,
      newEvidenceUrls: appeal.newEvidenceUrls,
      status: appeal.status,
      panelReviewers: appeal.panelReviewers,
      overturned: appeal.overturned,
      overrideRefundCents: appeal.overrideRefundCents?.toString() ?? null,
      decidedAt: appeal.decidedAt?.toISOString() ?? null,
      decidedByUserId: appeal.decidedByUserId,
      reasoning: appeal.reasoning,
      createdAt: appeal.createdAt.toISOString(),
    },
    dispute: dispute
      ? {
          id: dispute.id,
          reason: dispute.reason,
          status: dispute.status,
          amountUsdCents: dispute.amountUsdCents.toString(),
          originalOutcome: dispute.outcome,
          originalRefundCents: dispute.refundCents?.toString() ?? null,
          originalReasoning: dispute.reasoning,
        }
      : null,
  });
}
