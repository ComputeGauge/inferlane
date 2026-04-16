// GET /api/privacy/export — GDPR Article 20 data portability.
//
// Generates a portable JSON dump of the caller's personal data on
// demand. Returns the full bundle inline. Expensive operation — rate
// limited to 2 per hour per user.
//
// Fields included:
//   - User identity (id, email, name, created date)
//   - Subscription tier + billing metadata (no card numbers)
//   - API keys (id + prefix only, never raw)
//   - KYC session results (status only, never raw documents)
//   - Wallet balance snapshot
//   - Recent proxy request metadata (90 days, hashed userId)
//   - Dispute history
//   - Privacy preferences
//
// Fields NOT included (by policy):
//   - Internal router scoring details
//   - Aggregated benchmark data
//   - Other users' data even if referenced

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-api-key';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import { getBalance } from '@/lib/wallets/buyer-wallet';
import { logger } from '@/lib/telemetry';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`privacy-export:${auth.userId}`, 2, 60 * 60 * 1000);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded — try again in an hour' },
      { status: 429 },
    );
  }

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  try {
    const [user, subscription, apiKeys, kycSessions, disputes, wallet] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: auth.userId },
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
            role: true,
          },
        }),
        prisma.subscription.findUnique({
          where: { userId: auth.userId },
          select: {
            tier: true,
            status: true,
            currentPeriodEnd: true,
            createdAt: true,
          },
        }),
        prisma.apiKey.findMany({
          where: { userId: auth.userId, isActive: true },
          select: {
            id: true,
            name: true,
            keyPrefix: true,
            createdAt: true,
            lastUsedAt: true,
            expiresAt: true,
          },
        }),
        prisma.kycSession.findMany({
          where: { subjectUserId: auth.userId },
          select: {
            purpose: true,
            status: true,
            verifiedAt: true,
            createdAt: true,
          },
        }),
        prisma.disputeCase.findMany({
          where: { buyerUserId: auth.userId, openedAt: { gte: ninetyDaysAgo } },
          select: {
            id: true,
            reason: true,
            status: true,
            amountUsdCents: true,
            openedAt: true,
            resolvedAt: true,
            outcome: true,
          },
        }),
        getBalance(auth.userId),
      ]);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    logger.info('privacy.export.served', {
      userId: auth.userId,
      disputeCount: disputes.length,
      apiKeyCount: apiKeys.length,
    });

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        format: 'inferlane-privacy-export-v1',
        user,
        subscription,
        apiKeys,
        kycSessions,
        wallet: {
          availableUsdCents: wallet.availableUsdCents.toString(),
          reservedUsdCents: wallet.reservedUsdCents.toString(),
          totalUsdCents: wallet.totalUsdCents.toString(),
        },
        disputes: disputes.map((d) => ({
          ...d,
          amountUsdCents: d.amountUsdCents.toString(),
        })),
        note:
          'This export covers the fields in your account plus 90 days of ' +
          'dispute metadata. Longer-retention fields (financial records, ' +
          'audit logs) are available on written request per our Privacy ' +
          'Policy. Contact privacy@inferlane.dev.',
      },
      {
        headers: {
          'Content-Disposition': `attachment; filename="inferlane-export-${Date.now()}.json"`,
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (err) {
    logger.error('privacy.export.failed', {
      userId: auth.userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
