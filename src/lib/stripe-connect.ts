import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion });

// Create a Connect account for a node operator
export async function createConnectAccount(userId: string, email: string, country: string) {
  const account = await stripe.accounts.create({
    type: 'express',
    email,
    country,
    capabilities: { transfers: { requested: true } },
    metadata: { userId, platform: 'inferlane' },
  });
  return account;
}

// Generate onboarding link
export async function createOnboardingLink(accountId: string, returnUrl: string) {
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${returnUrl}?refresh=true`,
    return_url: `${returnUrl}?success=true`,
    type: 'account_onboarding',
  });
  return link.url;
}

// Pay out earnings to a node operator
export async function payoutToOperator(accountId: string, amountCents: number, description: string) {
  const transfer = await stripe.transfers.create({
    amount: amountCents,
    currency: 'usd',
    destination: accountId,
    description,
    metadata: { platform: 'inferlane' },
  });
  return transfer;
}

// Check payout status
export async function getAccountBalance(accountId: string) {
  const balance = await stripe.balance.retrieve({ stripeAccount: accountId });
  return balance;
}

// Check if Connect account is fully onboarded
export async function getAccountStatus(accountId: string) {
  const account = await stripe.accounts.retrieve(accountId);
  return {
    id: account.id,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    requirements: account.requirements,
  };
}
