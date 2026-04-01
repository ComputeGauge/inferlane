import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';

// ---------------------------------------------------------------------------
// GET /api/compute-intel/settlement?payeeId=X&status=PENDING
// ---------------------------------------------------------------------------
// Returns settlement records for a payee, with optional status filter.
// Used by node operator dashboard and provider settlement views.
// ---------------------------------------------------------------------------

async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const rl = await rateLimit(`settlement-read:${userId}`, 30, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const payeeId = req.nextUrl.searchParams.get('payeeId');
  const status = req.nextUrl.searchParams.get('status');
  const lane = req.nextUrl.searchParams.get('lane');
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') || '50', 10)));

  // Build filter
  const where: Record<string, unknown> = {};
  if (payeeId) where.payeeId = payeeId;
  if (status) where.status = status;
  if (lane) where.lane = lane;

  const [records, total] = await Promise.all([
    prisma.computeSettlementRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.computeSettlementRecord.count({ where }),
  ]);

  // Aggregate stats for this payee
  const stats = payeeId
    ? await getPayeeStats(payeeId)
    : null;

  return NextResponse.json({
    records: records.map(serialiseRecord),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    stats,
  });
}

interface PayeeStats {
  totalSettled: number;
  totalPending: number;
  totalDisputed: number;
  countByLane: Record<string, number>;
  avgSettlementHours: number | null;
}

async function getPayeeStats(payeeId: string): Promise<PayeeStats> {
  const [settled, pending, disputed, records] = await Promise.all([
    prisma.computeSettlementRecord.aggregate({
      where: { payeeId, status: 'SETTLED' },
      _sum: { amountUsd: true },
    }),
    prisma.computeSettlementRecord.aggregate({
      where: { payeeId, status: 'PENDING' },
      _sum: { amountUsd: true },
    }),
    prisma.computeSettlementRecord.aggregate({
      where: { payeeId, status: 'DISPUTED' },
      _sum: { amountUsd: true },
    }),
    prisma.computeSettlementRecord.groupBy({
      by: ['lane'],
      where: { payeeId },
      _count: true,
    }),
  ]);

  // Calculate avg settlement time for settled records
  const settledRecords = await prisma.computeSettlementRecord.findMany({
    where: { payeeId, status: 'SETTLED', settledAt: { not: null } },
    select: { createdAt: true, settledAt: true },
    take: 100,
    orderBy: { settledAt: 'desc' },
  });

  let avgSettlementHours: number | null = null;
  if (settledRecords.length > 0) {
    const totalHours = settledRecords.reduce((sum, r) => {
      if (!r.settledAt) return sum;
      return sum + (r.settledAt.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60);
    }, 0);
    avgSettlementHours = Math.round((totalHours / settledRecords.length) * 100) / 100;
  }

  const countByLane: Record<string, number> = {};
  for (const group of records) {
    countByLane[group.lane] = group._count;
  }

  return {
    totalSettled: Number(settled._sum.amountUsd ?? 0),
    totalPending: Number(pending._sum.amountUsd ?? 0),
    totalDisputed: Number(disputed._sum.amountUsd ?? 0),
    countByLane,
    avgSettlementHours,
  };
}

function serialiseRecord(record: Record<string, unknown>) {
  return {
    ...record,
    amountUsd: Number(record.amountUsd),
  };
}

export const GET = withTiming(handleGET);
