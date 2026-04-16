// GET /api/appeals — list appeals visible to the caller.
//
// Reviewers see every appeal (for panel assignment + decision);
// buyers see only appeals they filed; operators see only appeals
// against their nodes. Bounded at 200 per request.

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-api-key';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`appeals-list:${auth.userId}`, 120, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { role: true },
  });
  const isReviewer = user?.role === 'ADMIN';

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get('status');
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 50)));

  let rows;
  if (isReviewer) {
    rows = await prisma.disputeAppeal.findMany({
      where: statusFilter ? { status: statusFilter as 'PENDING' | 'UNDER_PANEL_REVIEW' | 'OVERTURNED' | 'UPHELD' | 'WITHDRAWN' } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  } else {
    // Non-reviewers: only appeals they filed or operator-side
    // appeals against nodes they own. The DisputeAppeal → DisputeCase
    // navigation isn't a declared Prisma relation, so we resolve the
    // operator-owned dispute ids in a separate query and filter by
    // disputeCaseId rather than nesting the where.
    const ownedOperators = await prisma.nodeOperator.findMany({
      where: { userId: auth.userId },
      select: { id: true },
    });
    const ops = ownedOperators.map((o) => o.id);

    let disputeIdsForOwnedOperators: string[] = [];
    if (ops.length > 0) {
      const disputes = await prisma.disputeCase.findMany({
        where: { operatorId: { in: ops } },
        select: { id: true },
      });
      disputeIdsForOwnedOperators = disputes.map((d) => d.id);
    }

    rows = await prisma.disputeAppeal.findMany({
      where: {
        OR: [
          { appellantUserId: auth.userId },
          ...(disputeIdsForOwnedOperators.length > 0
            ? [{ disputeCaseId: { in: disputeIdsForOwnedOperators } }]
            : []),
        ],
        ...(statusFilter
          ? { status: statusFilter as 'PENDING' | 'UNDER_PANEL_REVIEW' | 'OVERTURNED' | 'UPHELD' | 'WITHDRAWN' }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  return NextResponse.json({
    appeals: rows.map((r) => ({
      id: r.id,
      disputeCaseId: r.disputeCaseId,
      appellantRole: r.appellantRole,
      status: r.status,
      overturned: r.overturned,
      panelSize: r.panelReviewers.length,
      createdAt: r.createdAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null,
    })),
  });
}
