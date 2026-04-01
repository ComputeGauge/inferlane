// ---------------------------------------------------------------------------
// Privacy Tier Architecture — Types & Constants
// ---------------------------------------------------------------------------
// Defines the privacy classification system for routing workloads through
// decentralised compute nodes (OpenClaw network). Four tiers of escalating
// privacy protection, from transport-only encryption to full confidential
// compute with hardware enclaves.
// ---------------------------------------------------------------------------

// --- Privacy Tiers ---

export type PrivacyTier =
  | 'TRANSPORT_ONLY'    // Tier 0: mTLS in transit, node sees plaintext
  | 'BLIND_ROUTING'     // Tier 1: prompt fragmented across multiple nodes
  | 'TEE_PREFERRED'     // Tier 1.5: route to TEE-capable nodes when available
  | 'CONFIDENTIAL';     // Tier 2: TEE-required, cryptographic attestation

export const PRIVACY_TIER_RANK: Record<PrivacyTier, number> = {
  TRANSPORT_ONLY: 0,
  BLIND_ROUTING: 1,
  TEE_PREFERRED: 2,
  CONFIDENTIAL: 3,
};

// --- Sensitivity Classification ---

export type SensitivityLevel = 'public' | 'internal' | 'confidential' | 'restricted';

export const SENSITIVITY_MIN_TIER: Record<SensitivityLevel, PrivacyTier> = {
  public: 'TRANSPORT_ONLY',
  internal: 'BLIND_ROUTING',
  confidential: 'TEE_PREFERRED',
  restricted: 'CONFIDENTIAL',
};

// --- Prompt Fragment ---

export interface PromptFragment {
  fragmentId: string;
  index: number;                // position in reassembly order
  totalFragments: number;
  content: string;              // the fragment text (plaintext or encrypted)
  encryptedContent?: string;    // AES-256-GCM encrypted content
  keyShareIndex?: number;       // which Shamir share decrypts this fragment
  systemPrompt?: string;        // generic system prompt for the node (no user context)
  model: string;
  parameters: FragmentParameters;
}

export interface FragmentParameters {
  maxTokens: number;
  temperature: number;
  topP?: number;
  stopSequences?: string[];
}

// --- Fragment Reassembly ---

export interface FragmentResult {
  fragmentId: string;
  index: number;
  response: string;             // node's response to this fragment
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
  };
  nodeId: string;               // which node processed this
  latencyMs: number;
}

export interface ReassembledResponse {
  fullResponse: string;
  fragments: FragmentResult[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalLatencyMs: number;       // wall-clock time (parallel fragments)
  privacyTier: PrivacyTier;
  nodeCount: number;
}

// --- Shamir Secret Sharing ---

export interface ShamirShare {
  index: number;                // share number (1-indexed)
  value: Buffer;                // the share value
}

export interface ShamirConfig {
  threshold: number;            // k: minimum shares to reconstruct
  totalShares: number;          // n: total shares generated
}

export interface EncryptedPayload {
  ciphertext: string;           // AES-256-GCM encrypted prompt (hex)
  iv: string;                   // initialization vector (hex)
  authTag: string;              // GCM auth tag (hex)
  shares: ShamirShare[];        // Shamir shares of the AES key
  config: ShamirConfig;
}

// --- Node Capability Declaration ---

export interface NodePrivacyCapability {
  nodeId: string;
  operatorId: string;           // NodeOperator.id
  supportedTier: PrivacyTier;
  teeAttested: boolean;         // whether the node has verified hardware enclaves
  teeType?: 'SGX' | 'SEV' | 'TZ' | 'NVIDIA_CC';  // hardware enclave type
  teeAttestationHash?: string;  // remote attestation proof
  regions: string[];            // ISO 3166-1 alpha-2 country codes
  ipRange?: string;             // for diversity verification
  models: string[];             // supported models
  maxConcurrent: number;
}

// --- Privacy Policy (user-configured) ---

export interface PrivacyPolicyConfig {
  name: string;                 // "Default", "HIPAA Compliant", "Public Only"
  tier: PrivacyTier;
  allowedRegions?: string[];    // geo-fence: only route to nodes in these countries
  requireTEE: boolean;
  minFragments: number;         // minimum fragment count for BLIND_ROUTING (default 3)
  maxFragments: number;         // maximum fragment count (default 7)
  piiStripping: boolean;        // auto-strip PII before routing
  canaryInjection: boolean;     // inject canary tokens for exfiltration detection
  maxLatencyMs?: number;        // latency budget — select highest tier within budget
}

export const DEFAULT_PRIVACY_POLICY: PrivacyPolicyConfig = {
  name: 'Default',
  tier: 'TRANSPORT_ONLY',
  requireTEE: false,
  minFragments: 3,
  maxFragments: 5,
  piiStripping: false,
  canaryInjection: true,        // canaries on by default — low cost, high detection value
};

export const ENTERPRISE_PRIVACY_POLICY: PrivacyPolicyConfig = {
  name: 'Enterprise',
  tier: 'BLIND_ROUTING',
  requireTEE: false,
  minFragments: 3,
  maxFragments: 7,
  piiStripping: true,
  canaryInjection: true,
};

export const HIPAA_PRIVACY_POLICY: PrivacyPolicyConfig = {
  name: 'HIPAA Compliant',
  tier: 'CONFIDENTIAL',
  allowedRegions: ['US'],
  requireTEE: true,
  minFragments: 5,
  maxFragments: 7,
  piiStripping: true,
  canaryInjection: true,
};

// --- Canary Token ---

export interface CanaryToken {
  id: string;                   // unique identifier for this canary
  token: string;                // the canary text injected into the prompt
  nodeId: string;               // which node received this canary
  injectedAt: Date;
  detectedAt?: Date;            // if the canary was found outside the expected path
  status: 'active' | 'triggered' | 'expired';
}

// --- Compliance Mapping ---

export interface ComplianceRequirement {
  framework: 'GDPR' | 'HIPAA' | 'SOC2' | 'PCI_DSS' | 'CCPA';
  minimumTier: PrivacyTier;
  requiredRegions?: string[];
  requireTEE: boolean;
  requirePIIStripping: boolean;
  dataRetentionDays: number;    // max days to retain routing logs
}

export const COMPLIANCE_REQUIREMENTS: Record<string, ComplianceRequirement> = {
  GDPR: {
    framework: 'GDPR',
    minimumTier: 'BLIND_ROUTING',
    requiredRegions: ['DE', 'FR', 'NL', 'IE', 'SE', 'FI', 'AT', 'BE', 'IT', 'ES', 'PT', 'PL', 'CZ', 'DK', 'NO'],
    requireTEE: false,
    requirePIIStripping: true,
    dataRetentionDays: 30,
  },
  HIPAA: {
    framework: 'HIPAA',
    minimumTier: 'CONFIDENTIAL',
    requiredRegions: ['US'],
    requireTEE: true,
    requirePIIStripping: true,
    dataRetentionDays: 365,     // HIPAA requires 6-year retention but we only log routing metadata
  },
  SOC2: {
    framework: 'SOC2',
    minimumTier: 'BLIND_ROUTING',
    requireTEE: false,
    requirePIIStripping: false,
    dataRetentionDays: 90,
  },
  PCI_DSS: {
    framework: 'PCI_DSS',
    minimumTier: 'CONFIDENTIAL',
    requireTEE: true,
    requirePIIStripping: true,
    dataRetentionDays: 365,
  },
  CCPA: {
    framework: 'CCPA',
    minimumTier: 'BLIND_ROUTING',
    requiredRegions: ['US'],
    requireTEE: false,
    requirePIIStripping: true,
    dataRetentionDays: 30,
  },
};
