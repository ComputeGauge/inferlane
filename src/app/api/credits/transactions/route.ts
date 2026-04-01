import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { withTiming } from '@/lib/api-timing';
import { handleApiError } from '@/lib/api-errors';

const VALID_TX_TYPES = [
  'ALLOCATION', 'POOL_DELEGATE', 'POOL_RECALL', 'POOL_EARNING',
  'MARKET_LIST', 'MARKET_DELIST', 'MARKET_SALE', 'MARKET_PURCHASE', 'EXPIRY',
] as const;

type CreditTxType = (typeof VALID_TX_TYPES)[number];

// GET /api/credits/transactions — paginated transaction history
async function handleGET(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const typeFilter = searchParams.get('type') as CreditTxType | null;

  // Validate type filter if provided
  if (typeFilter && !VALID_TX_TYPES.includes(typeFilter)) {
    return NextResponse.json(
      { error: `Invalid type filter. Must be one of: ${VALID_TX_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  const where = {
    userId,
    ...(typeFilter ? { type: typeFilter } : {}),
  };

  const [items, totalCount] = await Promise.all([
    prisma.creditTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.creditTransaction.count({ where }),
  ]);

  return NextResponse.json({
    items: items.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: Number(tx.amount),
      balanceBefore: Number(tx.balanceBefore),
      balanceAfter: Number(tx.balanceAfter),
      counterpartyId: tx.counterpartyId,
      offerId: tx.offerId,
      poolCycleId: tx.poolCycleId,
      description: tx.description,
      createdAt: tx.createdAt,
    })),
    totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit),
  });
  } catch (error) {
    return handleApiError(error, 'GetCreditTransactions');
  }
}

export const GET = withTiming(handleGET);
