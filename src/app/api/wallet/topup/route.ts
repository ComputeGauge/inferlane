// POST /api/wallet/topup — create a Stripe Checkout session for wallet top-up.
//
// Buyer selects an amount on /dashboard/wallet, we create a
// Checkout Session in mode=payment with metadata identifying it as
// a wallet deposit, and return the session URL. The buyer redirects
// to Stripe, completes payment, and our /api/webhooks/stripe-deposits
// handler credits the wallet via recordDeposit() when the
// checkout.session.completed event arrives.

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-api-key';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { logger } from '@/lib/telemetry';

const MIN_TOPUP_CENTS = 500;           // $5 minimum
const MAX_TOPUP_CENTS = 500_000_00;    // $500K cap for a single top-up

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`wallet-topup:${auth.userId}`, 10, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const amountCents = Number(body.amountCents);
  if (!Number.isInteger(amountCents)) {
    return NextResponse.json(
      { error: 'amountCents must be an integer' },
      { status: 400 },
    );
  }
  if (amountCents < MIN_TOPUP_CENTS) {
    return NextResponse.json(
      { error: `Minimum top-up is $${(MIN_TOPUP_CENTS / 100).toFixed(2)}` },
      { status: 400 },
    );
  }
  if (amountCents > MAX_TOPUP_CENTS) {
    return NextResponse.json(
      { error: `Maximum single top-up is $${(MAX_TOPUP_CENTS / 100).toLocaleString()}` },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { email: true },
  });
  if (!user?.email) {
    return NextResponse.json({ error: 'Missing email on user' }, { status: 400 });
  }

  const origin =
    process.env.INFERLANE_PUBLIC_ORIGIN ??
    process.env.NEXTAUTH_URL ??
    'https://inferlane.dev';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'InferLane wallet top-up',
              description: 'Adds prepaid compute credit to your wallet. Refundable per our Refund Policy.',
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/dashboard/wallet?topup=success`,
      cancel_url: `${origin}/dashboard/wallet?topup=cancelled`,
      // The deposit webhook filters on this marker so wallet
      // deposits never bleed into the subscription webhook path.
      metadata: {
        inferlane_purpose: 'wallet_deposit',
        inferlane_user_id: auth.userId,
      },
      payment_intent_data: {
        metadata: {
          inferlane_purpose: 'wallet_deposit',
          inferlane_user_id: auth.userId,
        },
      },
    });

    logger.info('wallet.topup.session_created', {
      userId: auth.userId,
      amountCents,
      sessionId: session.id,
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (err) {
    logger.error('wallet.topup.stripe_failed', {
      userId: auth.userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 },
    );
  }
}
