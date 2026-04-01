import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { withTiming } from '@/lib/api-timing';
import { handleApiError } from '@/lib/api-errors';

// GET /api/credits/balance — return user's credit balance + subscription tier
async function handleGET(_req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  const [balance, user] = await Promise.all([
    prisma.creditBalance.findUnique({ where: { userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { subscription: { select: { tier: true } } },
    }),
  ]);

  const tier = user?.subscription?.tier ?? null;

  if (!balance) {
    return NextResponse.json({
      userId,
      totalAllocated: 0,
      available: 0,
      delegatedToPool: 0,
      listedOnMarket: 0,
      earned: 0,
      autoDelegate: false,
      autoDelegatePct: 0,
      periodStart: null,
      periodEnd: null,
      subscriptionTier: tier,
    });
  }

  return NextResponse.json({
    userId: balance.userId,
    totalAllocated: Number(balance.totalAllocated),
    available: Number(balance.available),
    delegatedToPool: Number(balance.delegatedToPool),
    listedOnMarket: Number(balance.listedOnMarket),
    earned: Number(balance.earned),
    autoDelegate: balance.autoDelegate,
    autoDelegatePct: Number(balance.autoDelegatePct),
    periodStart: balance.periodStart,
    periodEnd: balance.periodEnd,
    subscriptionTier: tier,
  });
  } catch (error) {
    return handleApiError(error, 'GetCreditBalance');
  }
}

export const GET = withTiming(handleGET);
