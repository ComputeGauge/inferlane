// Privacy Architecture — Public API
//
// Stream S: Decentralised routing privacy for the OpenClaw network.
// Four tiers of escalating protection from transport-only to confidential compute.

export type {
  PrivacyTier,
  SensitivityLevel,
  PromptFragment,
  FragmentParameters,
  FragmentResult,
  ReassembledResponse,
  ShamirShare,
  ShamirConfig,
  EncryptedPayload,
  NodePrivacyCapability,
  PrivacyPolicyConfig,
  CanaryToken,
  ComplianceRequirement,
} from './types';

export {
  PRIVACY_TIER_RANK,
  SENSITIVITY_MIN_TIER,
  DEFAULT_PRIVACY_POLICY,
  ENTERPRISE_PRIVACY_POLICY,
  HIPAA_PRIVACY_POLICY,
  COMPLIANCE_REQUIREMENTS,
} from './types';

export {
  splitSecret,
  reconstructSecret,
  encryptAndSplit,
  reconstructAndDecrypt,
  verifyShares,
} from './shamir';

export {
  analyseSplittability,
  fragmentPrompt,
  buildSynthesisInput,
  reassembleResponse,
} from './fragmenter';

export type {
  SplitAnalysis,
  SplitStrategy,
} from './fragmenter';

export {
  routeRequest,
  injectCanary,
  checkCanaryLeak,
  stripPII,
  restorePII,
} from './router';

export type {
  RouteDecision,
  NodeAssignment,
  RoutingContext,
  PIIRedaction,
} from './router';
