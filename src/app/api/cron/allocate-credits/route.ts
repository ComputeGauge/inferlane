import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCronSecret, unauthorizedResponse } from '@/lib/cron-auth';

const TIER_PRICING: Record<string, number> = {
  FREE: 0,
  PRO: 9,
  HYBRID: 29,
  TEAM: 49,
  ENTERPRISE: 99,
};

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  let usersAllocated = 0;
  let totalCreditsAllocated = 0;
  let autoPooled = 0;

  try {
    // Ensure an ACTIVE PoolCycle exists for the current month
    let activePool = await prisma.poolCycle.findFirst({
      where: { status: 'ACTIVE' },
    });

    if (!activePool) {
      activePool = await prisma.poolCycle.create({
        data: {
          periodStart,
          periodEnd,
          totalDelegated: 0,
          totalConsumed: 0,
          revenueRate: 0,
          status: 'ACTIVE',
        },
      });
    }

    // Query all users with ACTIVE subscriptions (not FREE)
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        tier: { not: 'FREE' },
      },
    });

    for (const sub of activeSubscriptions) {
      const userId = sub.userId;
      const creditAmount = TIER_PRICING[sub.tier] ?? 0;
      if (creditAmount === 0) continue;

      const existingBalance = await prisma.creditBalance.findUnique({
        where: { userId },
      });

      await prisma.$transaction(async (tx) => {
        // --- Expire previous period credits ---
        if (existingBalance && Number(existingBalance.available) > 0) {
          // Cancel any active offers first — return remaining to balance via MARKET_DELIST
          const activeOffers = await tx.creditOffer.findMany({
            where: { sellerId: userId, status: { in: ['ACTIVE', 'PARTIALLY_FILLED'] } },
          });

          for (const offer of activeOffers) {
            const remaining = Number(offer.amount) - Number(offer.filledAmount);
            if (remaining > 0) {
              const currentBal = await tx.creditBalance.findUnique({ where: { userId } });
              const availBefore = Number(currentBal!.available);

              await tx.creditBalance.update({
                where: { userId },
                data: {
                  available: { increment: remaining },
                  listedOnMarket: { decrement: remaining },
                },
              });

              await tx.creditTransaction.create({
                data: {
                  userId,
                  type: 'MARKET_DELIST',
                  amount: remaining,
                  balanceBefore: availBefore,
                  balanceAfter: availBefore + remaining,
                  description: `Delisted ${remaining} credits from expired offer`,
                },
              });
            }

            await tx.creditOffer.update({
              where: { id: offer.id },
              data: { status: 'EXPIRED' },
            });
          }

          // Now expire the full remaining available balance
          const refreshedBalance = await tx.creditBalance.findUnique({ where: { userId } });
          const availableNow = Number(refreshedBalance!.available);

          if (availableNow > 0) {
            await tx.creditTransaction.create({
              data: {
                userId,
                type: 'EXPIRY',
                amount: availableNow,
                balanceBefore: availableNow,
                balanceAfter: 0,
                description: `Expired ${availableNow} unused credits from previous period`,
              },
            });

            await tx.creditBalance.update({
              where: { userId },
              data: { available: 0 },
            });
          }
        }

        // --- Allocate new credits ---
        await tx.creditBalance.upsert({
          where: { userId },
          create: {
            userId,
            totalAllocated: creditAmount,
            available: creditAmount,
            delegatedToPool: 0,
            listedOnMarket: 0,
            earned: 0,
            autoDelegate: false,
            autoDelegatePct: 0,
            periodStart,
            periodEnd,
          },
          update: {
            totalAllocated: creditAmount,
            available: creditAmount,
            delegatedToPool: 0,
            listedOnMarket: 0,
            periodStart,
            periodEnd,
          },
        });

        await tx.creditTransaction.create({
          data: {
            userId,
            type: 'ALLOCATION',
            amount: creditAmount,
            balanceBefore: 0,
            balanceAfter: creditAmount,
            description: `Monthly allocation of ${creditAmount} credits for ${sub.tier} tier`,
          },
        });

        usersAllocated++;
        totalCreditsAllocated += creditAmount;

        // --- Auto-delegate if enabled ---
        const updatedBalance = await tx.creditBalance.findUnique({ where: { userId } });
        if (updatedBalance?.autoDelegate && Number(updatedBalance.autoDelegatePct) > 0) {
          const delegateAmount = Math.floor(creditAmount * (Number(updatedBalance.autoDelegatePct) / 100));
          if (delegateAmount > 0) {
            await tx.poolDelegation.create({
              data: {
                userId,
                poolCycleId: activePool!.id,
                amount: delegateAmount,
                earnedAmount: 0,
              },
            });

            await tx.creditBalance.update({
              where: { userId },
              data: {
                available: { decrement: delegateAmount },
                delegatedToPool: { increment: delegateAmount },
              },
            });

            await tx.creditTransaction.create({
              data: {
                userId,
                type: 'POOL_DELEGATE',
                amount: delegateAmount,
                balanceBefore: creditAmount,
                balanceAfter: creditAmount - delegateAmount,
                poolCycleId: activePool!.id,
                description: `Auto-delegated ${delegateAmount} credits (${Number(updatedBalance.autoDelegatePct)}%) to pool`,
              },
            });

            // Update pool total
            await tx.poolCycle.update({
              where: { id: activePool!.id },
              data: { totalDelegated: { increment: delegateAmount } },
            });

            autoPooled += delegateAmount;
          }
        }
      });
    }

    console.log(`[Credits] Allocation complete: ${usersAllocated} users, ${totalCreditsAllocated} credits, ${autoPooled} auto-pooled`);

    return NextResponse.json({
      success: true,
      usersAllocated,
      totalCreditsAllocated,
      autoPooled,
    });
  } catch (error) {
    console.error('[Credits] Allocation error:', error);
    return NextResponse.json({ error: 'Allocation failed' }, { status: 500 });
  }
}
