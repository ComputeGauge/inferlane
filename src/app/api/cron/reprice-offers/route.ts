import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { needsRepricing, calculatePriceBounds } from '@/lib/credits/pricing';
import { verifyCronSecret, unauthorizedResponse } from '@/lib/cron-auth';

// ---------------------------------------------------------------------------
// POST /api/cron/reprice-offers — Hourly auto-reprice for decaying credits
// ---------------------------------------------------------------------------
// Finds active offers where autoReprice=true and current pricePerUnit exceeds
// the time-decay ceiling. Reduces price to the new ceiling. Creates
// MARKET_REPRICE transaction for audit trail.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return unauthorizedResponse();
  }

  try {
    const now = new Date();

    // Find all active offers that opted into auto-repricing
    const offers = await prisma.creditOffer.findMany({
      where: {
        status: { in: ['ACTIVE', 'PARTIALLY_FILLED'] },
        autoReprice: true,
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        sellerId: true,
        pricePerUnit: true,
        repriceFloor: true,
        amount: true,
        filledAmount: true,
        expiresAt: true,
      },
    });

    let repriced = 0;
    const details: Array<{
      offerId: string;
      oldPrice: number;
      newPrice: number;
      daysRemaining: number;
    }> = [];

    for (const offer of offers) {
      const currentPrice = Number(offer.pricePerUnit);
      const check = needsRepricing(currentPrice, offer.expiresAt, now);

      if (!check.needsReprice) continue;

      const bounds = calculatePriceBounds(offer.expiresAt, now);
      let newPrice = bounds.ceiling;
      const sellerFloor = offer.repriceFloor ? Number(offer.repriceFloor) : null;

      // Respect seller's repriceFloor: if ceiling drops below floor, cancel offer instead
      if (sellerFloor !== null && newPrice < sellerFloor) {
        // Cancel the offer — return credits to seller
        const remaining = Number(offer.amount) - Number(offer.filledAmount);
        await prisma.$transaction(async (tx) => {
          const balance = await tx.creditBalance.findUnique({ where: { userId: offer.sellerId } });
          if (balance) {
            await tx.creditBalance.update({
              where: { userId: offer.sellerId },
              data: {
                available: { increment: remaining },
                listedOnMarket: { decrement: remaining },
              },
            });
            await tx.creditTransaction.create({
              data: {
                userId: offer.sellerId,
                type: 'MARKET_DELIST',
                amount: remaining,
                balanceBefore: Number(balance.available),
                balanceAfter: Number(balance.available) + remaining,
                offerId: offer.id,
                description: `Auto-cancelled: ceiling $${newPrice.toFixed(4)} dropped below repriceFloor $${sellerFloor.toFixed(4)}`,
              },
            });
          }
          await tx.creditOffer.update({ where: { id: offer.id }, data: { status: 'CANCELLED' } });
          await tx.auditLog.create({
            data: {
              userId: offer.sellerId,
              action: 'CREDIT_OFFER_AUTO_CANCELLED',
              resource: `credit_offer:${offer.id}`,
              details: { offerId: offer.id, ceiling: newPrice, repriceFloor: sellerFloor, reason: 'ceiling_below_floor' },
            },
          });
        });
        details.push({ offerId: offer.id, oldPrice: currentPrice, newPrice: 0, daysRemaining: bounds.daysRemaining });
        repriced++;
        continue;
      }

      // Clamp to seller floor if set
      if (sellerFloor !== null) {
        newPrice = Math.max(newPrice, sellerFloor);
      }

      const remaining = Number(offer.amount) - Number(offer.filledAmount);
      const newTotalPrice = remaining * newPrice;

      await prisma.$transaction(async (tx) => {
        // Update offer price
        await tx.creditOffer.update({
          where: { id: offer.id },
          data: {
            pricePerUnit: newPrice,
            totalPrice: newTotalPrice,
          },
        });

        // Record repricing transaction
        await tx.creditTransaction.create({
          data: {
            userId: offer.sellerId,
            type: 'MARKET_REPRICE',
            amount: remaining,
            balanceBefore: 0, // repricing doesn't change balance
            balanceAfter: 0,
            offerId: offer.id,
            description: `Auto-repriced from $${currentPrice.toFixed(4)} to $${newPrice.toFixed(4)} (${bounds.daysRemaining.toFixed(1)} days remaining, ${bounds.urgency} urgency)`,
          },
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            userId: offer.sellerId,
            action: 'CREDIT_OFFER_REPRICED',
            resource: `credit_offer:${offer.id}`,
            details: {
              offerId: offer.id,
              oldPrice: currentPrice,
              newPrice,
              daysRemaining: bounds.daysRemaining,
              urgency: bounds.urgency,
              decayPct: bounds.decayPct,
            },
          },
        });
      });

      repriced++;
      details.push({
        offerId: offer.id,
        oldPrice: currentPrice,
        newPrice,
        daysRemaining: bounds.daysRemaining,
      });
    }

    console.log(
      `[Reprice] Checked ${offers.length} offers, repriced ${repriced}`,
    );

    return NextResponse.json({
      success: true,
      checked: offers.length,
      repriced,
      details,
    });
  } catch (error) {
    console.error('[Reprice] Error:', error);
    return NextResponse.json({ error: 'Reprice failed' }, { status: 500 });
  }
}
