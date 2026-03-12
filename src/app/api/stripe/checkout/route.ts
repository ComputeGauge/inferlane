import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stripe, TIER_PRICE_MAP } from '@/lib/stripe';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tier } = await req.json();
    const priceId = TIER_PRICE_MAP[tier];

    if (!priceId) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    // Get or create Stripe customer
    let subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });

    let customerId = subscription?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email || undefined,
        name: session.user.name || undefined,
        metadata: { userId: session.user.id },
      });
      customerId = customer.id;

      // Save Stripe customer ID
      if (subscription) {
        await prisma.subscription.update({
          where: { userId: session.user.id },
          data: { stripeCustomerId: customerId },
        });
      } else {
        await prisma.subscription.create({
          data: {
            userId: session.user.id,
            stripeCustomerId: customerId,
            tier: 'FREE',
            status: 'ACTIVE',
          },
        });
      }
    }

    // Create Stripe Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL}/dashboard?upgraded=true`,
      cancel_url: `${process.env.APP_URL}/pricing`,
      metadata: {
        userId: session.user.id,
        tier,
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('[Stripe Checkout]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
