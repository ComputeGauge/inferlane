// ---------------------------------------------------------------------------
// Compute Intelligence & Settlement Lanes — Public API (Stream U)
// ---------------------------------------------------------------------------

// Types, enums, and constants
export type {
  InferenceType,
  QualityTier,
  LatencyClass,
  PrivacyClass,
  AvailabilityClass,
  HardwareClass,
  VerificationMethod,
  VerificationOutcome,
  SettlementLane,
  SettlementStatus,
  SettlementTerms,
  TrustComponents,
  PromotionCriterion,
  LaneTransition,
  TrustProfile,
  ComputeClassification,
  VerificationProbe,
  VerificationResult,
  SettlementRecord,
  PlatformMaturityLevel,
} from './types';

export {
  VERIFICATION_POINTS,
  VERIFICATION_FAILURE_PENALTY,
  VERIFIED_THRESHOLD,
  PARTIALLY_VERIFIED_THRESHOLD,
  LANE_DEFAULTS,
  PROMOTION_THRESHOLDS,
  TRUST_DECAY,
  MATURITY_LEVELS,
  QUALITY_TIER_PATTERNS,
  DEFAULT_NODE_TIER,
  DEFAULT_PROVIDER_TIER,
  CATEGORY_TO_INFERENCE,
  INFERENCE_TYPE_PATTERNS,
  DATACENTER_PROVIDERS,
  LATENCY_BOUNDARIES,
  LIGHT_IN_FIBER_KM_PER_MS,
  MIN_RTT_MULTIPLIER,
  MAX_RTT_MULTIPLIER,
  deriveLatencyClass,
  calculateVerificationScore,
  verificationStatus,
} from './types';

// Classification engine
export {
  classifyFromRegistry,
  updateFromVerification,
  classifyFromNodeReport,
  getProviderModels,
  isKnownProvider,
  classifyAllProviderModels,
} from './classifier';
export type { NodeSelfReport } from './classifier';

// Verification protocol
export {
  runProbeRequest,
  runLatencyAttestation,
  runQualitySample,
  runResponseFingerprint,
  runAllVerifications,
} from './verifier';

// Attestation signing
export {
  signClassification,
  verifyClassification,
} from './attestation';

// Trust maturity
export {
  calculateTrustScore,
  evaluatePromotion,
  applyTrustDecay,
  determinePlatformMaturity,
} from './trust';

// Settlement lanes
export {
  assignSettlementLane,
  settleRequest,
  initiateDispute,
} from './settlement';
