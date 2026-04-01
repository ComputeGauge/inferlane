import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withTiming } from '@/lib/api-timing';

// POST /api/credits/allocate — internal cron endpoint, protected by X-Cron-Secret
async function handlePOST(req: NextRequest) {
  const cronSecret = req.headers.get('X-Cron-Secret');
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { userId, amount, periodStart, periodEnd } = body;

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }

  if (!periodStart || !periodEnd) {
    return NextResponse.json({ error: 'periodStart and periodEnd are required' }, { status: 400 });
  }

  const parsedPeriodStart = new Date(periodStart);
  const parsedPeriodEnd = new Date(periodEnd);

  if (isNaN(parsedPeriodStart.getTime()) || isNaN(parsedPeriodEnd.getTime())) {
    return NextResponse.json({ error: 'periodStart and periodEnd must be valid dates' }, { status: 400 });
  }

  // Upsert the credit balance: reset allocation, available; zero out delegated/listed
  const balance = await prisma.creditBalance.upsert({
    where: { userId },
    create: {
      userId,
      totalAllocated: amount,
      available: amount,
      delegatedToPool: 0,
      listedOnMarket: 0,
      earned: 0,
      autoDelegate: false,
      autoDelegatePct: 0,
      periodStart: parsedPeriodStart,
      periodEnd: parsedPeriodEnd,
    },
    update: {
      totalAllocated: amount,
      available: amount,
      delegatedToPool: 0,
      listedOnMarket: 0,
      periodStart: parsedPeriodStart,
      periodEnd: parsedPeriodEnd,
    },
  });

  // Record the ALLOCATION transaction
  await prisma.creditTransaction.create({
    data: {
      userId,
      type: 'ALLOCATION',
      amount,
      balanceBefore: 0,
      balanceAfter: amount,
      description: `Credit allocation for period ${parsedPeriodStart.toISOString()} - ${parsedPeriodEnd.toISOString()}`,
    },
  });

  // If user has auto-delegation enabled, delegate the configured percentage
  if (balance.autoDelegate && Number(balance.autoDelegatePct) > 0) {
    const delegateAmount = Math.floor((amount * Number(balance.autoDelegatePct)) / 100);

    if (delegateAmount > 0) {
      const activePoolCycle = await prisma.poolCycle.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      });

      if (activePoolCycle) {
        await prisma.$transaction(async (tx) => {
          await tx.creditBalance.update({
            where: { userId },
            data: {
              available: { decrement: delegateAmount },
              delegatedToPool: { increment: delegateAmount },
            },
          });

          await tx.poolDelegation.upsert({
            where: {
              userId_poolCycleId: { userId, poolCycleId: activePoolCycle.id },
            },
            create: {
              userId,
              poolCycleId: activePoolCycle.id,
              amount: delegateAmount,
            },
            update: {
              amount: delegateAmount,
            },
          });

          await tx.creditTransaction.create({
            data: {
              userId,
              type: 'POOL_DELEGATE',
              amount: delegateAmount,
              balanceBefore: amount,
              balanceAfter: amount - delegateAmount,
              poolCycleId: activePoolCycle.id,
              description: `Auto-delegated ${delegateAmount} credits (${Number(balance.autoDelegatePct)}%) to pool cycle ${activePoolCycle.id}`,
            },
          });
        });

        return NextResponse.json({
          userId,
          totalAllocated: amount,
          available: amount - delegateAmount,
          delegatedToPool: delegateAmount,
          autoDelegated: true,
          autoDelegateAmount: delegateAmount,
        }, { status: 201 });
      }
    }
  }

  return NextResponse.json({
    userId,
    totalAllocated: amount,
    available: amount,
    delegatedToPool: 0,
    autoDelegated: false,
  }, { status: 201 });
}

export const POST = withTiming(handlePOST);
