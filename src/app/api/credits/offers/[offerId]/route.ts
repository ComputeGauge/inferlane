import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { withTiming } from '@/lib/api-timing';

// ---------------------------------------------------------------------------
// GET /api/credits/offers/[offerId] — Single offer details
// ---------------------------------------------------------------------------
async function handleGET(
  req: NextRequest,
  { params }: { params: Promise<{ offerId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { offerId } = await params;

  const offer = await prisma.creditOffer.findUnique({
    where: { id: offerId },
    select: {
      id: true,
      sellerId: true,
      amount: true,
      pricePerUnit: true,
      totalPrice: true,
      minPurchase: true,
      status: true,
      filledAmount: true,
      buyerId: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!offer) {
    return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
  }

  return NextResponse.json({
    offer: {
      ...offer,
      amount: Number(offer.amount),
      pricePerUnit: Number(offer.pricePerUnit),
      totalPrice: Number(offer.totalPrice),
      minPurchase: offer.minPurchase ? Number(offer.minPurchase) : null,
      filledAmount: Number(offer.filledAmount),
      remaining: Number(offer.amount) - Number(offer.filledAmount),
    },
  });
}

// ---------------------------------------------------------------------------
// DELETE /api/credits/offers/[offerId] — Cancel own active offer
// ---------------------------------------------------------------------------
async function handleDELETE(
  req: NextRequest,
  { params }: { params: Promise<{ offerId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const { offerId } = await params;

  try {
    await prisma.$transaction(async (tx) => {
      const offer = await tx.creditOffer.findUnique({
        where: { id: offerId },
      });

      if (!offer) {
        throw new Error('NOT_FOUND');
      }
      if (offer.sellerId !== userId) {
        throw new Error('FORBIDDEN');
      }
      if (offer.status !== 'ACTIVE' && offer.status !== 'PARTIALLY_FILLED') {
        throw new Error('INVALID_STATUS');
      }

      const unfilledAmount = Number(offer.amount) - Number(offer.filledAmount);

      // Return unfilled credits to available balance
      const balance = await tx.creditBalance.findUnique({ where: { userId } });
      if (!balance) {
        throw new Error('BALANCE_NOT_FOUND');
      }

      await tx.creditBalance.update({
        where: { userId },
        data: {
          available: { increment: unfilledAmount },
          listedOnMarket: { decrement: unfilledAmount },
        },
      });

      // Mark offer cancelled
      await tx.creditOffer.update({
        where: { id: offerId },
        data: { status: 'CANCELLED' },
      });

      // Record delist transaction
      await tx.creditTransaction.create({
        data: {
          userId,
          type: 'MARKET_DELIST',
          amount: unfilledAmount,
          balanceBefore: Number(balance.available),
          balanceAfter: Number(balance.available) + unfilledAmount,
          offerId,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREDIT_OFFER_CANCELLED',
          resource: `credit_offer:${offerId}`,
          details: {
            offerId,
            returnedAmount: unfilledAmount,
            filledAmount: Number(offer.filledAmount),
          },
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'You can only cancel your own offers' }, { status: 403 });
    }
    if (message === 'INVALID_STATUS') {
      return NextResponse.json({ error: 'Offer is not active' }, { status: 400 });
    }
    console.error('[DELETE /api/credits/offers/[offerId]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withTiming(handleGET);
export const DELETE = withTiming(handleDELETE);
