import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stripe, SUPPLIER_TIER_PRICE_MAP } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { withTiming } from '@/lib/api-timing';
import { handleApiError } from '@/lib/api-errors';

// ---------------------------------------------------------------------------
// POST /api/stripe/supplier-checkout — Create Stripe Checkout for supplier tiers
// ---------------------------------------------------------------------------

async function handlePOST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as Record<string, unknown>).id as string;

    // Must be a registered node operator
    const nodeOperator = await prisma.nodeOperator.findUnique({
      where: { userId },
      select: { id: true, supplierSubscription: { select: { id: true, stripeSubscriptionId: true, tier: true } } },
    });

    if (!nodeOperator) {
      return NextResponse.json(
        { error: 'You must be a registered node operator to subscribe to a supplier plan' },
        { status: 403 },
      );
    }

    // If already on a paid supplier tier with active Stripe sub, redirect to portal
    if (nodeOperator.supplierSubscription?.stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'You already have an active supplier subscription. Use the billing portal to manage it.' },
        { status: 409 },
      );
    }

    let body;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { tier } = body as { tier?: string };

    if (!tier || !['PROFESSIONAL', 'ENTERPRISE'].includes(tier)) {
      return NextResponse.json(
        { error: 'Invalid tier. Must be PROFESSIONAL or ENTERPRISE' },
        { status: 400 },
      );
    }

    const priceId = SUPPLIER_TIER_PRICE_MAP[tier];
    if (!priceId) {
      return NextResponse.json(
        { error: `Stripe price not configured for supplier tier: ${tier}` },
        { status: 500 },
      );
    }

    // Get or create Stripe customer (reuse from buyer subscription if exists)
    const buyerSub = await prisma.subscription.findUnique({
      where: { userId },
      select: { stripeCustomerId: true },
    });

    let customerId = buyerSub?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: (session.user as Record<string, unknown>).email as string || undefined,
        name: (session.user as Record<string, unknown>).name as string || undefined,
        metadata: { userId, nodeOperatorId: nodeOperator.id },
      });
      customerId = customer.id;

      // Save customer ID on buyer subscription too (shared customer)
      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          stripeCustomerId: customerId,
          tier: 'FREE',
          status: 'ACTIVE',
        },
        update: {
          stripeCustomerId: customerId,
        },
      });
    }

    // Create Stripe Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL || process.env.NEXTAUTH_URL}/dashboard/nodes?upgraded=true`,
      cancel_url: `${process.env.APP_URL || process.env.NEXTAUTH_URL}/dashboard/nodes`,
      metadata: {
        userId,
        nodeOperatorId: nodeOperator.id,
        tier,
        subscriptionType: 'supplier',
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    return handleApiError(error, 'SupplierCheckout');
  }
}

export const POST = withTiming(handlePOST);
