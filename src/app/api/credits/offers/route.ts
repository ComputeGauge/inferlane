import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';
import { calculatePriceBounds, dealQuality } from '@/lib/credits/pricing';

// ---------------------------------------------------------------------------
// GET /api/credits/offers — List active offers (excludes caller's own)
// ---------------------------------------------------------------------------
async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const { searchParams } = new URL(req.url);

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const sortBy = searchParams.get('sortBy') || 'newest';
  const minAmount = parseFloat(searchParams.get('minAmount') || '0');

  const orderBy = (() => {
    switch (sortBy) {
      case 'price_asc':
        return { pricePerUnit: 'asc' as const };
      case 'price_desc':
        return { pricePerUnit: 'desc' as const };
      case 'amount_desc':
        return { amount: 'desc' as const };
      case 'newest':
      default:
        return { createdAt: 'desc' as const };
    }
  })();

  const where = {
    status: 'ACTIVE' as const,
    sellerId: { not: userId },
    expiresAt: { gt: new Date() },
    ...(minAmount > 0
      ? {
          amount: { gte: minAmount },
        }
      : {}),
  };

  const [offers, total] = await Promise.all([
    prisma.creditOffer.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        sellerId: true,
        amount: true,
        pricePerUnit: true,
        totalPrice: true,
        minPurchase: true,
        status: true,
        filledAmount: true,
        expiresAt: true,
        createdAt: true,
      },
    }),
    prisma.creditOffer.count({ where }),
  ]);

  const now = new Date();

  return NextResponse.json({
    offers: offers.map((o) => {
      const price = Number(o.pricePerUnit);
      const bounds = calculatePriceBounds(o.expiresAt, now);
      const deal = dealQuality(price, o.expiresAt, now);

      return {
        ...o,
        amount: Number(o.amount),
        pricePerUnit: price,
        totalPrice: Number(o.totalPrice),
        minPurchase: o.minPurchase ? Number(o.minPurchase) : null,
        filledAmount: Number(o.filledAmount),
        remaining: Number(o.amount) - Number(o.filledAmount),
        // Time-decay pricing info
        decay: {
          decayPct: bounds.decayPct,
          suggestedPrice: bounds.suggested,
          urgency: bounds.urgency,
          daysRemaining: bounds.daysRemaining,
          valueRetained: 100 - bounds.decayPct,
          isGoodDeal: deal.isGoodDeal,
          discountPct: deal.discountPct,
        },
      };
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// ---------------------------------------------------------------------------
// POST /api/credits/offers — Create a new offer
// ---------------------------------------------------------------------------
async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  const rl = await rateLimit(`credits-offers-create:${userId}`, 20, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const body = await req.json();
  const { amount, pricePerUnit, minPurchase, expiresInHours, autoReprice, repriceFloor } = body as {
    amount: number;
    pricePerUnit: number;
    minPurchase?: number;
    expiresInHours: number;
    autoReprice?: boolean;
    repriceFloor?: number;
  };

  // Validate inputs
  if (typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }
  if (typeof expiresInHours !== 'number' || expiresInHours < 1 || expiresInHours > 720) {
    return NextResponse.json({ error: 'expiresInHours must be between 1 and 720' }, { status: 400 });
  }

  // Fetch user's credit period to calculate dynamic price bounds
  const userBalance = await prisma.creditBalance.findUnique({
    where: { userId },
    select: { periodEnd: true },
  });

  const offerExpiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
  // Use the earlier of offer expiry and period end for pricing
  const effectiveExpiry = userBalance && userBalance.periodEnd < offerExpiresAt
    ? userBalance.periodEnd
    : offerExpiresAt;

  const bounds = calculatePriceBounds(effectiveExpiry);

  if (typeof pricePerUnit !== 'number' || pricePerUnit < bounds.floor || pricePerUnit > bounds.ceiling) {
    return NextResponse.json(
      {
        error: `pricePerUnit must be between $${bounds.floor.toFixed(2)} and $${bounds.ceiling.toFixed(2)} based on time remaining (${bounds.daysRemaining.toFixed(1)} days, ${bounds.urgency} urgency)`,
        bounds,
      },
      { status: 400 },
    );
  }
  if (minPurchase !== undefined && (typeof minPurchase !== 'number' || minPurchase <= 0)) {
    return NextResponse.json({ error: 'minPurchase must be a positive number' }, { status: 400 });
  }
  if (minPurchase !== undefined && minPurchase > amount) {
    return NextResponse.json({ error: 'minPurchase cannot exceed amount' }, { status: 400 });
  }

  // Check active offer limit
  const activeCount = await prisma.creditOffer.count({
    where: { sellerId: userId, status: 'ACTIVE' },
  });
  if (activeCount >= 10) {
    return NextResponse.json(
      { error: 'Maximum of 10 active offers allowed' },
      { status: 400 },
    );
  }

  const totalPrice = amount * pricePerUnit;
  const expiresAt = offerExpiresAt;

  try {
    const offer = await prisma.$transaction(async (tx) => {
      // Lock and check available balance
      const balance = await tx.creditBalance.findUnique({ where: { userId } });
      if (!balance || Number(balance.available) < amount) {
        throw new Error('Insufficient available credits');
      }

      // Decrease available, increase listedOnMarket
      await tx.creditBalance.update({
        where: { userId },
        data: {
          available: { decrement: amount },
          listedOnMarket: { increment: amount },
        },
      });

      // Create the offer
      const newOffer = await tx.creditOffer.create({
        data: {
          sellerId: userId,
          amount,
          pricePerUnit,
          totalPrice,
          minPurchase: minPurchase ?? null,
          autoReprice: autoReprice === true, // default false — opt-in
          repriceFloor: repriceFloor ?? null,
          status: 'ACTIVE',
          filledAmount: 0,
          expiresAt,
        },
      });

      // Record transaction
      const balanceAfter = Number(balance.available) - amount;
      await tx.creditTransaction.create({
        data: {
          userId,
          type: 'MARKET_LIST',
          amount,
          balanceBefore: Number(balance.available),
          balanceAfter,
          offerId: newOffer.id,
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREDIT_OFFER_CREATED',
          resource: `credit_offer:${newOffer.id}`,
          details: {
            offerId: newOffer.id,
            amount,
            pricePerUnit,
            totalPrice,
            expiresAt: expiresAt.toISOString(),
          },
        },
      });

      return newOffer;
    }, {
      isolationLevel: 'Serializable' as const,
    });

    return NextResponse.json(
      {
        offer: {
          ...offer,
          amount: Number(offer.amount),
          pricePerUnit: Number(offer.pricePerUnit),
          totalPrice: Number(offer.totalPrice),
          minPurchase: offer.minPurchase ? Number(offer.minPurchase) : null,
          filledAmount: Number(offer.filledAmount),
        },
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create offer';
    if (message === 'Insufficient available credits') {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('[POST /api/credits/offers]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withTiming(handleGET);
export const POST = withTiming(handlePOST);
