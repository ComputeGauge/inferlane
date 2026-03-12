import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import Stripe from 'stripe';

// Disable body parsing — Stripe needs raw body for signature verification
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const tier = session.metadata?.tier;

        if (userId && tier) {
          await prisma.subscription.update({
            where: { userId },
            data: {
              stripeSubscriptionId: session.subscription as string,
              tier: tier as 'PRO' | 'HYBRID' | 'TEAM' | 'ENTERPRISE',
              status: 'ACTIVE',
            },
          });

          await prisma.auditLog.create({
            data: {
              userId,
              action: 'SUBSCRIPTION_UPGRADED',
              resource: 'subscription',
              details: { tier, sessionId: session.id },
            },
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subAny = sub as any;
        const dbSub = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: sub.id },
        });

        if (dbSub) {
          await prisma.subscription.update({
            where: { stripeSubscriptionId: sub.id },
            data: {
              status: mapStripeStatus(sub.status),
              ...(subAny.current_period_start && {
                currentPeriodStart: new Date(subAny.current_period_start * 1000),
              }),
              ...(subAny.current_period_end && {
                currentPeriodEnd: new Date(subAny.current_period_end * 1000),
              }),
              cancelAtPeriodEnd: subAny.cancel_at_period_end ?? false,
            },
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            tier: 'FREE',
            status: 'CANCELED',
            stripeSubscriptionId: null,
            stripePriceId: null,
          },
        });
        break;
      }

      case 'invoice.payment_failed': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string | null;
        if (subscriptionId) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: subscriptionId },
            data: { status: 'PAST_DUE' },
          });
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

function mapStripeStatus(status: string): 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING' | 'INCOMPLETE' {
  switch (status) {
    case 'active': return 'ACTIVE';
    case 'past_due': return 'PAST_DUE';
    case 'canceled': return 'CANCELED';
    case 'trialing': return 'TRIALING';
    case 'incomplete': return 'INCOMPLETE';
    default: return 'ACTIVE';
  }
}
