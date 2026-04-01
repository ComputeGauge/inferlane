import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import { handleApiError } from '@/lib/api-errors';
import { withTiming } from '@/lib/api-timing';
import { createHash } from 'crypto';

// Default budget caps per tier (USD/month)
const TIER_BUDGETS: Record<string, number> = {
  FREE: 5,
  STARTER: 50,
  PRO: 500,
  TEAM: 2000,
  ENTERPRISE: 10000,
};

/**
 * Authenticate via session or Bearer token (il_ prefix).
 * Returns the userId or null.
 */
async function resolveUserId(req: NextRequest): Promise<string | null> {
  // Try session first
  const session = await getServerSession(authOptions);
  if (session?.user) {
    return (session.user as { id: string }).id;
  }

  // Fall back to Bearer token
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer il_')) {
    return null;
  }

  const rawKey = authHeader.slice(7);
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  const apiKey = await prisma.apiKey.findFirst({
    where: { keyHash, isActive: true },
    select: { userId: true },
  });

  return apiKey?.userId ?? null;
}

/**
 * POST /api/mcp/budget-status
 *
 * Returns the authenticated user's current budget status including plan tier,
 * monthly budget, current spend, remaining budget, and credit balances.
 */
async function handlePOST(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit: 60/min
  const rl = await rateLimit(`budget-status:${userId}`, 60, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', remaining: rl.remaining },
      { status: 429 },
    );
  }

  try {
    // Fetch subscription, credit balance, and MTD spend in parallel
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const apiKeys = await prisma.apiKey.findMany({
      where: { userId },
      select: { id: true },
    });
    const apiKeyIds = apiKeys.map((k) => k.id);

    const [subscription, creditBalance, mtdAggregate] = await Promise.all([
      prisma.subscription.findUnique({ where: { userId } }),
      prisma.creditBalance.findUnique({ where: { userId } }),
      apiKeyIds.length > 0
        ? prisma.proxyRequest.aggregate({
            where: {
              apiKeyId: { in: apiKeyIds },
              timestamp: { gte: startOfMonth },
            },
            _sum: { costUsd: true },
          })
        : Promise.resolve({ _sum: { costUsd: null } }),
    ]);

    const tier = subscription?.tier ?? 'FREE';
    const monthlyBudget = TIER_BUDGETS[tier] ?? TIER_BUDGETS.FREE;
    const currentSpend = Number(mtdAggregate._sum.costUsd ?? 0);
    const remainingBudget = Math.max(0, monthlyBudget - currentSpend);

    return NextResponse.json({
      plan: tier,
      monthlyBudget,
      currentSpend,
      remainingBudget,
      creditsAvailable: Number(creditBalance?.available ?? 0),
      creditsDelegated: Number(creditBalance?.delegatedToPool ?? 0),
      creditsListed: Number(creditBalance?.listedOnMarket ?? 0),
    });
  } catch (error) {
    return handleApiError(error, 'BudgetStatus');
  }
}

export const POST = withTiming(handlePOST);
