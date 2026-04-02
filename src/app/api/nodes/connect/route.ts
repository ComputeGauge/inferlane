import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  createConnectAccount,
  createOnboardingLink,
  getAccountStatus,
} from '@/lib/stripe-connect';

// POST: Create Stripe Connect account + return onboarding link
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  // Get user's node operator record
  const nodeOperator = await prisma.nodeOperator.findUnique({
    where: { userId },
  });

  if (!nodeOperator) {
    return NextResponse.json({ error: 'Not a registered node operator' }, { status: 404 });
  }

  // If they already have a Connect account, just generate a new onboarding link
  if (nodeOperator.stripeAccountId) {
    const status = await getAccountStatus(nodeOperator.stripeAccountId);

    // If fully onboarded, no need for another link
    if (status.detailsSubmitted && status.payoutsEnabled) {
      return NextResponse.json({
        status: 'active',
        accountId: nodeOperator.stripeAccountId,
        payoutsEnabled: true,
      });
    }

    // Incomplete onboarding — generate fresh link
    const returnUrl = `${process.env.NEXTAUTH_URL || 'https://inferlane.com'}/dashboard/nodes/settings`;
    const onboardingUrl = await createOnboardingLink(nodeOperator.stripeAccountId, returnUrl);

    return NextResponse.json({
      status: 'pending',
      onboardingUrl,
    });
  }

  // Create new Connect account
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user?.email) {
    return NextResponse.json({ error: 'User email required' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const country = body.country || 'US';

  const account = await createConnectAccount(userId, user.email, country);

  // Store Connect account ID on the node operator
  await prisma.nodeOperator.update({
    where: { userId },
    data: { stripeAccountId: account.id },
  });

  const returnUrl = `${process.env.NEXTAUTH_URL || 'https://inferlane.com'}/dashboard/nodes/settings`;
  const onboardingUrl = await createOnboardingLink(account.id, returnUrl);

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'STRIPE_CONNECT_CREATED',
      resource: 'node_operator',
      details: { accountId: account.id, nodeOperatorId: nodeOperator.id },
    },
  });

  return NextResponse.json({
    status: 'pending',
    accountId: account.id,
    onboardingUrl,
  });
}

// GET: Check Connect account status
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const nodeOperator = await prisma.nodeOperator.findUnique({
    where: { userId: session.user.id },
  });

  if (!nodeOperator) {
    return NextResponse.json({ error: 'Not a registered node operator' }, { status: 404 });
  }

  if (!nodeOperator.stripeAccountId) {
    return NextResponse.json({
      status: 'not_connected',
      payoutsEnabled: false,
    });
  }

  const status = await getAccountStatus(nodeOperator.stripeAccountId);

  // Sync payoutEnabled flag if onboarding completed
  if (status.payoutsEnabled && !nodeOperator.payoutEnabled) {
    await prisma.nodeOperator.update({
      where: { userId: session.user.id },
      data: { payoutEnabled: true },
    });
  }

  return NextResponse.json({
    status: status.detailsSubmitted ? 'active' : 'pending',
    accountId: nodeOperator.stripeAccountId,
    chargesEnabled: status.chargesEnabled,
    payoutsEnabled: status.payoutsEnabled,
    detailsSubmitted: status.detailsSubmitted,
    requirements: status.requirements,
  });
}
