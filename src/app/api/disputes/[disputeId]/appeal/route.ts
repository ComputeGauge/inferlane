// POST /api/disputes/:disputeId/appeal — file an appeal on a resolved dispute.

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-api-key';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import {
  fileAppeal,
  AppealWindowExpiredError,
  AlreadyAppealedError,
} from '@/lib/disputes/appeals';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ disputeId: string }> },
) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`appeal-file:${auth.userId}`, 10, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { disputeId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const statement = body.statement as string | undefined;
  const newEvidenceUrls = body.newEvidenceUrls as string[] | undefined;
  if (!statement || statement.length < 20 || statement.length > 4000) {
    return NextResponse.json(
      { error: 'statement must be 20-4000 characters' },
      { status: 400 },
    );
  }

  // Determine role — is caller the buyer or the operator owner?
  const dispute = await prisma.disputeCase.findUnique({
    where: { id: disputeId },
  });
  if (!dispute) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let appellantRole: 'BUYER' | 'OPERATOR';
  if (dispute.buyerUserId === auth.userId) {
    appellantRole = 'BUYER';
  } else if (dispute.operatorId) {
    const op = await prisma.nodeOperator.findUnique({
      where: { id: dispute.operatorId },
      select: { userId: true },
    });
    if (op?.userId === auth.userId) {
      appellantRole = 'OPERATOR';
    } else {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  } else {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const result = await fileAppeal({
      disputeCaseId: disputeId,
      appellantUserId: auth.userId,
      appellantRole,
      statement,
      newEvidenceUrls,
    });
    return NextResponse.json({ appeal: result }, { status: 201 });
  } catch (err) {
    if (err instanceof AppealWindowExpiredError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof AlreadyAppealedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
