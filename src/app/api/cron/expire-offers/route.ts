import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCronSecret, unauthorizedResponse } from '@/lib/cron-auth';

/**
 * POST /api/cron/expire-offers — Expire stale marketplace offers.
 *
 * Finds all ACTIVE/PARTIALLY_FILLED offers past their expiresAt,
 * returns unfilled credits to seller's available balance,
 * and records MARKET_DELIST + EXPIRY transactions.
 *
 * Should run hourly via cron scheduler.
 */
export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  try {
    const now = new Date();

    // Find all expired offers that haven't been settled
    const expiredOffers = await prisma.creditOffer.findMany({
      where: {
        status: { in: ['ACTIVE', 'PARTIALLY_FILLED'] },
        expiresAt: { lte: now },
      },
    });

    let processed = 0;
    let creditsReturned = 0;

    for (const offer of expiredOffers) {
      const unfilled = Number(offer.amount) - Number(offer.filledAmount);
      if (unfilled <= 0) {
        // Fully filled, just mark as FILLED
        await prisma.creditOffer.update({
          where: { id: offer.id },
          data: { status: 'FILLED' },
        });
        continue;
      }

      await prisma.$transaction(async (tx) => {
        // Return unfilled credits to seller
        const balance = await tx.creditBalance.findUnique({
          where: { userId: offer.sellerId },
        });

        if (balance) {
          await tx.creditBalance.update({
            where: { userId: offer.sellerId },
            data: {
              available: { increment: unfilled },
              listedOnMarket: { decrement: unfilled },
            },
          });

          // Record delist transaction
          await tx.creditTransaction.create({
            data: {
              userId: offer.sellerId,
              type: 'MARKET_DELIST',
              amount: unfilled,
              balanceBefore: Number(balance.available),
              balanceAfter: Number(balance.available) + unfilled,
              offerId: offer.id,
            },
          });
        }

        // Mark offer as expired
        await tx.creditOffer.update({
          where: { id: offer.id },
          data: { status: 'EXPIRED' },
        });

        // Audit
        await tx.auditLog.create({
          data: {
            userId: offer.sellerId,
            action: 'CREDIT_OFFER_EXPIRED',
            resource: `credit_offer:${offer.id}`,
            details: {
              offerId: offer.id,
              unfilledAmount: unfilled,
              filledAmount: Number(offer.filledAmount),
              expiresAt: offer.expiresAt.toISOString(),
            },
          },
        });
      });

      processed++;
      creditsReturned += unfilled;
    }

    return NextResponse.json({
      processed,
      creditsReturned,
      totalExpired: expiredOffers.length,
    });
  } catch (err) {
    console.error('[Expire Offers Cron] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
