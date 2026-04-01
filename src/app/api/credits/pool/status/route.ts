import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { withTiming } from '@/lib/api-timing';

// ---------------------------------------------------------------------------
// GET /api/credits/pool/status — Current pool cycle + user delegation info
// ---------------------------------------------------------------------------
async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  // Fetch the current active pool cycle
  const activeCycle = await prisma.poolCycle.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { periodStart: 'desc' },
  });

  if (!activeCycle) {
    return NextResponse.json({
      pool: null,
      delegation: null,
      message: 'No active pool cycle',
    });
  }

  // Fetch user's delegation for this cycle
  const delegation = await prisma.poolDelegation.findFirst({
    where: {
      userId,
      poolCycleId: activeCycle.id,
    },
  });

  // Estimate earnings: user's share of pool proportional to their delegation
  const totalDelegated = Number(activeCycle.totalDelegated);
  const userDelegated = delegation ? Number(delegation.amount) : 0;
  const revenueRate = Number(activeCycle.revenueRate);
  const totalConsumed = Number(activeCycle.totalConsumed);

  const estimatedPoolRevenue = totalConsumed * revenueRate;
  const userShare = totalDelegated > 0 ? userDelegated / totalDelegated : 0;
  const estimatedEarnings = estimatedPoolRevenue * userShare;

  // Time remaining in cycle
  const now = new Date();
  const periodEnd = new Date(activeCycle.periodEnd);
  const remainingMs = Math.max(0, periodEnd.getTime() - now.getTime());
  const remainingHours = Math.round(remainingMs / (1000 * 60 * 60) * 10) / 10;

  return NextResponse.json({
    pool: {
      id: activeCycle.id,
      periodStart: activeCycle.periodStart,
      periodEnd: activeCycle.periodEnd,
      totalDelegated,
      totalConsumed,
      revenueRate,
      status: activeCycle.status,
      remainingHours,
    },
    delegation: delegation
      ? {
          amount: userDelegated,
          earnedAmount: Number(delegation.earnedAmount),
          sharePercent: Math.round(userShare * 10000) / 100, // 2 decimal places
          estimatedEarnings: Math.round(estimatedEarnings * 100) / 100,
        }
      : null,
  });
}

export const GET = withTiming(handleGET);
