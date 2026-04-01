import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';

// ---------------------------------------------------------------------------
// Stripe Connect Onboarding for Node Operators
// ---------------------------------------------------------------------------
// POST /api/nodes/stripe-onboard — Create or retrieve Stripe Connect Express
//   account for the node operator. Returns the onboarding URL for the operator
//   to complete identity verification and bank setup.
//
// GET /api/nodes/stripe-onboard — Check Stripe Connect status (is payout
//   enabled, is onboarding complete, account ID).
//
// Stripe Connect Express gives us hosted onboarding — we never handle
// bank details or identity documents. Stripe takes care of KYC/AML.
// ---------------------------------------------------------------------------

// In production, use: import Stripe from 'stripe';
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' });

// ── GET — Check Stripe Connect status ──────────────────────────────────

async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await rateLimit(`nodes-stripe:${session.user.id}`, 20, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const node = await prisma.nodeOperator.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      stripeAccountId: true,
      payoutEnabled: true,
      pendingBalance: true,
      lifetimeEarned: true,
    },
  });

  if (!node) {
    return NextResponse.json({ error: 'Not registered as a node operator' }, { status: 404 });
  }

  return NextResponse.json({
    stripeAccountId: node.stripeAccountId,
    payoutEnabled: node.payoutEnabled,
    pendingBalance: Number(node.pendingBalance),
    lifetimeEarned: Number(node.lifetimeEarned),
    onboardingRequired: !node.stripeAccountId || !node.payoutEnabled,
  });
}

// ── POST — Create Stripe Connect account + onboarding link ──────────────

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await rateLimit(`nodes-stripe:${session.user.id}`, 5, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const node = await prisma.nodeOperator.findUnique({
    where: { userId: session.user.id },
    select: { id: true, stripeAccountId: true, payoutEnabled: true },
  });

  if (!node) {
    return NextResponse.json({ error: 'Not registered as a node operator' }, { status: 404 });
  }

  // Check that STRIPE_SECRET_KEY is configured
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in environment.' },
      { status: 503 },
    );
  }

  try {
    // Dynamic import to avoid build errors when stripe is not installed
    const stripeModule = await import('stripe');
    const Stripe = stripeModule.default;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-12-18.acacia' as any,
    });

    let accountId = node.stripeAccountId;

    // Step 1: Create a Stripe Connect Express account if none exists
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          inferlane_node_id: node.id,
          inferlane_user_id: session.user.id,
        },
      });

      accountId = account.id;

      await prisma.nodeOperator.update({
        where: { id: node.id },
        data: { stripeAccountId: accountId },
      });
    }

    // Step 2: Check if onboarding is already complete
    const account = await stripe.accounts.retrieve(accountId);
    if (account.charges_enabled && account.payouts_enabled) {
      // Already fully onboarded
      if (!node.payoutEnabled) {
        await prisma.nodeOperator.update({
          where: { id: node.id },
          data: { payoutEnabled: true },
        });
      }

      return NextResponse.json({
        status: 'complete',
        stripeAccountId: accountId,
        payoutEnabled: true,
        message: 'Stripe Connect is fully set up. Payouts are enabled.',
      });
    }

    // Step 3: Generate an Account Link for onboarding
    const origin = req.headers.get('origin') || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/dashboard/nodes?stripe=refresh`,
      return_url: `${origin}/dashboard/nodes?stripe=complete`,
      type: 'account_onboarding',
    });

    return NextResponse.json({
      status: 'pending',
      stripeAccountId: accountId,
      onboardingUrl: accountLink.url,
      expiresAt: new Date(accountLink.expires_at * 1000).toISOString(),
      message: 'Complete Stripe onboarding to enable payouts.',
    });
  } catch (err) {
    console.error('[Stripe Connect] Error:', err);

    // If stripe module not installed, return helpful error
    if (err instanceof Error && err.message.includes('Cannot find module')) {
      return NextResponse.json(
        { error: 'Stripe SDK not installed. Run: npm install stripe' },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Stripe onboarding failed' },
      { status: 500 },
    );
  }
}

export const GET = withTiming(handleGET);
export const POST = withTiming(handlePOST);
