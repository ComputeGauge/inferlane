import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY not set — Stripe features disabled');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  typescript: true,
});

// Subscription tier → Stripe Price ID mapping (monthly)
export const TIER_PRICE_MAP: Record<string, string | undefined> = {
  PRO: process.env.STRIPE_PRICE_PRO,
  HYBRID: process.env.STRIPE_PRICE_HYBRID,
  TEAM: process.env.STRIPE_PRICE_TEAM,
  ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE,
};

// Annual price IDs (set env vars when Stripe annual prices are created)
export const TIER_PRICE_ANNUAL_MAP: Record<string, string | undefined> = {
  PRO: process.env.STRIPE_PRICE_PRO_ANNUAL,
  HYBRID: process.env.STRIPE_PRICE_HYBRID_ANNUAL,
  TEAM: process.env.STRIPE_PRICE_TEAM_ANNUAL,
  ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL,
};

// ── Supplier (Node Operator) Subscription Tier Pricing ──────────────────

export const SUPPLIER_TIER_PRICE_MAP: Record<string, string | undefined> = {
  PROFESSIONAL: process.env.STRIPE_PRICE_SUPPLIER_PRO,
  ENTERPRISE: process.env.STRIPE_PRICE_SUPPLIER_ENTERPRISE,
};

export const SUPPLIER_TIER_INFO = {
  STARTER: { name: 'Starter', price: 0, features: ['100 req/day capacity', 'Weekly payouts', 'DEFERRED settlement lane'] },
  PROFESSIONAL: { name: 'Professional', price: 29, features: ['10K req/day capacity', 'Daily payouts', 'STANDARD settlement lane', 'Priority routing'] },
  ENTERPRISE: { name: 'Enterprise', price: 99, features: ['Unlimited capacity', 'Instant payouts', 'INSTANT settlement lane', 'Priority routing', 'Dedicated support'] },
} as const;

// ── Buyer Subscription Tier Display Info ─────────────────────────────────

// Tier display info
export const TIER_INFO = {
  FREE: { name: 'Free', price: 0, features: ['2 cloud providers', 'Basic gauges', 'Community support'] },
  PRO: { name: 'Pro', price: 9, features: ['Unlimited cloud providers', 'Smart Router', 'Alerts & budgets', 'Priority support'] },
  HYBRID: { name: 'Hybrid', price: 29, features: ['Everything in Pro', '1 on-prem cluster', 'GPU tracking', 'Migration advisor'] },
  TEAM: { name: 'Team', price: 49, features: ['Everything in Hybrid', 'Unlimited clusters', 'TCO reports', 'Team management', 'Compliance'] },
  ENTERPRISE: { name: 'Enterprise', price: null, features: ['Full platform', 'SOC 2 / HIPAA', 'Unified proxy', 'Dedicated SLA', 'Custom integrations'] },
} as const;
