// ---------------------------------------------------------------------------
// Compute Intelligence & Settlement Lanes — Types & Constants (Stream U)
// ---------------------------------------------------------------------------
// Defines the classification taxonomy, verification protocol types,
// settlement lane architecture, and trust maturity model for transparent
// compute trading. Every marketplace offer, proxy request, and settlement
// carries a classification that tells buyers exactly what they're getting.
// ---------------------------------------------------------------------------

// ── Compute Classification Dimensions ─────────────────────────────────────

/** What kind of inference work the compute performs */
export type InferenceType =
  | 'CHAT'
  | 'EMBEDDING'
  | 'IMAGE_GENERATION'
  | 'CODE'
  | 'REASONING'
  | 'AUDIO'
  | 'MULTIMODAL';

/** Quality tier of the model — determines pricing expectation */
export type QualityTier =
  | 'FRONTIER'       // GPT-4o, Claude Opus, Gemini Ultra — top capability
  | 'STANDARD'       // GPT-4o-mini, Claude Sonnet, Gemini Pro — balanced
  | 'ECONOMY'        // Mixtral, Llama-70B, DeepSeek — cost-optimised
  | 'OPEN_WEIGHT';   // Self-hosted open models on decentralised nodes

/** Latency class measured from first-token time (TTFT) */
export type LatencyClass =
  | 'REALTIME'       // < 500ms TTFT
  | 'INTERACTIVE'    // 500ms – 2s TTFT
  | 'BATCH'          // 2s – 30s TTFT
  | 'ASYNC';         // > 30s TTFT

/** Privacy class — mirrors Stream S RoutingPrivacyTier */
export type PrivacyClass =
  | 'TRANSPORT'
  | 'BLIND'
  | 'TEE_PREFERRED'
  | 'CONFIDENTIAL';

/** Availability model of the compute resource */
export type AvailabilityClass =
  | 'SPOT'           // Best-effort, may be preempted
  | 'RESERVED'       // Guaranteed capacity window
  | 'DEDICATED';     // Exclusive hardware

/** Hardware backing the compute */
export type HardwareClass =
  | 'CONSUMER_GPU'   // RTX 3090, 4090
  | 'DATACENTER_GPU' // A100, H100
  | 'TEE_CAPABLE'    // H100 with confidential compute, SGX, SEV
  | 'CPU_ONLY'       // No GPU — CPU inference
  | 'UNKNOWN';       // Unverified

// ── Verification ──────────────────────────────────────────────────────────

/** Method used to verify a classification claim */
export type VerificationMethod =
  | 'PROBE_REQUEST'          // Known-answer challenge
  | 'LATENCY_ATTESTATION'    // Timing-based geo verification
  | 'QUALITY_SAMPLE'         // Random output validation against benchmarks
  | 'RESPONSE_FINGERPRINT'   // Model identification from output characteristics
  | 'HARDWARE_ATTESTATION'   // TEE remote attestation chain
  | 'SELF_REPORTED';         // Unverified claim (starting state)

/** Outcome of a single verification check */
export type VerificationOutcome =
  | 'VERIFIED'
  | 'FAILED'
  | 'INCONCLUSIVE'
  | 'EXPIRED';        // Verification older than TTL

/** Points awarded per verification method (max 100 total) */
export const VERIFICATION_POINTS: Record<VerificationMethod, number> = {
  PROBE_REQUEST: 30,
  LATENCY_ATTESTATION: 20,
  QUALITY_SAMPLE: 20,
  RESPONSE_FINGERPRINT: 15,
  HARDWARE_ATTESTATION: 15,
  SELF_REPORTED: 0,
};

/** Points deducted for a FAILED verification */
export const VERIFICATION_FAILURE_PENALTY = 20;

/** Minimum verification score to be considered "verified" */
export const VERIFIED_THRESHOLD = 65;

/** Minimum score for "partially verified" (below this = unverified) */
export const PARTIALLY_VERIFIED_THRESHOLD = 1;

// ── Settlement Lanes ──────────────────────────────────────────────────────

/** Settlement lane assignment based on trust + verification */
export type SettlementLane =
  | 'INSTANT'        // 0-hour settlement, post-settlement clawback window
  | 'STANDARD'       // T+1 daily batch
  | 'DEFERRED';      // T+7 to T+30 based on trust score

/** Settlement status for a request */
export type SettlementStatus =
  | 'PENDING'
  | 'SETTLED'
  | 'DISPUTED'
  | 'REVERSED';

/** Terms governing how a settlement is executed */
export interface SettlementTerms {
  lane: SettlementLane;
  settlementDelayHours: number;   // 0 for instant, 24 for T+1, 168–720 for deferred
  escrowRequired: boolean;
  escrowAmountUsd: number | null;
  disputeWindowHours: number;     // How long buyer can dispute after settlement
  reputationMinimum: number;      // Min trust score for this lane
}

/** Default terms by lane */
export const LANE_DEFAULTS: Record<SettlementLane, SettlementTerms> = {
  INSTANT: {
    lane: 'INSTANT',
    settlementDelayHours: 0,
    escrowRequired: false,
    escrowAmountUsd: null,
    disputeWindowHours: 4,
    reputationMinimum: 80,
  },
  STANDARD: {
    lane: 'STANDARD',
    settlementDelayHours: 24,
    escrowRequired: false,
    escrowAmountUsd: null,
    disputeWindowHours: 24,
    reputationMinimum: 50,
  },
  DEFERRED: {
    lane: 'DEFERRED',
    settlementDelayHours: 168, // 7 days default, increases with lower trust
    escrowRequired: false,
    escrowAmountUsd: null,
    disputeWindowHours: 168,
    reputationMinimum: 0,
  },
};

// ── Trust Maturity ────────────────────────────────────────────────────────

/** Components of the trust score (each 0–25, total 0–100) */
export interface TrustComponents {
  uptimeScore: number;
  accuracyScore: number;
  volumeScore: number;
  disputeScore: number;
}

/** Lane promotion requirements */
export interface PromotionCriterion {
  name: string;
  required: number;
  current: number;
  met: boolean;
}

/** Record of a lane transition */
export interface LaneTransition {
  from: SettlementLane;
  to: SettlementLane;
  reason: string;
  occurredAt: Date;
}

/** Full trust profile for a provider or node */
export interface TrustProfile {
  entityId: string;
  entityType: 'provider' | 'node';
  trustScore: number;
  components: TrustComponents;
  currentLane: SettlementLane;
  laneHistory: LaneTransition[];
  promotionEligible: boolean;
  promotionCriteria: PromotionCriterion[];
}

/** Lane promotion thresholds */
export const PROMOTION_THRESHOLDS = {
  DEFERRED_TO_STANDARD: {
    trustScore: 50,
    consecutiveDays: 7,
    minRequests: 100,
    maxDisputeRate: 0.05,
    minAccountAgeDays: 14,
    allVerificationMethodsPassed: true,
  },
  STANDARD_TO_INSTANT: {
    trustScore: 80,
    consecutiveDays: 14,
    minRequests: 1000,
    maxDisputeRate: 0.01,
    minAccountAgeDays: 30,
    minVerificationScore: 65,
    minLifetimeEarningsUsd: 100,
  },
} as const;

/** Trust decay parameters */
export const TRUST_DECAY = {
  idleDaysBeforeDecay: 7,
  decayPointsPerDay: 0.5,
  demoteFromInstantAfterDays: 30,
  demoteToDeferredAfterDays: 90,
  verificationDecayRate: 0.1,   // 10% per expired TTL period
} as const;

// ── Platform Maturity Convergence ─────────────────────────────────────────

/**
 * As the platform matures, lane thresholds relax.
 * Each milestone is gated on platform-wide metrics.
 */
export interface PlatformMaturityLevel {
  name: string;
  requiredSettledUsd: number;
  requiredDisputeRate: number;  // must be BELOW this
  instantTrustThreshold: number;
  deferredDelayDays: number;
  verificationTTLHours: number;
}

export const MATURITY_LEVELS: PlatformMaturityLevel[] = [
  {
    name: 'Early',
    requiredSettledUsd: 0,
    requiredDisputeRate: 1.0,     // any dispute rate
    instantTrustThreshold: 80,
    deferredDelayDays: 30,
    verificationTTLHours: 24,
  },
  {
    name: 'Growing',
    requiredSettledUsd: 100_000,
    requiredDisputeRate: 0.01,    // < 1%
    instantTrustThreshold: 70,
    deferredDelayDays: 14,
    verificationTTLHours: 48,
  },
  {
    name: 'Established',
    requiredSettledUsd: 1_000_000,
    requiredDisputeRate: 0.005,   // < 0.5%
    instantTrustThreshold: 60,
    deferredDelayDays: 7,
    verificationTTLHours: 72,
  },
  {
    name: 'Mature',
    requiredSettledUsd: 10_000_000,
    requiredDisputeRate: 0.001,   // < 0.1%
    instantTrustThreshold: 50,
    deferredDelayDays: 3,
    verificationTTLHours: 96,
  },
];

// ── Classification Report ─────────────────────────────────────────────────

/** The central artifact — a signed, verifiable description of compute */
export interface ComputeClassification {
  id: string;
  targetType: 'provider' | 'node';
  targetId: string;               // AIProvider enum value or NodeOperator ID
  model: string;

  // 7 classification dimensions
  inferenceType: InferenceType;
  qualityTier: QualityTier;
  latencyClass: LatencyClass;
  privacyClass: PrivacyClass;
  availabilityClass: AvailabilityClass;
  hardwareClass: HardwareClass;
  regions: string[];

  // Measured metrics from verification probes
  measuredLatencyMs: number | null;
  measuredThroughputTps: number | null;    // tokens/second
  measuredAccuracy: number | null;          // 0–1

  // Verification status
  verificationMethods: VerificationMethod[];
  verificationScore: number;               // 0–100 composite
  lastVerifiedAt: Date | null;
  verificationTTLHours: number;

  // Cryptographic attestation
  signature: string | null;                // HMAC-SHA256 of classification body
  signedAt: Date | null;
  signerKeyId: string | null;

  // Settlement lane assignment
  settlementLane: SettlementLane;
  settlementTerms: SettlementTerms;

  createdAt: Date;
  updatedAt: Date;
}

// ── Verification Probe ────────────────────────────────────────────────────

/** Definition of a verification probe to run */
export interface VerificationProbe {
  method: VerificationMethod;
  model: string;
  prompt: string;
  expectedOutput: string | null;         // For PROBE_REQUEST: expected substring
  expectedLatencyMaxMs: number | null;
  expectedRegion: string | null;         // For LATENCY_ATTESTATION
}

/** Result of running a verification probe */
export interface VerificationResult {
  id: string;
  classificationId: string;
  method: VerificationMethod;
  outcome: VerificationOutcome;
  details: Record<string, unknown>;      // Method-specific evidence
  latencyMs: number;
  executedAt: Date;
}

// ── Settlement Record ─────────────────────────────────────────────────────

export interface SettlementRecord {
  id: string;
  requestId: string;                     // ProxyRequest.id
  lane: SettlementLane;
  amountUsd: number;
  payeeType: 'provider' | 'node';
  payeeId: string;
  status: SettlementStatus;
  settledAt: Date | null;
  disputeReason: string | null;
  escrowReleaseAt: Date | null;
  createdAt: Date;
}

// ── Quality Tier Mapping ──────────────────────────────────────────────────

/** Model name patterns → QualityTier */
export const QUALITY_TIER_PATTERNS: Array<{ pattern: RegExp; tier: QualityTier }> = [
  // Frontier models
  { pattern: /claude-opus|gpt-4o(?!-mini)|o1(?!-mini)|gemini.*ultra|grok-3(?!-mini)/i, tier: 'FRONTIER' },
  // Standard models
  { pattern: /claude-sonnet|gpt-4o-mini|o3-mini|gemini.*pro|grok-3-mini|mistral-large|command-r-plus|sonar-pro/i, tier: 'STANDARD' },
  // Economy models
  { pattern: /claude-haiku|gpt-3\.5|mixtral|llama|deepseek|mistral-small|command-r(?!-plus)|sonar(?!-pro)|phi/i, tier: 'ECONOMY' },
];

/** Default tier for unknown models on decentralised nodes */
export const DEFAULT_NODE_TIER: QualityTier = 'OPEN_WEIGHT';

/** Default tier for unknown models on known providers */
export const DEFAULT_PROVIDER_TIER: QualityTier = 'STANDARD';

// ── Inference Type Mapping ────────────────────────────────────────────────

/** Model category → InferenceType */
export const CATEGORY_TO_INFERENCE: Record<string, InferenceType> = {
  chat: 'CHAT',
  embedding: 'EMBEDDING',
  image: 'IMAGE_GENERATION',
};

/** Model name patterns for types not in ModelPrice.category */
export const INFERENCE_TYPE_PATTERNS: Array<{ pattern: RegExp; type: InferenceType }> = [
  { pattern: /o1|o3|reasoner|think/i, type: 'REASONING' },
  { pattern: /code|codex|starcoder|deepcoder/i, type: 'CODE' },
  { pattern: /whisper|speech|audio|tts/i, type: 'AUDIO' },
  { pattern: /vision|multimodal|4v/i, type: 'MULTIMODAL' },
];

// ── Latency Class Boundaries ──────────────────────────────────────────────

export const LATENCY_BOUNDARIES = {
  REALTIME: 500,        // < 500ms TTFT
  INTERACTIVE: 2000,    // 500ms – 2s
  BATCH: 30_000,        // 2s – 30s
  // > 30s = ASYNC
} as const;

/** Derive latency class from measured TTFT in milliseconds */
export function deriveLatencyClass(ttftMs: number): LatencyClass {
  if (ttftMs < LATENCY_BOUNDARIES.REALTIME) return 'REALTIME';
  if (ttftMs < LATENCY_BOUNDARIES.INTERACTIVE) return 'INTERACTIVE';
  if (ttftMs < LATENCY_BOUNDARIES.BATCH) return 'BATCH';
  return 'ASYNC';
}

// ── Verification Score Calculation ────────────────────────────────────────

/**
 * Calculate composite verification score from a set of results.
 * Each VERIFIED method adds its point value. Each FAILED deducts 20.
 */
export function calculateVerificationScore(
  results: Array<{ method: VerificationMethod; outcome: VerificationOutcome }>,
): number {
  let score = 0;
  const seenMethods = new Set<VerificationMethod>();

  for (const r of results) {
    if (r.outcome === 'VERIFIED' && !seenMethods.has(r.method)) {
      score += VERIFICATION_POINTS[r.method];
      seenMethods.add(r.method);
    } else if (r.outcome === 'FAILED') {
      score -= VERIFICATION_FAILURE_PENALTY;
    }
    // INCONCLUSIVE and EXPIRED add nothing, subtract nothing
  }

  return Math.max(0, Math.min(100, score));
}

/** Human-readable verification status from score */
export function verificationStatus(score: number): 'verified' | 'partial' | 'unverified' {
  if (score >= VERIFIED_THRESHOLD) return 'verified';
  if (score >= PARTIALLY_VERIFIED_THRESHOLD) return 'partial';
  return 'unverified';
}

// ── Provider Hardware Assumptions ─────────────────────────────────────────

/** Known providers that run on datacenter GPUs */
export const DATACENTER_PROVIDERS = new Set([
  'ANTHROPIC', 'OPENAI', 'GOOGLE', 'TOGETHER', 'GROQ', 'FIREWORKS',
  'DEEPSEEK', 'MISTRAL', 'COHERE', 'XAI', 'PERPLEXITY', 'CEREBRAS',
  'SAMBANOVA', 'REPLICATE',
]);

// ── Speed of Light Constants (for latency attestation) ────────────────────

/** Approximate speed of light in fiber optic (km/ms) */
export const LIGHT_IN_FIBER_KM_PER_MS = 200;

/** Minimum plausible RTT multiplier (accounts for routing overhead) */
export const MIN_RTT_MULTIPLIER = 0.8;

/** Maximum plausible RTT multiplier before flagging as suspicious */
export const MAX_RTT_MULTIPLIER = 5.0;
