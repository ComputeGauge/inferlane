// ---------------------------------------------------------------------------
// Trust Maturity Model (Stream U)
// ---------------------------------------------------------------------------
// Computes trust scores, evaluates lane promotion, applies trust decay,
// and determines platform maturity level.
//
// Trust score formula (0–100):
//   trustScore = uptimeScore(0–25) + accuracyScore(0–25)
//              + volumeScore(0–25)  + disputeScore(0–25)
//
// The trust score determines which settlement lane an entity gets.
// As the platform matures, lane thresholds relax — the "convergence"
// that turns deferred settlement into instant for everyone.
// ---------------------------------------------------------------------------

import type {
  TrustComponents,
  TrustProfile,
  PromotionCriterion,
  LaneTransition,
  SettlementLane,
  PlatformMaturityLevel,
} from './types';
import { PROMOTION_THRESHOLDS, TRUST_DECAY, MATURITY_LEVELS } from './types';

// ── Trust Score Calculation ───────────────────────────────────────────────

interface TrustInputs {
  // Uptime
  totalOnlineHours: number;
  downtimeHours: number;
  // Accuracy
  verifiedProbes: number;
  totalProbes: number;
  // Volume (30-day window)
  successfulRequests30d: number;
  // Disputes (90-day window)
  activeDisputes90d: number;
  totalSettlements90d: number;
}

/**
 * Calculate the four trust score components and total.
 */
export function calculateTrustScore(inputs: TrustInputs): {
  trustScore: number;
  components: TrustComponents;
} {
  // Uptime (0–25)
  const uptimeRatio = inputs.totalOnlineHours > 0
    ? (inputs.totalOnlineHours - inputs.downtimeHours) / inputs.totalOnlineHours
    : 0;
  const uptimeScore = Math.min(25, Math.max(0, uptimeRatio * 25));

  // Accuracy (0–25)
  const accuracyRatio = inputs.totalProbes > 0
    ? inputs.verifiedProbes / inputs.totalProbes
    : 0;
  const accuracyScore = Math.min(25, Math.max(0, accuracyRatio * 25));

  // Volume (0–25) — logarithmic: 10→5, 100→10, 1K→15, 10K→20, 100K→25
  const volumeScore = Math.min(25, Math.max(0,
    Math.log10(Math.max(1, inputs.successfulRequests30d)) * 5,
  ));

  // Disputes (0–25) — start at 25, penalise for disputes
  const disputeRate = inputs.totalSettlements90d > 0
    ? inputs.activeDisputes90d / inputs.totalSettlements90d
    : 0;
  const disputeScore = Math.max(0, 25 - disputeRate * 250);

  const trustScore = Math.round(uptimeScore + accuracyScore + volumeScore + disputeScore);

  return {
    trustScore: Math.min(100, Math.max(0, trustScore)),
    components: {
      uptimeScore: Math.round(uptimeScore * 100) / 100,
      accuracyScore: Math.round(accuracyScore * 100) / 100,
      volumeScore: Math.round(volumeScore * 100) / 100,
      disputeScore: Math.round(disputeScore * 100) / 100,
    },
  };
}

// ── Lane Promotion ────────────────────────────────────────────────────────

interface PromotionInputs {
  currentLane: SettlementLane;
  trustScore: number;
  consecutiveDaysAboveThreshold: number;
  totalRequests: number;
  disputeRate90d: number;
  accountAgeDays: number;
  verificationScore: number;
  allVerificationMethodsPassed: boolean;
  lifetimeEarningsUsd: number;
  // Platform maturity can lower thresholds
  instantThresholdOverride?: number;
}

/**
 * Evaluate whether an entity is eligible for lane promotion.
 * Returns the criteria with current vs required values.
 */
export function evaluatePromotion(inputs: PromotionInputs): {
  eligible: boolean;
  targetLane: SettlementLane | null;
  criteria: PromotionCriterion[];
} {
  if (inputs.currentLane === 'INSTANT') {
    // Already at highest lane
    return { eligible: false, targetLane: null, criteria: [] };
  }

  if (inputs.currentLane === 'DEFERRED') {
    const thresholds = PROMOTION_THRESHOLDS.DEFERRED_TO_STANDARD;
    const criteria: PromotionCriterion[] = [
      {
        name: 'Trust score',
        required: thresholds.trustScore,
        current: inputs.trustScore,
        met: inputs.trustScore >= thresholds.trustScore,
      },
      {
        name: 'Consecutive days above threshold',
        required: thresholds.consecutiveDays,
        current: inputs.consecutiveDaysAboveThreshold,
        met: inputs.consecutiveDaysAboveThreshold >= thresholds.consecutiveDays,
      },
      {
        name: 'Minimum requests',
        required: thresholds.minRequests,
        current: inputs.totalRequests,
        met: inputs.totalRequests >= thresholds.minRequests,
      },
      {
        name: 'Dispute rate (max)',
        required: thresholds.maxDisputeRate * 100,
        current: inputs.disputeRate90d * 100,
        met: inputs.disputeRate90d <= thresholds.maxDisputeRate,
      },
      {
        name: 'Account age (days)',
        required: thresholds.minAccountAgeDays,
        current: inputs.accountAgeDays,
        met: inputs.accountAgeDays >= thresholds.minAccountAgeDays,
      },
      {
        name: 'All verification methods passed',
        required: 1,
        current: inputs.allVerificationMethodsPassed ? 1 : 0,
        met: inputs.allVerificationMethodsPassed,
      },
    ];

    const eligible = criteria.every((c) => c.met);
    return { eligible, targetLane: eligible ? 'STANDARD' : null, criteria };
  }

  // STANDARD → INSTANT
  const thresholds = PROMOTION_THRESHOLDS.STANDARD_TO_INSTANT;
  const instantThreshold = inputs.instantThresholdOverride ?? thresholds.trustScore;

  const criteria: PromotionCriterion[] = [
    {
      name: 'Trust score',
      required: instantThreshold,
      current: inputs.trustScore,
      met: inputs.trustScore >= instantThreshold,
    },
    {
      name: 'Consecutive days above threshold',
      required: thresholds.consecutiveDays,
      current: inputs.consecutiveDaysAboveThreshold,
      met: inputs.consecutiveDaysAboveThreshold >= thresholds.consecutiveDays,
    },
    {
      name: 'Minimum requests',
      required: thresholds.minRequests,
      current: inputs.totalRequests,
      met: inputs.totalRequests >= thresholds.minRequests,
    },
    {
      name: 'Dispute rate (max %)',
      required: thresholds.maxDisputeRate * 100,
      current: inputs.disputeRate90d * 100,
      met: inputs.disputeRate90d <= thresholds.maxDisputeRate,
    },
    {
      name: 'Account age (days)',
      required: thresholds.minAccountAgeDays,
      current: inputs.accountAgeDays,
      met: inputs.accountAgeDays >= thresholds.minAccountAgeDays,
    },
    {
      name: 'Verification score',
      required: thresholds.minVerificationScore,
      current: inputs.verificationScore,
      met: inputs.verificationScore >= thresholds.minVerificationScore,
    },
    {
      name: 'Lifetime earnings ($)',
      required: thresholds.minLifetimeEarningsUsd,
      current: inputs.lifetimeEarningsUsd,
      met: inputs.lifetimeEarningsUsd >= thresholds.minLifetimeEarningsUsd,
    },
  ];

  const eligible = criteria.every((c) => c.met);
  return { eligible, targetLane: eligible ? 'INSTANT' : null, criteria };
}

// ── Trust Decay ───────────────────────────────────────────────────────────

interface DecayInputs {
  currentTrustScore: number;
  currentLane: SettlementLane;
  daysSinceLastActivity: number;
  hoursSinceLastVerification: number;
  verificationTTLHours: number;
  currentVerificationScore: number;
}

interface DecayResult {
  newTrustScore: number;
  newVerificationScore: number;
  demoteTo: SettlementLane | null;
  reasons: string[];
}

/**
 * Apply trust decay for inactive entities.
 * Called daily by a cron job.
 */
export function applyTrustDecay(inputs: DecayInputs): DecayResult {
  let newTrustScore = inputs.currentTrustScore;
  let newVerificationScore = inputs.currentVerificationScore;
  let demoteTo: SettlementLane | null = null;
  const reasons: string[] = [];

  // Activity-based decay
  if (inputs.daysSinceLastActivity > TRUST_DECAY.idleDaysBeforeDecay) {
    const idleDaysBeyondGrace = inputs.daysSinceLastActivity - TRUST_DECAY.idleDaysBeforeDecay;
    const decayAmount = TRUST_DECAY.decayPointsPerDay * idleDaysBeyondGrace;
    newTrustScore = Math.max(0, newTrustScore - decayAmount);
    reasons.push(`Idle ${inputs.daysSinceLastActivity}d: -${decayAmount.toFixed(1)} trust`);
  }

  // Lane demotion for extended inactivity
  if (inputs.daysSinceLastActivity > TRUST_DECAY.demoteFromInstantAfterDays) {
    if (inputs.currentLane === 'INSTANT') {
      demoteTo = 'STANDARD';
      reasons.push(`Idle >${TRUST_DECAY.demoteFromInstantAfterDays}d: demote INSTANT→STANDARD`);
    }
  }

  if (inputs.daysSinceLastActivity > TRUST_DECAY.demoteToDeferredAfterDays) {
    demoteTo = 'DEFERRED';
    reasons.push(`Idle >${TRUST_DECAY.demoteToDeferredAfterDays}d: demote to DEFERRED`);
  }

  // Verification score decay
  if (inputs.hoursSinceLastVerification > inputs.verificationTTLHours) {
    const expiredPeriods = Math.floor(
      (inputs.hoursSinceLastVerification - inputs.verificationTTLHours) / inputs.verificationTTLHours,
    );
    const decayFactor = Math.pow(1 - TRUST_DECAY.verificationDecayRate, expiredPeriods + 1);
    newVerificationScore = Math.round(newVerificationScore * decayFactor);
    reasons.push(`Verification expired ${expiredPeriods + 1} TTL(s): score → ${newVerificationScore}`);
  }

  return {
    newTrustScore: Math.max(0, Math.round(newTrustScore)),
    newVerificationScore: Math.max(0, newVerificationScore),
    demoteTo,
    reasons,
  };
}

// ── Platform Maturity ─────────────────────────────────────────────────────

interface PlatformStats {
  totalSettledUsd: number;
  averageDisputeRate: number;  // 0–1
  activeNodes: number;
  activeProviders: number;
}

/**
 * Determine current platform maturity level.
 * Higher maturity = relaxed lane thresholds = faster settlement for everyone.
 */
export function determinePlatformMaturity(stats: PlatformStats): PlatformMaturityLevel {
  // Walk backwards through levels — highest qualifying wins
  for (let i = MATURITY_LEVELS.length - 1; i >= 0; i--) {
    const level = MATURITY_LEVELS[i];
    if (
      stats.totalSettledUsd >= level.requiredSettledUsd &&
      stats.averageDisputeRate <= level.requiredDisputeRate
    ) {
      return level;
    }
  }

  return MATURITY_LEVELS[0]; // Early
}

/**
 * Build a full trust profile for display.
 */
export function buildTrustProfile(
  entityId: string,
  entityType: 'provider' | 'node',
  trustInputs: TrustInputs,
  promotionInputs: Omit<PromotionInputs, 'trustScore' | 'currentLane'>,
  currentLane: SettlementLane,
  laneHistory: LaneTransition[],
): TrustProfile {
  const { trustScore, components } = calculateTrustScore(trustInputs);

  const fullPromotionInputs: PromotionInputs = {
    ...promotionInputs,
    trustScore,
    currentLane,
  };

  const { eligible, criteria } = evaluatePromotion(fullPromotionInputs);

  return {
    entityId,
    entityType,
    trustScore,
    components,
    currentLane,
    laneHistory,
    promotionEligible: eligible,
    promotionCriteria: criteria,
  };
}
