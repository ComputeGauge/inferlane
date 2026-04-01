import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { withTiming } from '@/lib/api-timing';
import {
  calculatePriceBounds,
  poolEarningModifier,
} from '@/lib/credits/pricing';

// ---------------------------------------------------------------------------
// GET /api/credits/pricing — Current price bounds for the user's credit period
// ---------------------------------------------------------------------------
async function handleGET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  const balance = await prisma.creditBalance.findUnique({
    where: { userId },
    select: {
      periodEnd: true,
      periodStart: true,
      available: true,
      totalAllocated: true,
      delegatedToPool: true,
      listedOnMarket: true,
    },
  });

  if (!balance) {
    return NextResponse.json({
      bounds: null,
      message: 'No credit balance found',
    });
  }

  const now = new Date();
  const bounds = calculatePriceBounds(balance.periodEnd, now);
  const poolModifier = poolEarningModifier(balance.periodEnd, now);

  return NextResponse.json({
    bounds,
    poolModifier: Number(poolModifier.toFixed(4)),
    period: {
      start: balance.periodStart.toISOString(),
      end: balance.periodEnd.toISOString(),
    },
    balance: {
      available: Number(balance.available),
      totalAllocated: Number(balance.totalAllocated),
      delegatedToPool: Number(balance.delegatedToPool),
      listedOnMarket: Number(balance.listedOnMarket),
    },
  });
}

export const GET = withTiming(handleGET);
