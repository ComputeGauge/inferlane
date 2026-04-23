import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';

// ---------------------------------------------------------------------------
// POST /api/credits/offers/[offerId]/buy — Purchase credits from an offer
// ---------------------------------------------------------------------------
async function handlePOST(
  req: NextRequest,
  { params }: { params: Promise<{ offerId: string }> },
) {
  // GATED: peer-to-peer credit purchase is disabled by default.
  // Variable-priced trading of service credits among users can be construed
  // as securities / commodities exchange activity. Do not enable without
  // securities counsel sign-off. See _internal/HUMAN_TASKS.md task F4.
  if (process.env.CREDIT_MARKETPLACE_ENABLED !== '1') {
    return NextResponse.json(
      {
        error: 'Credit purchases from other users are not currently available.',
        reason: 'Peer-to-peer credit trading is disabled pending compliance review. kT credits are service-redemption units. See https://inferlane.dev/legal/not-a-financial-product for details.',
      },
      { status: 410 },
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const { offerId } = await params;

  // Rate limit: 10 req/min per user
  const rl = await rateLimit(`credits-buy:${userId}`, 10, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const body = await req.json();
  const { amount } = body as { amount: number };

  if (typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Fetch and validate offer (Serializable prevents concurrent modifications)
      const offer = await tx.creditOffer.findUnique({ where: { id: offerId } });

      if (!offer) {
        throw new Error('NOT_FOUND');
      }
      if (offer.status !== 'ACTIVE' && offer.status !== 'PARTIALLY_FILLED') {
        throw new Error('OFFER_NOT_ACTIVE');
      }
      if (offer.expiresAt && offer.expiresAt <= new Date()) {
        // Mark as expired while we're here
        await tx.creditOffer.update({
          where: { id: offerId },
          data: { status: 'EXPIRED' },
        });
        throw new Error('OFFER_EXPIRED');
      }
      if (offer.sellerId === userId) {
        throw new Error('CANNOT_BUY_OWN');
      }

      const remaining = Number(offer.amount) - Number(offer.filledAmount);
      if (amount > remaining) {
        throw new Error('EXCEEDS_REMAINING');
      }
      if (offer.minPurchase && amount < Number(offer.minPurchase)) {
        throw new Error('BELOW_MINIMUM');
      }

      const cost = amount * Number(offer.pricePerUnit);
      const newFilledAmount = Number(offer.filledAmount) + amount;
      const fullyFilled = newFilledAmount >= Number(offer.amount);

      // --- Seller side ---
      const sellerBalance = await tx.creditBalance.findUnique({
        where: { userId: offer.sellerId },
      });
      if (!sellerBalance) {
        throw new Error('SELLER_BALANCE_NOT_FOUND');
      }

      await tx.creditBalance.update({
        where: { userId: offer.sellerId },
        data: {
          listedOnMarket: { decrement: amount },
          earned: { increment: cost },
        },
      });

      await tx.creditTransaction.create({
        data: {
          userId: offer.sellerId,
          type: 'MARKET_SALE',
          amount,
          balanceBefore: Number(sellerBalance.available),
          balanceAfter: Number(sellerBalance.available), // available unchanged; earned increases
          counterpartyId: userId,
          offerId,
        },
      });

      // --- Buyer side ---
      // Upsert buyer balance (they may not have one yet)
      const buyerBalance = await tx.creditBalance.upsert({
        where: { userId },
        create: {
          userId,
          totalAllocated: 0,
          available: 0,
          delegatedToPool: 0,
          listedOnMarket: 0,
          earned: 0,
        },
        update: {},
      });

      const buyerAvailableBefore = Number(buyerBalance.available);

      await tx.creditBalance.update({
        where: { userId },
        data: {
          available: { increment: amount },
        },
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          type: 'MARKET_PURCHASE',
          amount,
          balanceBefore: buyerAvailableBefore,
          balanceAfter: buyerAvailableBefore + amount,
          counterpartyId: offer.sellerId,
          offerId,
        },
      });

      // --- Update offer ---
      const updatedOffer = await tx.creditOffer.update({
        where: { id: offerId },
        data: {
          filledAmount: { increment: amount },
          status: fullyFilled ? 'FILLED' : 'PARTIALLY_FILLED',
          ...(fullyFilled ? { buyerId: userId } : {}),
        },
      });

      // --- Audit logs ---
      await tx.auditLog.create({
        data: {
          userId: offer.sellerId,
          action: 'CREDIT_OFFER_SALE',
          resource: `credit_offer:${offerId}`,
          details: {
            offerId,
            buyerId: userId,
            amount,
            cost,
            newFilledAmount,
            fullyFilled,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREDIT_OFFER_PURCHASE',
          resource: `credit_offer:${offerId}`,
          details: {
            offerId,
            sellerId: offer.sellerId,
            amount,
            cost,
            newFilledAmount,
            fullyFilled,
          },
        },
      });

      return {
        purchased: amount,
        cost,
        offerStatus: updatedOffer.status,
        remaining: Number(updatedOffer.amount) - Number(updatedOffer.filledAmount),
      };
    }, {
      isolationLevel: 'Serializable' as const,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    const errorMap: Record<string, { msg: string; status: number }> = {
      NOT_FOUND: { msg: 'Offer not found', status: 404 },
      OFFER_NOT_ACTIVE: { msg: 'Offer is no longer active', status: 400 },
      OFFER_EXPIRED: { msg: 'Offer has expired', status: 400 },
      CANNOT_BUY_OWN: { msg: 'You cannot buy your own offer', status: 400 },
      EXCEEDS_REMAINING: { msg: 'Amount exceeds remaining credits on this offer', status: 400 },
      BELOW_MINIMUM: { msg: 'Amount is below the minimum purchase for this offer', status: 400 },
      SELLER_BALANCE_NOT_FOUND: { msg: 'Seller balance not found', status: 500 },
    };

    const mapped = errorMap[message];
    if (mapped) {
      return NextResponse.json({ error: mapped.msg }, { status: mapped.status });
    }

    console.error('[POST /api/credits/offers/[offerId]/buy]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withTiming(handlePOST);
