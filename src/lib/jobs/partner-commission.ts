import { prisma } from '@/lib/db';

export interface CommissionResult {
  partnerId: string;
  partnerName: string;
  referredUsers: number;
  totalRevenue: number;
  revSharePct: number;
  commissionEarned: number;
  period: string;
}

/**
 * Calculate partner commissions for a given month.
 * Called by a cron job or admin action.
 */
export async function calculatePartnerCommissions(
  year: number,
  month: number
): Promise<CommissionResult[]> {
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 1);
  const period = `${year}-${String(month).padStart(2, '0')}`;

  const partners = await prisma.partner.findMany({
    where: { isActive: true },
    include: {
      referredUsers: {
        include: {
          subscription: true,
        },
      },
    },
  });

  const results: CommissionResult[] = [];

  for (const partner of partners) {
    let totalRevenue = 0;

    for (const user of partner.referredUsers) {
      if (!user.subscription) continue;
      if (user.subscription.status !== 'ACTIVE') continue;

      // Check if the subscription was active during this period
      const subStart = user.subscription.currentPeriodStart;
      const subEnd = user.subscription.currentPeriodEnd;
      if (!subStart || !subEnd) continue;
      if (subStart > periodEnd || subEnd < periodStart) continue;

      // Get the monthly price based on tier
      const tierPrices: Record<string, number> = {
        FREE: 0,
        PRO: 9,
        HYBRID: 29,
        TEAM: 49,
        ENTERPRISE: 99, // placeholder
      };
      totalRevenue += tierPrices[user.subscription.tier] || 0;
    }

    const commissionEarned = totalRevenue * partner.revSharePct;

    results.push({
      partnerId: partner.id,
      partnerName: partner.name,
      referredUsers: partner.referredUsers.length,
      totalRevenue,
      revSharePct: partner.revSharePct,
      commissionEarned,
      period,
    });
  }

  return results;
}
