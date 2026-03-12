import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/spend?period=month&provider=ANTHROPIC
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || 'month';
  const provider = searchParams.get('provider');

  const now = new Date();
  let startDate: Date;
  switch (period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'quarter':
      startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      break;
    case 'month':
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const where: Record<string, unknown> = {
    userId,
    createdAt: { gte: startDate },
  };
  if (provider) {
    where.providerConnection = { provider: provider.toUpperCase() };
  }

  const snapshots = await prisma.spendSnapshot.findMany({
    where,
    include: {
      providerConnection: {
        select: { provider: true, displayName: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Aggregate by provider
  const byProvider: Record<string, { spend: number; tokens: number; requests: number }> = {};
  let totalSpend = 0;

  for (const snap of snapshots) {
    const prov = snap.providerConnection.provider;
    if (!byProvider[prov]) byProvider[prov] = { spend: 0, tokens: 0, requests: 0 };
    const spend = Number(snap.totalSpend);
    byProvider[prov].spend += spend;
    byProvider[prov].tokens += Number(snap.tokenCount || 0);
    byProvider[prov].requests += snap.requestCount || 0;
    totalSpend += spend;
  }

  // Get budget info from alerts
  const budgetAlerts = await prisma.alert.findMany({
    where: { userId, type: 'BUDGET_WARNING', isActive: true },
  });

  // Get daily trend data
  const usageRecords = await prisma.usageRecord.findMany({
    where: {
      providerConnection: { userId },
      timestamp: { gte: startDate },
    },
    orderBy: { timestamp: 'asc' },
  });

  // Group by day for chart
  const dailySpend: Record<string, Record<string, number>> = {};
  for (const rec of usageRecords) {
    const day = rec.timestamp.toISOString().split('T')[0];
    if (!dailySpend[day]) dailySpend[day] = {};
    const cost = Number(rec.costUsd);
    // We'd need the provider from the connection — simplify for now
    dailySpend[day]['total'] = (dailySpend[day]['total'] || 0) + cost;
  }

  return NextResponse.json({
    totalSpend,
    byProvider,
    budgets: budgetAlerts.map(a => ({
      provider: a.provider,
      limit: Number(a.threshold),
      current: Number(a.currentValue || 0),
    })),
    dailyTrend: Object.entries(dailySpend).map(([date, data]) => ({ date, ...data })),
    period,
    startDate: startDate.toISOString(),
  });
}
