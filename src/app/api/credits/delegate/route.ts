import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';
import { handleApiError } from '@/lib/api-errors';

// POST /api/credits/delegate — delegate/recall credits or configure auto-delegation
async function handlePOST(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  // Rate limit: 10 requests per minute
  const { success: rateLimitOk } = await rateLimit(`credit-delegate:${userId}`, 10, 60 * 1000);
  if (!rateLimitOk) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action } = body;

  if (!action || !['delegate', 'recall', 'configure'].includes(action)) {
    return NextResponse.json(
      { error: 'action must be one of: delegate, recall, configure' },
      { status: 400 },
    );
  }

  // --- Configure auto-delegation preferences ---
  if (action === 'configure') {
    const { autoDelegate, autoDelegatePct } = body;

    if (typeof autoDelegate !== 'boolean') {
      return NextResponse.json({ error: 'autoDelegate must be a boolean' }, { status: 400 });
    }

    if (typeof autoDelegatePct !== 'number' || autoDelegatePct < 0 || autoDelegatePct > 100) {
      return NextResponse.json({ error: 'autoDelegatePct must be a number between 0 and 100' }, { status: 400 });
    }

    const balance = await prisma.creditBalance.findUnique({ where: { userId } });
    if (!balance) {
      return NextResponse.json({ error: 'No credit balance found' }, { status: 404 });
    }

    const updated = await prisma.creditBalance.update({
      where: { userId },
      data: { autoDelegate, autoDelegatePct },
    });

    return NextResponse.json({
      autoDelegate: updated.autoDelegate,
      autoDelegatePct: Number(updated.autoDelegatePct),
    });
  }

  // --- Delegate or Recall ---
  const { amount } = body;

  if (typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }

  const balance = await prisma.creditBalance.findUnique({ where: { userId } });
  if (!balance) {
    return NextResponse.json({ error: 'No credit balance found' }, { status: 404 });
  }

  if (action === 'delegate') {
    if (amount > Number(balance.available)) {
      return NextResponse.json(
        { error: 'Insufficient available credits', available: Number(balance.available) },
        { status: 400 },
      );
    }

    // Find the current active pool cycle
    const activePoolCycle = await prisma.poolCycle.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    if (!activePoolCycle) {
      return NextResponse.json({ error: 'No active pool cycle available for delegation' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedBalance = await tx.creditBalance.update({
        where: { userId },
        data: {
          available: { decrement: amount },
          delegatedToPool: { increment: amount },
        },
      });

      await tx.poolDelegation.upsert({
        where: {
          userId_poolCycleId: { userId, poolCycleId: activePoolCycle.id },
        },
        create: {
          userId,
          poolCycleId: activePoolCycle.id,
          amount,
        },
        update: {
          amount: { increment: amount },
        },
      });

      const transaction = await tx.creditTransaction.create({
        data: {
          userId,
          type: 'POOL_DELEGATE',
          amount,
          balanceBefore: Number(balance.available),
          balanceAfter: Number(balance.available) - amount,
          poolCycleId: activePoolCycle.id,
          description: `Delegated ${amount} credits to pool cycle ${activePoolCycle.id}`,
        },
      });

      return { updatedBalance, transaction };
    }, {
      isolationLevel: 'Serializable' as const,
    });

    return NextResponse.json({
      available: Number(result.updatedBalance.available),
      delegatedToPool: Number(result.updatedBalance.delegatedToPool),
      transaction: {
        id: result.transaction.id,
        type: result.transaction.type,
        amount: Number(result.transaction.amount),
        createdAt: result.transaction.createdAt,
      },
    });
  }

  // action === 'recall'
  if (amount > Number(balance.delegatedToPool)) {
    return NextResponse.json(
      { error: 'Insufficient delegated credits', delegatedToPool: Number(balance.delegatedToPool) },
      { status: 400 },
    );
  }

  const activePoolCycle = await prisma.poolCycle.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });

  if (!activePoolCycle) {
    return NextResponse.json({ error: 'No active pool cycle found' }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedBalance = await tx.creditBalance.update({
      where: { userId },
      data: {
        available: { increment: amount },
        delegatedToPool: { decrement: amount },
      },
    });

    // Decrease the pool delegation (or delete if fully recalled)
    const delegation = await tx.poolDelegation.findUnique({
      where: {
        userId_poolCycleId: { userId, poolCycleId: activePoolCycle.id },
      },
    });

    if (delegation) {
      const newAmount = Number(delegation.amount) - amount;
      if (newAmount <= 0) {
        await tx.poolDelegation.delete({
          where: {
            userId_poolCycleId: { userId, poolCycleId: activePoolCycle.id },
          },
        });
      } else {
        await tx.poolDelegation.update({
          where: {
            userId_poolCycleId: { userId, poolCycleId: activePoolCycle.id },
          },
          data: { amount: newAmount },
        });
      }
    }

    const transaction = await tx.creditTransaction.create({
      data: {
        userId,
        type: 'POOL_RECALL',
        amount,
        balanceBefore: Number(balance.available),
        balanceAfter: Number(balance.available) + amount,
        poolCycleId: activePoolCycle.id,
        description: `Recalled ${amount} credits from pool cycle ${activePoolCycle.id}`,
      },
    });

    return { updatedBalance, transaction };
  }, {
    isolationLevel: 'Serializable' as const,
  });

  return NextResponse.json({
    available: Number(result.updatedBalance.available),
    delegatedToPool: Number(result.updatedBalance.delegatedToPool),
    transaction: {
      id: result.transaction.id,
      type: result.transaction.type,
      amount: Number(result.transaction.amount),
      createdAt: result.transaction.createdAt,
    },
  });
  } catch (error) {
    return handleApiError(error, 'CreditDelegate');
  }
}

export const POST = withTiming(handlePOST);
