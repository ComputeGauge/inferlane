// ---------------------------------------------------------------------------
// Credit Time-Decay Pricing Library
// ---------------------------------------------------------------------------
// Credits with a time expiry are stranded assets whose price decays
// similarly to a leasehold on property. This module provides the decay
// curve, price bounds, and pool rate modifiers.
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000;

export type Urgency = 'low' | 'moderate' | 'high' | 'critical';

export interface PriceBounds {
  /** Minimum $/credit the seller can list at */
  floor: number;
  /** Maximum $/credit */
  ceiling: number;
  /** Recommended price for fast fill */
  suggested: number;
  /** Percentage of face value lost to time decay (0–100) */
  decayPct: number;
  /** How urgent the expiry is */
  urgency: Urgency;
  /** Raw decay factor (0.0 = expired, 1.0 = full value) */
  decayFactor: number;
  /** Days remaining until expiry */
  daysRemaining: number;
}

/**
 * Calculate dynamic price bounds based on time remaining until expiry.
 *
 * Decay curve (exponential, not linear — mirrors real option value):
 *   decayFactor = 1 - e^(-0.15 * daysRemaining)
 *
 * This gives:
 *   30 days → 0.989 (near face value)
 *   14 days → 0.877
 *    7 days → 0.650
 *    3 days → 0.362
 *    1 day  → 0.139
 *    0 days → 0.000 (expired)
 */
export function calculatePriceBounds(
  periodEnd: Date,
  now: Date = new Date(),
): PriceBounds {
  const diff = periodEnd.getTime() - now.getTime();
  const daysRemaining = Math.max(0, diff / MS_PER_DAY);

  // Exponential decay: steeper near expiry
  const decayFactor = daysRemaining <= 0 ? 0 : 1 - Math.exp(-0.15 * daysRemaining);

  // Price bounds
  const floor = Math.max(0.10, decayFactor * 0.50);
  const ceiling = Math.min(1.00, decayFactor * 1.10);
  const suggested = Number((floor + (ceiling - floor) * 0.4).toFixed(4));

  // Decay percentage (how much face value is lost)
  const decayPct = Math.round((1 - decayFactor) * 100);

  // Urgency classification
  const urgency = classifyUrgency(daysRemaining);

  return {
    floor: Number(floor.toFixed(4)),
    ceiling: Number(ceiling.toFixed(4)),
    suggested,
    decayPct,
    urgency,
    decayFactor: Number(decayFactor.toFixed(4)),
    daysRemaining: Number(daysRemaining.toFixed(2)),
  };
}

/**
 * Classify urgency based on days remaining.
 */
export function classifyUrgency(daysRemaining: number): Urgency {
  if (daysRemaining <= 1) return 'critical';
  if (daysRemaining <= 3) return 'high';
  if (daysRemaining <= 7) return 'moderate';
  return 'low';
}

/**
 * Calculate pool earning rate modifier based on when credits were delegated.
 * Credits delegated early in the period earn more; late delegation earns less.
 *
 * poolEarningRate = baseRate * decayFactor
 *
 * This incentivizes early delegation: delegate at start of period = full rate.
 * Delegate in the last week = reduced rate. The user is better off listing
 * on the marketplace at that point (where they control the price).
 */
export function poolEarningModifier(
  periodEnd: Date,
  now: Date = new Date(),
): number {
  const { decayFactor } = calculatePriceBounds(periodEnd, now);
  // Minimum 10% of base rate — never zero for active delegations
  return Math.max(0.10, decayFactor);
}

/**
 * Calculate effective value per day for a buyer considering an offer.
 * Helps buyers compare offers with different expiry times.
 *
 * Example: 100 credits at $0.40/credit expiring in 3 days
 *   → $0.133/credit/day
 * vs. 100 credits at $0.80/credit expiring in 20 days
 *   → $0.040/credit/day (better daily rate)
 */
export function valuePerDay(
  pricePerUnit: number,
  periodEnd: Date,
  now: Date = new Date(),
): number {
  const diff = periodEnd.getTime() - now.getTime();
  const daysRemaining = Math.max(0.01, diff / MS_PER_DAY); // avoid div by zero
  return Number((pricePerUnit / daysRemaining).toFixed(6));
}

/**
 * Check if a price is a "good deal" relative to the suggested price.
 * Returns the discount percentage (positive = below suggested = good deal).
 */
export function dealQuality(
  pricePerUnit: number,
  periodEnd: Date,
  now: Date = new Date(),
): { isGoodDeal: boolean; discountPct: number } {
  const bounds = calculatePriceBounds(periodEnd, now);
  if (bounds.suggested <= 0) return { isGoodDeal: false, discountPct: 0 };
  const discountPct = Math.round(((bounds.suggested - pricePerUnit) / bounds.suggested) * 100);
  return {
    isGoodDeal: discountPct >= 10, // 10%+ below suggested = good deal
    discountPct,
  };
}

/**
 * Determine if an offer's price exceeds the current ceiling (needs repricing).
 */
export function needsRepricing(
  currentPrice: number,
  periodEnd: Date,
  now: Date = new Date(),
): { needsReprice: boolean; newCeiling: number; currentPrice: number } {
  const bounds = calculatePriceBounds(periodEnd, now);
  return {
    needsReprice: currentPrice > bounds.ceiling,
    newCeiling: bounds.ceiling,
    currentPrice,
  };
}
