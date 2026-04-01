import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWeeklyDigest } from '@/lib/email';
import { verifyCronSecret, unauthorizedResponse } from '@/lib/cron-auth';

/**
 * POST /api/cron/digest — Send weekly spend digest emails.
 *
 * Secured by CRON_SECRET header. Intended to be called by an external
 * cron scheduler (e.g., Vercel Cron, GitHub Actions, or a cron job).
 *
 * Set CRON_SECRET in your environment to enable this endpoint.
 */
export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  try {
    // Find all users with active subscription who haven't opted out of digests
    const users = await prisma.user.findMany({
      where: {
        subscription: {
          status: 'ACTIVE',
        },
        deletedAt: null,
        // Exclude users who explicitly opted out
        NOT: {
          notificationPrefs: {
            weeklyDigest: false,
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const periodStr = `${weekAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    let sent = 0;
    let failed = 0;

    for (const user of users) {
      if (!user.email) continue;

      // Aggregate spend for the past week (period is stored as YYYY-MM-DD string)
      const weekAgoStr = weekAgo.toISOString().slice(0, 10);
      const spendRecords = await prisma.spendSnapshot.findMany({
        where: {
          userId: user.id,
          period: { gte: weekAgoStr },
          periodType: 'DAILY',
        },
        orderBy: { period: 'desc' },
      });

      const totalSpend = spendRecords.reduce(
        (sum, r) => sum + (typeof r.totalSpend === 'number' ? r.totalSpend : Number(r.totalSpend)),
        0
      );

      // Get budget from the most recent spend snapshot
      const latestWithBudget = spendRecords.find((r) => r.budgetLimit != null);
      const budget = latestWithBudget ? Number(latestWithBudget.budgetLimit) : 0;

      // Get recent alerts
      const alerts = await prisma.alert.findMany({
        where: {
          userId: user.id,
          createdAt: { gte: weekAgo },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          type: true,
          message: true,
          createdAt: true,
        },
      });

      // Aggregate top models by spend from proxy requests this week
      // ProxyRequest is keyed by apiKeyId, so look up the user's API keys first
      const userKeys = await prisma.apiKey.findMany({
        where: { userId: user.id },
        select: { id: true },
      });
      const keyIds = userKeys.map((k) => k.id);

      const topModelRecords = keyIds.length > 0
        ? await prisma.proxyRequest.groupBy({
            by: ['routedProvider', 'routedModel'],
            where: {
              apiKeyId: { in: keyIds },
              timestamp: { gte: weekAgo },
            },
            _sum: { costUsd: true },
            _count: true,
            orderBy: { _sum: { costUsd: 'desc' } },
            take: 5,
          })
        : [];

      const topModels = topModelRecords.map((m) => ({
        name: m.routedModel,
        provider: m.routedProvider,
        spend: Number(m._sum.costUsd ?? 0),
        requests: m._count,
      }));

      const ok = await sendWeeklyDigest(user.email, {
        userName: user.name || 'there',
        period: periodStr,
        totalSpend,
        budget,
        topModels,
        alerts: alerts.map((a) => ({
          type: a.type,
          message: a.message || '',
          createdAt: a.createdAt.toISOString(),
        })),
        savingsTip: totalSpend > budget * 0.8
          ? 'You used over 80% of your budget. Consider routing lighter tasks to local models with InferLane Router.'
          : undefined,
      });

      if (ok) sent++;
      else failed++;
    }

    return NextResponse.json({ sent, failed, total: users.length });
  } catch (err) {
    console.error('[Digest Cron] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
