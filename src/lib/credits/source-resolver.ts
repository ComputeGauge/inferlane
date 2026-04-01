// ---------------------------------------------------------------------------
// Credit Source Resolver — Dynamic Decay Routing (Stream R)
// ---------------------------------------------------------------------------
// Determines which credit sources to consume for a given proxy request,
// prioritising the cheapest/most-decayed credits first. This transforms
// the credit system from "simple balance deduction" into an intelligent
// routing engine that maximises value for both buyers and sellers.
//
// Priority order:
// 1. Purchased marketplace credits (nearest expiry first)
// 2. Own credits approaching expiry (< 7 days remaining)
// 3. Pool-delegated credits earning below threshold
// 4. Own credits with comfortable remaining time
// 5. On-demand (no credits, charge directly)
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db';
import { calculatePriceBounds } from '@/lib/credits/pricing';

// --- Types ---

export interface CreditSource {
  type: 'OWN_CREDITS' | 'MARKETPLACE_PURCHASE' | 'POOL_DELEGATION' | 'ON_DEMAND';
  creditBalanceId?: string;
  offerId?: string;
  poolCycleId?: string;
  available: number;
  expiresAt: Date;
  decayFactor: number;
  effectiveCostPerCredit: number;
  priority: number;             // lower = consume first
}

export interface CreditConsumptionResult {
  consumed: CreditConsumptionEntry[];
  totalConsumed: number;
  remainingCost: number;        // > 0 if credits didn't fully cover
  savingsVsFaceValue: number;   // $ saved by using decayed credits
}

export interface CreditConsumptionEntry {
  source: CreditSource;
  amountConsumed: number;
}

// --- Source Resolution ---

/**
 * Resolve all available credit sources for a user, ordered by consumption priority.
 *
 * Priority logic:
 * - Marketplace purchases expire soonest → consume first (buyer paid discount, wants to use them)
 * - Own credits near expiry → consume before they're forfeit
 * - Pool credits with low earnings → better to burn than earn 0.5%
 * - Own credits with time remaining → most valuable, consume last
 */
export async function resolveCredits(userId: string): Promise<CreditSource[]> {
  const now = new Date();
  const sources: CreditSource[] = [];

  // --- 1. User's own credit balance ---
  const balance = await prisma.creditBalance.findUnique({
    where: { userId },
  });

  if (balance && Number(balance.available) > 0) {
    const bounds = calculatePriceBounds(balance.periodEnd, now);
    const daysRemaining = (balance.periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    sources.push({
      type: 'OWN_CREDITS',
      creditBalanceId: balance.id,
      available: Number(balance.available),
      expiresAt: balance.periodEnd,
      decayFactor: bounds.decayFactor,
      effectiveCostPerCredit: 1.00, // face value
      // Priority: approaching expiry = higher priority (lower number)
      priority: daysRemaining < 7 ? 20 : 40,
    });
  }

  // --- 2. Marketplace purchases (credits bought at discount) ---
  // These are reflected in the user's available balance already,
  // but we track them via CreditTransaction type=MARKET_PURCHASE
  // to know their effective cost and source offer's expiry.
  const recentPurchases = await prisma.creditTransaction.findMany({
    where: {
      userId,
      type: 'MARKET_PURCHASE',
      createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }, // last 30 days
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // Group marketplace purchase sources by offer
  for (const purchase of recentPurchases) {
    if (!purchase.offerId) continue;

    // Look up the offer to get its expiry
    const offer = await prisma.creditOffer.findUnique({
      where: { id: purchase.offerId },
      select: { expiresAt: true, pricePerUnit: true },
    });

    if (!offer) continue;

    const purchaseBounds = calculatePriceBounds(offer.expiresAt, now);

    sources.push({
      type: 'MARKETPLACE_PURCHASE',
      offerId: purchase.offerId,
      available: Number(purchase.amount), // amount from this purchase
      expiresAt: offer.expiresAt,
      decayFactor: purchaseBounds.decayFactor,
      effectiveCostPerCredit: Number(offer.pricePerUnit),
      priority: 10, // always consume marketplace purchases first
    });
  }

  // --- 3. Pool-delegated credits ---
  // If pool earnings rate is below a threshold, it's better to recall and consume directly
  if (balance && Number(balance.delegatedToPool) > 0) {
    const activePool = await prisma.poolCycle.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    if (activePool && Number(activePool.revenueRate) < 0.01) {
      // Pool earning < 1% — better to burn than leave delegated
      const bounds = calculatePriceBounds(
        balance.periodEnd,
        now,
      );

      sources.push({
        type: 'POOL_DELEGATION',
        poolCycleId: activePool.id,
        available: Number(balance.delegatedToPool),
        expiresAt: balance.periodEnd,
        decayFactor: bounds.decayFactor,
        effectiveCostPerCredit: 1.00,
        priority: 30, // between expiring own credits and comfortable own credits
      });
    }
  }

  // Sort by priority (lowest first = consume first)
  sources.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    // Within same priority, consume nearest expiry first
    return a.expiresAt.getTime() - b.expiresAt.getTime();
  });

  return sources;
}

// --- Credit Consumption ---

/**
 * Consume credits from the best available sources to cover a cost.
 *
 * This is the core function called by the proxy route after each inference request.
 * It deducts from the cheapest/most-decayed sources first, creates CreditConsumption
 * records for audit, and returns the remaining cost (if credits didn't fully cover).
 *
 * All mutations happen within a Serializable transaction to prevent double-spend.
 */
export async function consumeCredits(
  userId: string,
  costUsd: number,
  proxyRequestId?: string,
): Promise<CreditConsumptionResult> {
  if (costUsd <= 0) {
    return { consumed: [], totalConsumed: 0, remainingCost: 0, savingsVsFaceValue: 0 };
  }

  const sources = await resolveCredits(userId);
  const consumed: CreditConsumptionEntry[] = [];
  let remaining = costUsd;
  let totalConsumed = 0;
  let savingsVsFaceValue = 0;

  // Plan consumption across sources
  for (const source of sources) {
    if (remaining <= 0) break;
    if (source.available <= 0) continue;

    const deduction = Math.min(remaining, source.available);
    consumed.push({ source, amountConsumed: deduction });
    remaining -= deduction;
    totalConsumed += deduction;

    // Calculate savings: face value ($1.00) minus what the user effectively paid
    if (source.type === 'MARKETPLACE_PURCHASE') {
      savingsVsFaceValue += deduction * (1.00 - source.effectiveCostPerCredit);
    }
  }

  if (consumed.length === 0) {
    return { consumed: [], totalConsumed: 0, remainingCost: costUsd, savingsVsFaceValue: 0 };
  }

  // Execute consumption in a Serializable transaction
  try {
    await prisma.$transaction(async (tx) => {
      const balance = await tx.creditBalance.findUnique({
        where: { userId },
      });

      if (!balance) return;

      const availBefore = Number(balance.available);
      let totalDeducted = 0;

      for (const entry of consumed) {
        const { source, amountConsumed } = entry;

        if (source.type === 'OWN_CREDITS' || source.type === 'MARKETPLACE_PURCHASE') {
          // Both consume from available balance
          totalDeducted += amountConsumed;

          // Create consumption record
          await tx.creditConsumption.create({
            data: {
              userId,
              proxyRequestId: proxyRequestId || null,
              sourceType: source.type,
              sourceId: source.offerId || source.creditBalanceId || null,
              amountConsumed,
              costPerCredit: source.effectiveCostPerCredit,
            },
          });
        } else if (source.type === 'POOL_DELEGATION') {
          // Recall from pool first, then consume
          await tx.creditBalance.update({
            where: { userId },
            data: {
              available: { increment: amountConsumed },
              delegatedToPool: { decrement: amountConsumed },
            },
          });

          // Decrease pool delegation
          if (source.poolCycleId) {
            const delegation = await tx.poolDelegation.findUnique({
              where: {
                userId_poolCycleId: { userId, poolCycleId: source.poolCycleId },
              },
            });

            if (delegation) {
              const newAmount = Number(delegation.amount) - amountConsumed;
              if (newAmount <= 0) {
                await tx.poolDelegation.delete({
                  where: {
                    userId_poolCycleId: { userId, poolCycleId: source.poolCycleId },
                  },
                });
              } else {
                await tx.poolDelegation.update({
                  where: {
                    userId_poolCycleId: { userId, poolCycleId: source.poolCycleId },
                  },
                  data: { amount: newAmount },
                });
              }
            }

            await tx.creditTransaction.create({
              data: {
                userId,
                type: 'POOL_RECALL',
                amount: amountConsumed,
                balanceBefore: availBefore,
                balanceAfter: availBefore + amountConsumed,
                poolCycleId: source.poolCycleId,
                description: `Auto-recalled ${amountConsumed.toFixed(6)} credits for consumption (pool rate below threshold)`,
              },
            });
          }

          totalDeducted += amountConsumed;

          await tx.creditConsumption.create({
            data: {
              userId,
              proxyRequestId: proxyRequestId || null,
              sourceType: 'POOL_DELEGATION',
              sourceId: source.poolCycleId || null,
              amountConsumed,
              costPerCredit: source.effectiveCostPerCredit,
            },
          });
        }
      }

      // Deduct total from available
      if (totalDeducted > 0) {
        // Re-read balance after potential pool recall
        const currentBalance = await tx.creditBalance.findUnique({ where: { userId } });
        const currentAvail = Number(currentBalance!.available);

        await tx.creditBalance.update({
          where: { userId },
          data: { available: { decrement: totalDeducted } },
        });

        await tx.creditTransaction.create({
          data: {
            userId,
            type: 'CREDIT_CONSUME',
            amount: totalDeducted,
            balanceBefore: currentAvail,
            balanceAfter: currentAvail - totalDeducted,
            description: `Consumed ${totalDeducted.toFixed(6)} credits across ${consumed.length} source(s)`,
          },
        });
      }
    }, {
      isolationLevel: 'Serializable' as const,
    });
  } catch (err) {
    console.error('[SourceResolver] Credit consumption error:', err);
    // Non-blocking — proxy request already succeeded
    return {
      consumed: [],
      totalConsumed: 0,
      remainingCost: costUsd,
      savingsVsFaceValue: 0,
    };
  }

  return {
    consumed,
    totalConsumed,
    remainingCost: remaining,
    savingsVsFaceValue,
  };
}

// --- Batch Consumption Planning ---

export interface BatchCreditPlan {
  totalEstimatedCost: number;
  sources: CreditSource[];
  switchPoints: Array<{ afterCost: number; fromSource: string; toSource: string }>;
  totalAvailable: number;
  coveragePercent: number;      // what % of estimated cost is covered by credits
  estimatedSavings: number;
}

/**
 * Pre-calculate which credit sources will be consumed for a batch workload.
 * Used by the dashboard to show "Your batch job will consume X marketplace
 * credits at $Y/ea, then switch to your primary allocation."
 */
export async function planBatchConsumption(
  userId: string,
  estimatedTotalCost: number,
): Promise<BatchCreditPlan> {
  const sources = await resolveCredits(userId);
  const switchPoints: BatchCreditPlan['switchPoints'] = [];
  let remaining = estimatedTotalCost;
  let totalAvailable = 0;
  let estimatedSavings = 0;
  let lastSourceType = '';

  for (const source of sources) {
    if (remaining <= 0) break;
    totalAvailable += source.available;

    const consumption = Math.min(remaining, source.available);

    if (lastSourceType && lastSourceType !== source.type) {
      switchPoints.push({
        afterCost: estimatedTotalCost - remaining,
        fromSource: lastSourceType,
        toSource: source.type,
      });
    }

    if (source.type === 'MARKETPLACE_PURCHASE') {
      estimatedSavings += consumption * (1.00 - source.effectiveCostPerCredit);
    }

    remaining -= consumption;
    lastSourceType = source.type;
  }

  const coveragePercent = Math.min(100, ((estimatedTotalCost - remaining) / estimatedTotalCost) * 100);

  return {
    totalEstimatedCost: estimatedTotalCost,
    sources,
    switchPoints,
    totalAvailable,
    coveragePercent,
    estimatedSavings,
  };
}
