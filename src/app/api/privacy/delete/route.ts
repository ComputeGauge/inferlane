// POST /api/privacy/delete — GDPR Article 17 right to erasure.
//
// Initiates account deletion. Does NOT immediately wipe the row;
// marks the account with `deletedAt` and schedules removal after a
// 30-day cooling-off window. During the cooling-off window the user
// can cancel the deletion.
//
// What gets deleted after 30 days:
//   - User.email, name, image (PII)
//   - API keys (hard delete)
//   - KYC session results (status retained as required by MSB regs)
//   - Wallet balance (must be zero — deletion blocked if non-zero)
//   - Privacy preferences
//
// What is RETAINED (legal obligation):
//   - Financial records (7 years — tax compliance)
//   - Audit logs (7 years)
//   - Identity verification records (5 years — MSB compliance)
//   - Settled workload records (anonymized, indefinitely)
//   - Dispute records (resolved disputes retain operator-side metadata
//     even after buyer deletion — symmetric protection)
//
// Requires step-up re-auth with scope `settings.delete_account`.

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-api-key';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import { getBalance } from '@/lib/wallets/buyer-wallet';
import { requireStepUp, StepUpRequiredError } from '@/lib/security/step-up';
import { logger } from '@/lib/telemetry';

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`privacy-delete:${auth.userId}`, 3, 60 * 60 * 1000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    requireStepUp(
      req.headers.get('x-step-up-token'),
      auth.userId,
      'settings.delete_account',
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

  // Block deletion if the wallet has a non-zero balance. The user
  // must withdraw funds first (via the operator payout rail or a
  // manual refund request).
  const balance = await getBalance(auth.userId);
  if (balance.totalUsdCents > BigInt(0)) {
    return NextResponse.json(
      {
        error: 'Withdraw wallet balance before deletion',
        availableUsdCents: balance.availableUsdCents.toString(),
        reservedUsdCents: balance.reservedUsdCents.toString(),
      },
      { status: 409 },
    );
  }

  // Schedule deletion: mark `deletedAt` and let the nightly
  // purge-deleted-accounts cron do the actual wipe after 30 days.
  const scheduled = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: auth.userId },
    data: { deletedAt: scheduled },
  });

  logger.info('privacy.delete.scheduled', {
    userId: auth.userId,
    scheduledAt: scheduled.toISOString(),
  });

  return NextResponse.json({
    ok: true,
    scheduledAt: scheduled.toISOString(),
    coolingOffHours: 30 * 24,
    message:
      'Account deletion scheduled. You have 30 days to cancel via ' +
      'POST /api/privacy/delete/cancel before the wipe runs.',
  });
}
