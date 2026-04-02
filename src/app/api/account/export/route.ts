import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';

// ---------------------------------------------------------------------------
// GET /api/account/export — GDPR data export (all user data as JSON)
// Rate limited: 1 export per hour per user
// ---------------------------------------------------------------------------

async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  // Rate limit: 1 per hour
  const rl = await rateLimit(`export:${userId}`, 1, 60 * 60 * 1000);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Data export rate limit: 1 request per hour. Try again later.' },
      { status: 429 },
    );
  }

  // Fetch all user data in parallel
  const [
    user,
    apiKeys,
    providerConnections,
    creditBalance,
    creditTransactions,
    subscription,
    scheduledPrompts,
    sessions,
    auditLogs,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        keyPrefix: true, // Only prefix, never the hash
        isActive: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
    }),
    prisma.providerConnection.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // Explicitly exclude encryptedApiKey
      },
    }),
    prisma.creditBalance.findUnique({
      where: { userId },
      select: {
        totalAllocated: true,
        available: true,
        delegatedToPool: true,
        listedOnMarket: true,
        earned: true,
        periodStart: true,
        periodEnd: true,
      },
    }),
    prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      select: {
        id: true,
        type: true,
        amount: true,
        balanceBefore: true,
        balanceAfter: true,
        description: true,
        createdAt: true,
      },
    }),
    prisma.subscription.findUnique({
      where: { userId },
      select: {
        tier: true,
        status: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        createdAt: true,
      },
    }),
    prisma.scheduledPrompt.findMany({
      where: { userId },
      select: {
        id: true,
        model: true,
        scheduleType: true,
        status: true,
        createdAt: true,
        scheduledAt: true,
        executedAt: true,
      },
    }),
    prisma.session.findMany({
      where: { userId },
      select: {
        id: true,
        expires: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        action: true,
        resource: true,
        createdAt: true,
        // Exclude details to avoid leaking PII in older logs
      },
    }),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    user,
    subscription,
    apiKeys,
    providerConnections,
    creditBalance,
    creditTransactions,
    scheduledPrompts,
    sessions,
    auditLogs,
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="inferlane-export-${userId}.json"`,
    },
  });
}

export const GET = withTiming(handleGET);
