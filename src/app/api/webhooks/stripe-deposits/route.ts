// POST /api/webhooks/stripe-deposits — Stripe webhook handler for
// wallet top-ups.
//
// This is a dedicated webhook endpoint for buyer wallet deposits so
// the payment-intent + checkout-session logic for subscriptions
// doesn't have to change. Configure it in the Stripe dashboard as a
// separate webhook pointed at this URL, filtered to these events:
//
//   - payment_intent.succeeded
//   - charge.succeeded
//   - checkout.session.completed  (for hosted deposit flow)
//
// We identify wallet deposits by a metadata field `inferlane_purpose:
// wallet_deposit`. Any event missing that marker is ignored so this
// handler never races with the subscription webhook.
//
// Flow:
//   1. Verify the Stripe signature against STRIPE_DEPOSIT_WEBHOOK_SECRET
//   2. Parse the event
//   3. If purpose is wallet_deposit, extract amount + user + external id
//   4. Call recordDeposit() from buyer-wallet.ts (idempotent by
//      event.id + externalId)
//   5. Return 200 to Stripe — errors retry up to their limit

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { recordDeposit } from '@/lib/wallets/buyer-wallet';
import { logger } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

// Idempotency cache — in-memory set keyed by Stripe event id.
// Prevents double-crediting if Stripe retries a webhook for any
// reason. 24-hour TTL is longer than Stripe's retry window.
const processed = new Map<string, number>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function seen(eventId: string): boolean {
  const ts = processed.get(eventId);
  if (!ts) return false;
  if (Date.now() - ts > IDEMPOTENCY_TTL_MS) {
    processed.delete(eventId);
    return false;
  }
  return true;
}

function remember(eventId: string): void {
  processed.set(eventId, Date.now());
  if (processed.size > 10_000) {
    const cutoff = Date.now() - IDEMPOTENCY_TTL_MS;
    for (const [id, ts] of processed) {
      if (ts < cutoff) processed.delete(id);
    }
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig || !process.env.STRIPE_DEPOSIT_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_DEPOSIT_WEBHOOK_SECRET,
    );
  } catch (err) {
    logger.warn('stripe-deposit.webhook.signature_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Bad signature' }, { status: 400 });
  }

  if (seen(event.id)) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    // Narrow to the events we care about, then filter by metadata so
    // subscription events never bleed into this handler.
    let metadata: Record<string, string> | null = null;
    let amountCents: bigint | null = null;
    let source: 'STRIPE_CARD' | 'STRIPE_ACH' | null = null;

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent;
      metadata = (pi.metadata ?? {}) as Record<string, string>;
      if (pi.amount != null) amountCents = BigInt(pi.amount);
      source = 'STRIPE_CARD';
    } else if (event.type === 'charge.succeeded') {
      const ch = event.data.object as Stripe.Charge;
      metadata = (ch.metadata ?? {}) as Record<string, string>;
      if (ch.amount != null) amountCents = BigInt(ch.amount);
      source = ch.payment_method_details?.type === 'us_bank_account' ? 'STRIPE_ACH' : 'STRIPE_CARD';
    } else if (event.type === 'checkout.session.completed') {
      const cs = event.data.object as Stripe.Checkout.Session;
      metadata = (cs.metadata ?? {}) as Record<string, string>;
      if (cs.amount_total != null) amountCents = BigInt(cs.amount_total);
      source = 'STRIPE_CARD';
    } else {
      // Not interesting — ack and move on.
      remember(event.id);
      return NextResponse.json({ ok: true, ignored: true, reason: 'event_type' });
    }

    if (!metadata || metadata.inferlane_purpose !== 'wallet_deposit') {
      remember(event.id);
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: 'not a wallet deposit',
      });
    }

    const userId = metadata.inferlane_user_id;
    if (!userId) {
      logger.warn('stripe-deposit.webhook.missing_user_id', { eventId: event.id });
      remember(event.id);
      return NextResponse.json({ ok: true, ignored: true, reason: 'no user id' });
    }

    if (amountCents == null || amountCents <= BigInt(0)) {
      logger.warn('stripe-deposit.webhook.invalid_amount', {
        eventId: event.id,
        amount: amountCents?.toString() ?? 'null',
      });
      remember(event.id);
      return NextResponse.json({ ok: true, ignored: true, reason: 'invalid amount' });
    }

    await recordDeposit({
      userId,
      amountUsdCents: amountCents,
      source: source!,
      externalId: event.id,
      idempotencyKey: `stripe_webhook:${event.id}`,
    });

    remember(event.id);
    logger.info('stripe-deposit.webhook.credited', {
      eventId: event.id,
      userId,
      amountCents: amountCents.toString(),
      source,
    });

    return NextResponse.json({ ok: true, credited: true });
  } catch (err) {
    logger.error('stripe-deposit.webhook.failed', {
      eventId: event.id,
      error: err instanceof Error ? err.message : String(err),
    });
    // Return 500 so Stripe retries per their exponential backoff.
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }
}
