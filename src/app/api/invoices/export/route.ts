import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { withTiming } from '@/lib/api-timing';

// GET /api/invoices/export?month=2026-02
async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month parameter required in YYYY-MM format' }, { status: 400 });
  }

  const [year, mon] = month.split('-').map(Number);
  const startDate = new Date(year, mon - 1, 1);
  const endDate = new Date(year, mon, 1); // first day of next month

  const snapshots = await prisma.spendSnapshot.findMany({
    where: {
      userId,
      createdAt: { gte: startDate, lt: endDate },
    },
    include: {
      providerConnection: {
        select: { provider: true, displayName: true },
      },
    },
  });

  // Aggregate by provider
  const providerMap: Record<string, { provider: string; spend: number; tokenCount: number; requestCount: number }> = {};
  let totalSpend = 0;

  for (const snap of snapshots) {
    const prov = snap.providerConnection.provider;
    if (!providerMap[prov]) {
      providerMap[prov] = { provider: prov, spend: 0, tokenCount: 0, requestCount: 0 };
    }
    const spend = Number(snap.totalSpend);
    providerMap[prov].spend += spend;
    providerMap[prov].tokenCount += Number(snap.tokenCount || 0);
    providerMap[prov].requestCount += (snap.requestCount || 0);
    totalSpend += spend;
  }

  const byProvider = Object.values(providerMap).sort((a, b) => b.spend - a.spend);

  return NextResponse.json({
    month,
    totalSpend: Math.round(totalSpend * 10000) / 10000,
    byProvider: byProvider.map((p) => ({
      provider: p.provider,
      spend: Math.round(p.spend * 10000) / 10000,
      tokenCount: p.tokenCount,
      requestCount: p.requestCount,
    })),
    generatedAt: new Date().toISOString(),
  });
}

export const GET = withTiming(handleGET);
