import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';
import { handleApiError } from '@/lib/api-errors';

// ---------------------------------------------------------------------------
// GET /api/nodes/stats — Node operator earnings, payouts, and history
// ---------------------------------------------------------------------------

async function handleGET(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const rl = await rateLimit(`node-stats:${userId}`, 20, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const node = await prisma.nodeOperator.findUnique({ where: { userId } });
  if (!node) {
    return NextResponse.json({ error: 'Not registered as node operator' }, { status: 404 });
  }

  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') || '50', 10)));

  const [transactions, transactionCount, payouts, earningsToday, earnings7d] = await Promise.all([
    prisma.nodeTransaction.findMany({
      where: { nodeOperatorId: node.id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.nodeTransaction.count({ where: { nodeOperatorId: node.id } }),
    prisma.nodePayout.findMany({
      where: { nodeOperatorId: node.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.nodeTransaction.aggregate({
      where: {
        nodeOperatorId: node.id,
        type: 'NODE_EARNING',
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      _sum: { amount: true },
    }),
    prisma.nodeTransaction.aggregate({
      where: {
        nodeOperatorId: node.id,
        type: 'NODE_EARNING',
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      _sum: { amount: true },
    }),
  ]);

  return NextResponse.json({
    summary: {
      pendingBalance: Number(node.pendingBalance),
      lifetimeEarned: Number(node.lifetimeEarned),
      earningsToday: Number(earningsToday._sum.amount ?? 0),
      earnings7d: Number(earnings7d._sum.amount ?? 0),
      reputationScore: node.reputationScore,
      totalRequests: node.totalRequests,
      failedRequests: node.failedRequests,
      successRate: node.totalRequests > 0
        ? ((node.totalRequests - node.failedRequests) / node.totalRequests * 100).toFixed(1) + '%'
        : 'N/A',
    },
    transactions: transactions.map((t) => ({
      ...t,
      amount: Number(t.amount),
      balanceBefore: Number(t.balanceBefore),
      balanceAfter: Number(t.balanceAfter),
    })),
    pagination: { page, limit, total: transactionCount },
    payouts: payouts.map((p) => ({
      ...p,
      amount: Number(p.amount),
    })),
  });
  } catch (error) {
    return handleApiError(error, 'NodeStats');
  }
}

export const GET = withTiming(handleGET);
