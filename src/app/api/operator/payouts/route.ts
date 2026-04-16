// GET /api/operator/payouts — operator payout summary + history.
//
// Returns the caller's pending balance (from the ledger projection),
// recent NodePayout rows, and a rough estimate of when the next
// cycle will fire.

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-api-key';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import { getAccountBalance } from '@/lib/billing/escrow-ledger';

// Weekly Monday 18:30 UTC — matches the vercel.json schedule for
// /api/cron/execute-payouts.
function nextMondayAt1830UTC(): Date {
  const now = new Date();
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      18,
      30,
      0,
      0,
    ),
  );
  // Advance to the next Monday
  const day = next.getUTCDay();  // 0 = Sun
  const daysToMonday = (1 - day + 7) % 7;
  next.setUTCDate(next.getUTCDate() + daysToMonday);
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 7);
  }
  return next;
}

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`operator-payouts:${auth.userId}`, 60, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const operator = await prisma.nodeOperator.findUnique({
    where: { userId: auth.userId },
    select: { id: true, payoutEnabled: true, stripeAccountId: true },
  });
  if (!operator) {
    return NextResponse.json(
      {
        isOperator: false,
        message: 'You are not a registered operator',
      },
      { status: 200 },
    );
  }

  const [pending, recent] = await Promise.all([
    getAccountBalance({
      account: 'OPERATOR_PENDING',
      subjectOperatorId: operator.id,
      positiveDirection: 'CREDIT',
    }),
    prisma.nodePayout.findMany({
      where: { nodeOperatorId: operator.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  return NextResponse.json({
    isOperator: true,
    operatorId: operator.id,
    payoutEnabled: operator.payoutEnabled,
    hasStripeAccount: Boolean(operator.stripeAccountId),
    pendingUsdCents: pending.toString(),
    minimumPayoutUsdCents: '5000',
    nextCycleAt: nextMondayAt1830UTC().toISOString(),
    payouts: recent.map((p) => ({
      id: p.id,
      amount: p.amount.toString(),
      status: p.status,
      periodStart: p.periodStart.toISOString(),
      periodEnd: p.periodEnd.toISOString(),
      createdAt: p.createdAt.toISOString(),
      processedAt: p.processedAt?.toISOString() ?? null,
      stripeTransferId: p.stripeTransferId,
    })),
  });
}
