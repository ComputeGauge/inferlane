import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY not set — Stripe features disabled');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  typescript: true,
});

// Subscription tier → Stripe Price ID mapping
export const TIER_PRICE_MAP: Record<string, string | undefined> = {
  PRO: process.env.STRIPE_PRICE_PRO,
  HYBRID: process.env.STRIPE_PRICE_HYBRID,
  TEAM: process.env.STRIPE_PRICE_TEAM,
  ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE,
};

// Tier display info
export const TIER_INFO = {
  FREE: { name: 'Free', price: 0, features: ['2 cloud providers', 'Basic gauges', 'Community support'] },
  PRO: { name: 'Pro', price: 9, features: ['Unlimited cloud providers', 'Smart Router', 'Alerts & budgets', 'Priority support'] },
  HYBRID: { name: 'Hybrid', price: 29, features: ['Everything in Pro', '1 on-prem cluster', 'GPU tracking', 'Migration advisor'] },
  TEAM: { name: 'Team', price: 49, features: ['Everything in Hybrid', 'Unlimited clusters', 'TCO reports', 'Team management', 'Compliance'] },
  ENTERPRISE: { name: 'Enterprise', price: null, features: ['Full platform', 'SOC 2 / HIPAA', 'Unified proxy', 'Dedicated SLA', 'Custom integrations'] },
} as const;
