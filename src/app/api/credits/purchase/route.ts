import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stripe } from '@/lib/stripe';

// POST: Create Stripe checkout session for credit purchase
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.amountUsd !== 'number') {
    return NextResponse.json({ error: 'amountUsd is required' }, { status: 400 });
  }

  const { amountUsd } = body;

  // Validate range
  if (amountUsd < 5 || amountUsd > 1000) {
    return NextResponse.json({ error: 'Amount must be between $5 and $1,000' }, { status: 400 });
  }

  // Round to 2 decimal places
  const roundedAmount = Math.round(amountUsd * 100) / 100;
  const amountCents = Math.round(roundedAmount * 100);

  const baseUrl = process.env.NEXTAUTH_URL || 'https://inferlane.dev';

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: session.user.email || undefined,
    client_reference_id: session.user.id,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `InferLane Credits — $${roundedAmount.toFixed(2)}`,
            description: `${roundedAmount.toFixed(2)} compute credits for AI inference routing`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: session.user.id,
      purchaseType: 'credits',
      amountUsd: roundedAmount.toString(),
    },
    success_url: `${baseUrl}/dashboard/credits?purchased=${roundedAmount}`,
    cancel_url: `${baseUrl}/dashboard/credits`,
  });

  return NextResponse.json({
    checkoutUrl: checkoutSession.url,
    sessionId: checkoutSession.id,
  });
}
