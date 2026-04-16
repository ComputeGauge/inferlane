// POST /api/wallet/deposit — record a buyer wallet deposit.
//
// Commercial build, Phase F1.4. This is the webhook-friendly entry
// point used by Stripe webhooks, Tether webhooks, and the manual
// admin-credit path. Idempotent by (source, externalId).
//
// Note: this route does NOT accept raw card data. Real deposits
// begin at the Stripe Checkout page and get confirmed via the
// Stripe webhook handler which calls into this route with an
// already-confirmed amount. The manual credit path is guarded by
// role + step-up token.

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-api-key';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import { recordDeposit } from '@/lib/wallets/buyer-wallet';
import { requireStepUp, StepUpRequiredError } from '@/lib/security/step-up';

const VALID_SOURCES = new Set([
  'STRIPE_CARD',
  'STRIPE_ACH',
  'TETHER_USDT',
  'MANUAL_CREDIT',
]);

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`wallet-deposit:${auth.userId}`, 30, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const source = body.source as string | undefined;
  const externalId = body.externalId as string | undefined;
  const amountUsdCentsRaw = body.amountUsdCents;
  const idempotencyKey = body.idempotencyKey as string | undefined;
  const targetUserId = (body.targetUserId as string | undefined) ?? auth.userId;

  if (!source || !VALID_SOURCES.has(source)) {
    return NextResponse.json(
      { error: `source must be one of: ${Array.from(VALID_SOURCES).join(', ')}` },
      { status: 400 },
    );
  }
  if (!externalId || !idempotencyKey || amountUsdCentsRaw == null) {
    return NextResponse.json(
      { error: 'externalId, idempotencyKey, and amountUsdCents are required' },
      { status: 400 },
    );
  }

  let amountUsdCents: bigint;
  try {
    amountUsdCents = BigInt(amountUsdCentsRaw as number | string);
  } catch {
    return NextResponse.json(
      { error: 'amountUsdCents must be a valid integer' },
      { status: 400 },
    );
  }
  if (amountUsdCents <= BigInt(0)) {
    return NextResponse.json({ error: 'amountUsdCents must be positive' }, { status: 400 });
  }

  // Manual credits require step-up re-auth and ADMIN role — operators
  // cannot print money for themselves.
  if (source === 'MANUAL_CREDIT') {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { role: true },
    });
    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    try {
      requireStepUp(
        req.headers.get('x-step-up-token'),
        auth.userId,
        'ledger.adjust',
      );
    } catch (err) {
      if (err instanceof StepUpRequiredError) {
        return NextResponse.json(
          { error: 'Step-up authentication required', scope: err.scope },
          { status: 401 },
        );
      }
      throw err;
    }
  }

  // Route to the wallet service, which posts a double-entry ledger
  // row. Failures bubble up as 500.
  try {
    const balance = await recordDeposit({
      userId: targetUserId,
      amountUsdCents,
      source: source as 'STRIPE_CARD' | 'STRIPE_ACH' | 'TETHER_USDT' | 'MANUAL_CREDIT',
      externalId,
      idempotencyKey,
    });

    return NextResponse.json({
      balance: {
        userId: balance.userId,
        availableUsdCents: balance.availableUsdCents.toString(),
        reservedUsdCents: balance.reservedUsdCents.toString(),
        totalUsdCents: balance.totalUsdCents.toString(),
        lastUpdatedAt: balance.lastUpdatedAt.toISOString(),
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
