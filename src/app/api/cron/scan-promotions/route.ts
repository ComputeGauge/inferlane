// ---------------------------------------------------------------------------
// POST /api/cron/scan-promotions — Scan provider sources for new promotions
// ---------------------------------------------------------------------------
// Called by external cron. Scans all provider source URLs, classifies new
// content, upserts promotions, and sends email alerts.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { scanProviderSources } from '@/lib/promotions/monitor';
import { verifyCronSecret, unauthorizedResponse } from '@/lib/cron-auth';

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  try {
    const scanResults = await scanProviderSources();

    let scanned = 0;
    let changed = 0;
    let promotionsDetected = 0;
    let alertsSent = 0;
    const errors: string[] = [];
    const newPromotionIds: string[] = [];

    for (const result of scanResults) {
      scanned++;

      if (!result.changed) continue;
      changed++;

      if (!result.promotion) continue;
      promotionsDetected++;

      const promo = result.promotion;

      try {
        // Upsert: match on provider + sourceUrl to avoid duplicates
        const existing = await prisma.providerPromotion.findFirst({
          where: {
            provider: promo.provider,
            sourceUrl: promo.sourceUrl,
            title: promo.title,
          },
        });

        let promotionId: string;

        if (existing) {
          // Update if confidence improved
          if (promo.confidence > existing.confidence) {
            await prisma.providerPromotion.update({
              where: { id: existing.id },
              data: {
                rawDescription: promo.rawDescription,
                confidence: promo.confidence,
                multiplier: promo.multiplier,
                eligiblePlans: promo.eligiblePlans,
                ...(promo.startsAt && { startsAt: promo.startsAt }),
                ...(promo.endsAt && { endsAt: promo.endsAt }),
              },
            });
          }
          promotionId = existing.id;
        } else {
          // Create new promotion
          const now = new Date();
          const startsAt = promo.startsAt || now;
          const endsAt = promo.endsAt || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // default 30 days

          const created = await prisma.providerPromotion.create({
            data: {
              provider: promo.provider,
              title: promo.title,
              type: promo.type,
              sourceUrl: promo.sourceUrl,
              startsAt,
              endsAt,
              eligiblePlans: promo.eligiblePlans,
              multiplier: promo.multiplier,
              offPeakOnly: promo.offPeakOnly,
              affectedSurfaces: [],
              rawDescription: promo.rawDescription,
              confidence: promo.confidence,
              status: startsAt <= now ? 'ACTIVE' : 'UPCOMING',
            },
          });

          promotionId = created.id;
          newPromotionIds.push(promotionId);

          // Send alerts for genuinely new promotions
          if (promo.confidence >= 0.4) {
            try {
              const sent = await sendPromotionAlerts(promo);
              alertsSent += sent;
            } catch (alertErr) {
              console.error('[ScanPromotions] Alert send failed:', alertErr);
              errors.push(`Alert failed for "${promo.title}": ${String(alertErr)}`);
            }
          }
        }
      } catch (dbErr) {
        console.error(`[ScanPromotions] DB error for ${promo.title}:`, dbErr);
        errors.push(`DB error for "${promo.title}": ${String(dbErr)}`);
      }
    }

    // Expire old promotions that have passed their endsAt
    const expired = await prisma.providerPromotion.updateMany({
      where: {
        status: 'ACTIVE',
        endsAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });

    // Activate upcoming promotions that have reached their startsAt
    const activated = await prisma.providerPromotion.updateMany({
      where: {
        status: 'UPCOMING',
        startsAt: { lte: new Date() },
      },
      data: { status: 'ACTIVE' },
    });

    return NextResponse.json({
      scanned,
      changed,
      promotionsDetected,
      newPromotions: newPromotionIds.length,
      alertsSent,
      expired: expired.count,
      activated: activated.count,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('[ScanPromotions] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ── Alert helpers ──────────────────────────────────────────────────────

async function sendPromotionAlerts(promo: {
  provider: string;
  title: string;
  sourceUrl: string;
  type: string;
  multiplier: number;
}): Promise<number> {
  // Find users who have alertEmails enabled
  const prefs = await prisma.notificationPreferences.findMany({
    where: { alertEmails: true },
    select: { userId: true },
  });

  if (prefs.length === 0) return 0;

  const userIds = prefs.map((p) => p.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { email: true, name: true },
  });

  let sent = 0;

  for (const user of users) {
    if (!user.email) continue;

    try {
      await sendEmail({
        to: user.email,
        subject: `[InferLane] New promotion detected: ${promo.provider}`,
        html: [
          `<h2>New Promotion Detected</h2>`,
          `<p>A new promotion has been detected for <strong>${promo.provider}</strong>:</p>`,
          `<ul>`,
          `  <li><strong>Title:</strong> ${promo.title}</li>`,
          `  <li><strong>Type:</strong> ${promo.type}</li>`,
          `  <li><strong>Multiplier:</strong> ${promo.multiplier}x</li>`,
          `  <li><strong>Source:</strong> <a href="${promo.sourceUrl}">${promo.sourceUrl}</a></li>`,
          `</ul>`,
          `<p>Log in to InferLane to view details and schedule prompts to take advantage of this promotion.</p>`,
        ].join('\n'),
      });
      sent++;
    } catch (emailErr) {
      console.error(`[ScanPromotions] Email to ${user.email} failed:`, emailErr);
    }
  }

  return sent;
}
