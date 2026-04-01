// ---------------------------------------------------------------------------
// Node Operator Referral Bonus System (Stream X3)
// ---------------------------------------------------------------------------
// When a referred node operator earns from a request, the referrer receives
// a 5% bonus of the earning amount for the first 6 months after referral.
// Maximum $500 total bonus per referral to prevent abuse.
//
// Called from creditNodeOperator() in dispatch.ts after NODE_EARNING is created.
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db';

// ── Constants ────────────────────────────────────────────────────────────

const REFERRAL_BONUS_RATE = 0.05;          // 5% of referred node's earnings
const REFERRAL_WINDOW_MONTHS = 6;          // Bonus expires after 6 months
const MAX_BONUS_PER_REFERRAL_USD = 500;    // Cap per referral relationship

// ── Main Function ────────────────────────────────────────────────────────

/**
 * Process a referral bonus for a node operator earning.
 * Call this after creating a NODE_EARNING transaction for any node.
 *
 * @param earningNodeId - The node operator that just earned
 * @param earningAmount - The USD amount the node earned from the request
 * @returns true if a bonus was paid, false otherwise
 */
export async function processReferralBonus(
  earningNodeId: string,
  earningAmount: number,
): Promise<boolean> {
  if (earningAmount <= 0) return false;

  // Look up the earning node's referral relationship
  const earningNode = await prisma.nodeOperator.findUnique({
    where: { id: earningNodeId },
    select: {
      referredByNodeId: true,
      createdAt: true,
      displayName: true,
    },
  });

  if (!earningNode?.referredByNodeId) return false;

  // Check if within the 6-month referral window
  const windowEnd = new Date(earningNode.createdAt);
  windowEnd.setMonth(windowEnd.getMonth() + REFERRAL_WINDOW_MONTHS);
  if (new Date() > windowEnd) return false;

  // Calculate bonus
  const bonusAmount = earningAmount * REFERRAL_BONUS_RATE;
  if (bonusAmount < 0.000001) return false; // Below minimum precision

  // Check if referrer has hit the per-referral cap
  const existingBonuses = await prisma.nodeTransaction.aggregate({
    where: {
      nodeOperatorId: earningNode.referredByNodeId,
      type: 'NODE_BONUS',
      description: { contains: `ref:${earningNodeId}` },
    },
    _sum: { amount: true },
  });

  const totalBonusSoFar = Number(existingBonuses._sum.amount ?? 0);
  if (totalBonusSoFar >= MAX_BONUS_PER_REFERRAL_USD) return false;

  // Cap the bonus if it would exceed the limit
  const remainingCap = MAX_BONUS_PER_REFERRAL_USD - totalBonusSoFar;
  const cappedBonus = Math.min(bonusAmount, remainingCap);

  // Award the bonus in a transaction
  await prisma.$transaction(async (tx) => {
    const referrer = await tx.nodeOperator.findUnique({
      where: { id: earningNode.referredByNodeId! },
      select: { pendingBalance: true },
    });

    if (!referrer) return;

    const balanceBefore = Number(referrer.pendingBalance);
    const balanceAfter = balanceBefore + cappedBonus;

    await tx.nodeOperator.update({
      where: { id: earningNode.referredByNodeId! },
      data: {
        pendingBalance: { increment: cappedBonus },
        lifetimeEarned: { increment: cappedBonus },
      },
    });

    await tx.nodeTransaction.create({
      data: {
        nodeOperatorId: earningNode.referredByNodeId!,
        type: 'NODE_BONUS',
        amount: cappedBonus,
        balanceBefore,
        balanceAfter,
        description: `Referral bonus from ${earningNode.displayName ?? 'node'} (ref:${earningNodeId})`,
      },
    });
  }, { isolationLevel: 'Serializable' as const });

  return true;
}

/**
 * Get referral statistics for a node operator.
 */
export async function getReferralStats(nodeOperatorId: string) {
  const [referrals, bonusAggregate] = await Promise.all([
    prisma.nodeOperator.findMany({
      where: { referredByNodeId: nodeOperatorId },
      select: {
        id: true,
        displayName: true,
        createdAt: true,
        totalRequests: true,
        isOnline: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.nodeTransaction.aggregate({
      where: {
        nodeOperatorId,
        type: 'NODE_BONUS',
        description: { contains: 'Referral bonus' },
      },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  // Per-referral bonus breakdown
  const referralDetails = await Promise.all(
    referrals.map(async (ref) => {
      const bonusFromRef = await prisma.nodeTransaction.aggregate({
        where: {
          nodeOperatorId,
          type: 'NODE_BONUS',
          description: { contains: `ref:${ref.id}` },
        },
        _sum: { amount: true },
      });

      const windowEnd = new Date(ref.createdAt);
      windowEnd.setMonth(windowEnd.getMonth() + REFERRAL_WINDOW_MONTHS);
      const isActive = new Date() < windowEnd;

      return {
        id: ref.id,
        displayName: ref.displayName,
        createdAt: ref.createdAt.toISOString(),
        totalRequests: ref.totalRequests,
        isOnline: ref.isOnline,
        bonusEarned: Number(bonusFromRef._sum.amount ?? 0),
        isActive,
        windowEndsAt: windowEnd.toISOString(),
      };
    }),
  );

  return {
    referralCount: referrals.length,
    totalBonusEarned: Number(bonusAggregate._sum.amount ?? 0),
    bonusTransactionCount: bonusAggregate._count,
    referrals: referralDetails,
  };
}
