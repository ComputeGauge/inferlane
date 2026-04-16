// GET /api/admin/treasury/health — admin-only readiness report for
// the treasury layer. Aggregates Stripe Treasury + Fireblocks +
// ledger reconciliation status.

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-api-key';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import { checkReadiness as checkStripeTreasury } from '@/lib/treasury/adapters/stripe-treasury';
import { checkFireblocksReadiness } from '@/lib/treasury/adapters/fireblocks';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`admin-treasury:${auth.userId}`, 30, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { role: true },
  });
  if (user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [stripe, fireblocks, lastEntry] = await Promise.all([
    checkStripeTreasury().catch((err) => ({
      enabled: false,
      envComplete: false,
      accountReachable: false,
      balanceUsdCents: null,
      issues: [err instanceof Error ? err.message : String(err)],
    })),
    checkFireblocksReadiness().catch((err) => ({
      enabled: false,
      envComplete: false,
      vaultReachable: false,
      issues: [err instanceof Error ? err.message : String(err)],
    })),
    prisma.ledgerEntry.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { id: true, eventType: true, createdAt: true },
    }),
  ]);

  return NextResponse.json({
    stripeTreasury: {
      enabled: stripe.enabled,
      envComplete: stripe.envComplete,
      accountReachable: stripe.accountReachable,
      balanceUsdCents: 'balanceUsdCents' in stripe && stripe.balanceUsdCents !== null
        ? stripe.balanceUsdCents.toString()
        : null,
      issues: stripe.issues,
    },
    fireblocks,
    ledger: {
      lastEntryId: lastEntry?.id ?? null,
      lastEventType: lastEntry?.eventType ?? null,
      lastEntryAt: lastEntry?.createdAt.toISOString() ?? null,
    },
    generatedAt: new Date().toISOString(),
  });
}
