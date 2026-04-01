import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { poolEarningModifier } from '@/lib/credits/pricing';
import { verifyCronSecret, unauthorizedResponse } from '@/lib/cron-auth';

// Cap pool earnings below marketplace floor to ensure marketplace always
// offers better returns than passive pooling. Marketplace floor is ~$0.10
// (10% of face value), so pool cap should be well below that.
const MAX_REVENUE_RATE = 0.03; // 3% max return per cycle — always below marketplace floor

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  try {
    const now = new Date();

    // Find the current ACTIVE PoolCycle
    const activeCycle = await prisma.poolCycle.findFirst({
      where: { status: 'ACTIVE' },
    });

    if (!activeCycle) {
      return NextResponse.json({
        success: true,
        message: 'No active pool cycle found',
        delegators: 0,
        totalEarnings: 0,
        revenueRate: 0,
      });
    }

    const totalDelegated = Number(activeCycle.totalDelegated);
    if (totalDelegated === 0) {
      return NextResponse.json({
        success: true,
        message: 'No delegations in active cycle',
        delegators: 0,
        totalEarnings: 0,
        revenueRate: 0,
      });
    }

    // Query actual consumption from CreditConsumption records sourced from this pool cycle
    const consumptionAgg = await prisma.creditConsumption.aggregate({
      _sum: { amountConsumed: true },
      where: {
        sourceType: 'POOL_DELEGATION',
        sourceId: activeCycle.id,
        createdAt: {
          gte: activeCycle.periodStart,
          lte: now,
        },
      },
    });

    const totalConsumed = Number(consumptionAgg._sum.amountConsumed ?? 0);

    if (totalConsumed === 0) {
      console.warn(`[Pool] No real consumption found for cycle ${activeCycle.id} — skipping earning distribution`);

      // Still check if cycle ended and needs rotation
      if (activeCycle.periodEnd <= now) {
        await prisma.poolCycle.update({
          where: { id: activeCycle.id },
          data: { status: 'SETTLED', revenueRate: 0, settledAt: now },
        });

        const nextStart = new Date(activeCycle.periodEnd);
        const nextEnd = new Date(nextStart.getFullYear(), nextStart.getMonth() + 1, 1);

        await prisma.poolCycle.create({
          data: {
            periodStart: nextStart,
            periodEnd: nextEnd,
            totalDelegated: 0,
            totalConsumed: 0,
            revenueRate: 0,
            status: 'ACTIVE',
          },
        });

        console.log(`[Pool] Cycle settled (zero consumption). New cycle: ${nextStart.toISOString()} - ${nextEnd.toISOString()}`);
      }

      return NextResponse.json({
        success: true,
        message: 'No consumption recorded for this cycle',
        delegators: 0,
        totalEarnings: 0,
        revenueRate: 0,
      });
    }

    // Calculate revenue rate from actual consumption, capped at MAX_REVENUE_RATE
    const revenueRate = Math.min(totalConsumed / totalDelegated, MAX_REVENUE_RATE);

    // Update the cycle with consumption data
    await prisma.poolCycle.update({
      where: { id: activeCycle.id },
      data: {
        totalConsumed: { increment: totalConsumed },
        revenueRate,
      },
    });

    // Get all delegations for this cycle
    const delegations = await prisma.poolDelegation.findMany({
      where: { poolCycleId: activeCycle.id },
    });

    let totalEarnings = 0;

    // Apply time-decay modifier: credits delegated late in the period earn less
    const decayModifier = poolEarningModifier(activeCycle.periodEnd);

    for (const delegation of delegations) {
      const delegatedAmount = Number(delegation.amount);
      // Earnings adjusted by time-decay: late-period delegations earn less
      const earnedAmount = delegatedAmount * revenueRate * decayModifier;

      if (earnedAmount <= 0) continue;

      await prisma.$transaction(async (tx) => {
        // Update delegation earned amount
        await tx.poolDelegation.update({
          where: { id: delegation.id },
          data: { earnedAmount: { increment: earnedAmount } },
        });

        // Credit user's balance
        const balance = await tx.creditBalance.findUnique({
          where: { userId: delegation.userId },
        });

        const availBefore = balance ? Number(balance.available) : 0;

        await tx.creditBalance.update({
          where: { userId: delegation.userId },
          data: {
            earned: { increment: earnedAmount },
            available: { increment: earnedAmount },
          },
        });

        // Create POOL_EARNING transaction
        await tx.creditTransaction.create({
          data: {
            userId: delegation.userId,
            type: 'POOL_EARNING',
            amount: earnedAmount,
            balanceBefore: availBefore,
            balanceAfter: availBefore + earnedAmount,
            poolCycleId: activeCycle.id,
            description: `Pool earning: ${earnedAmount.toFixed(4)} credits at ${(revenueRate * 100).toFixed(2)}% rate`,
          },
        });
      });

      totalEarnings += earnedAmount;
    }

    // Check if cycle has ended — if so, settle and create new one
    if (activeCycle.periodEnd <= now) {
      await prisma.poolCycle.update({
        where: { id: activeCycle.id },
        data: { status: 'SETTLED', settledAt: now },
      });

      // Create new ACTIVE cycle for the next period
      const nextStart = new Date(activeCycle.periodEnd);
      const nextEnd = new Date(nextStart.getFullYear(), nextStart.getMonth() + 1, 1);

      await prisma.poolCycle.create({
        data: {
          periodStart: nextStart,
          periodEnd: nextEnd,
          totalDelegated: 0,
          totalConsumed: 0,
          revenueRate: 0,
          status: 'ACTIVE',
        },
      });

      console.log(`[Pool] Cycle settled. New cycle: ${nextStart.toISOString()} - ${nextEnd.toISOString()}`);
    }

    console.log(`[Pool] Settlement complete: ${delegations.length} delegators, ${totalEarnings.toFixed(4)} total earnings, ${(revenueRate * 100).toFixed(2)}% rate, ${(decayModifier * 100).toFixed(1)}% decay modifier`);

    return NextResponse.json({
      success: true,
      delegators: delegations.length,
      totalEarnings: Number(totalEarnings.toFixed(4)),
      revenueRate: Number(revenueRate.toFixed(4)),
    });
  } catch (error) {
    console.error('[Pool] Settlement error:', error);
    return NextResponse.json({ error: 'Settlement failed' }, { status: 500 });
  }
}
