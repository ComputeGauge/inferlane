// POST /api/appeals/:appealId/assign — assign a reviewer panel to an appeal.
//
// Reviewer-only (ADMIN role). Requires step-up scope `dispute.resolve`.

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-api-key';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import { assignPanel } from '@/lib/disputes/appeals';
import { requireStepUp, StepUpRequiredError } from '@/lib/security/step-up';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ appealId: string }> },
) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`appeal-assign:${auth.userId}`, 30, 60_000);
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

  const candidateReviewerIds = body.candidateReviewerIds as string[] | undefined;
  if (!Array.isArray(candidateReviewerIds) || candidateReviewerIds.length === 0) {
    return NextResponse.json(
      { error: 'candidateReviewerIds must be a non-empty array' },
      { status: 400 },
    );
  }

  const { appealId } = await params;

  try {
    const result = await assignPanel(appealId, candidateReviewerIds);
    return NextResponse.json({ assigned: result.assigned, required: result.required });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 400 },
    );
  }
}
