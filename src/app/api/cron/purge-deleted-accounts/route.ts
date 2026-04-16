// GET /api/cron/purge-deleted-accounts — daily wipe of accounts past
// their 30-day cooling-off window.
//
// GDPR Art. 17 compliance. Accounts marked for deletion via
// /api/privacy/delete get `deletedAt` set to now + 30 days. This
// cron walks that set daily and hard-deletes anything past its window
// while retaining legally-required records (financial, audit, KYC).

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret, unauthorizedResponse } from '@/lib/cron-auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/telemetry';

const MAX_PURGES_PER_RUN = 100;

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) return unauthorizedResponse();

  const started = Date.now();
  const now = new Date();

  // Pick users whose deletedAt has elapsed.
  const candidates = await prisma.user.findMany({
    where: {
      deletedAt: { not: null, lte: now },
    },
    select: { id: true, email: true },
    take: MAX_PURGES_PER_RUN,
  });

  let purged = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    try {
      await prisma.$transaction(async (tx) => {
        // Hard-delete PII columns while retaining the User row. We
        // keep the row id so historical foreign keys (audit logs,
        // financial records) still resolve to a pseudonymous
        // identifier rather than dangling.
        await tx.user.update({
          where: { id: candidate.id },
          data: {
            email: `deleted+${candidate.id}@purged.inferlane.dev`,
            name: null,
            image: null,
          },
        });

        // Hard-delete API keys — no legal retention reason.
        await tx.apiKey.deleteMany({ where: { userId: candidate.id } });

        // Hard-delete notification prefs and privacy policies.
        await tx.notificationPreferences.deleteMany({
          where: { userId: candidate.id },
        });

        // NOTE: we do NOT delete ProxyRequest, AuditLog, KycSession,
        // or financial records. Those have statutory retention
        // obligations (see commercial/legal/PRIVACY_POLICY.md § 6).
      });
      purged++;
      logger.info('privacy.purge.completed', { userId: candidate.id });
    } catch (err) {
      skipped++;
      logger.error('privacy.purge.failed', {
        userId: candidate.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    purged,
    skipped,
    durationMs: Date.now() - started,
  });
}
