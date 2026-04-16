// ---------------------------------------------------------------------------
// Privacy Tiers — honest classification of what each provider can guarantee
// ---------------------------------------------------------------------------
// Three tiers, from strongest to weakest:
//
//   CLOUD_TEE       — Hardware-backed TEE (Azure Confidential, AWS Nitro).
//                     Cryptographic attestation verifiable by the client.
//                     Use for: PII, financial data, HIPAA, SOC 2 workloads.
//
//   CLOUD_STANDARD  — Major cloud providers (Anthropic, OpenAI, Google).
//                     Privacy backed by ToS and DPA, not hardware attestation.
//                     Use for: Business data, internal tools, non-regulated work.
//
//   BEST_EFFORT     — Community/decentralized nodes (Darkbloom, OpenClaw, Ollama).
//                     OS-level hardening only (SIP, hardened runtime).
//                     No verifiable confidentiality on consumer hardware today.
//                     Use for: Public data, classification, image generation.
// ---------------------------------------------------------------------------

export type PrivacyTier = 'CLOUD_TEE' | 'CLOUD_STANDARD' | 'BEST_EFFORT';

/**
 * Maps each known provider to its privacy tier.
 * Providers not listed default to CLOUD_STANDARD.
 */
export const PROVIDER_PRIVACY_MAP: Record<string, PrivacyTier> = {
  // Cloud TEE — hardware attestation available
  AZURE_OPENAI: 'CLOUD_TEE',       // Azure Confidential Computing
  AWS_BEDROCK: 'CLOUD_TEE',        // AWS Nitro Enclaves

  // Cloud Standard — ToS/DPA backed
  ANTHROPIC: 'CLOUD_STANDARD',
  OPENAI: 'CLOUD_STANDARD',
  GOOGLE: 'CLOUD_STANDARD',
  DEEPSEEK: 'CLOUD_STANDARD',
  MISTRAL: 'CLOUD_STANDARD',
  COHERE: 'CLOUD_STANDARD',
  XAI: 'CLOUD_STANDARD',
  PERPLEXITY: 'CLOUD_STANDARD',
  CEREBRAS: 'CLOUD_STANDARD',
  SAMBANOVA: 'CLOUD_STANDARD',
  FIREWORKS: 'CLOUD_STANDARD',
  TOGETHER: 'CLOUD_STANDARD',
  GROQ: 'CLOUD_STANDARD',
  MODAL: 'CLOUD_STANDARD',
  LAMBDA: 'CLOUD_STANDARD',
  COREWEAVE: 'CLOUD_STANDARD',

  // Best Effort — OS hardening only, no verifiable TEE
  DARKBLOOM: 'BEST_EFFORT',
  OLLAMA: 'BEST_EFFORT',
  ON_PREM: 'BEST_EFFORT',
  BITTENSOR: 'BEST_EFFORT',
  AKASH: 'BEST_EFFORT',
  HYPERBOLIC: 'BEST_EFFORT',
  CHUTES: 'BEST_EFFORT',
  NOSANA: 'BEST_EFFORT',
};

/**
 * Get the privacy tier for a provider.
 */
export function getProviderPrivacyTier(provider: string): PrivacyTier {
  return PROVIDER_PRIVACY_MAP[provider.toUpperCase()] ?? 'CLOUD_STANDARD';
}

/**
 * Check if a provider meets the minimum required privacy tier.
 * Ordering: CLOUD_TEE > CLOUD_STANDARD > BEST_EFFORT
 */
export function meetsPrivacyRequirement(
  providerTier: PrivacyTier,
  requiredTier: PrivacyTier,
): boolean {
  const TIER_RANK: Record<PrivacyTier, number> = {
    CLOUD_TEE: 3,
    CLOUD_STANDARD: 2,
    BEST_EFFORT: 1,
  };
  return TIER_RANK[providerTier] >= TIER_RANK[requiredTier];
}

/**
 * Filter a list of provider candidates by minimum privacy tier.
 */
export function filterByPrivacyTier<T extends { provider: string }>(
  candidates: T[],
  minimumTier: PrivacyTier,
): T[] {
  return candidates.filter((c) =>
    meetsPrivacyRequirement(
      getProviderPrivacyTier(c.provider),
      minimumTier,
    ),
  );
}

/**
 * Detect if a prompt likely contains sensitive data that warrants
 * a higher privacy tier. Simple heuristic — not a replacement for
 * user-configured policies.
 */
export function detectSensitivityLevel(prompt: string): PrivacyTier {
  const lower = prompt.toLowerCase();

  // PII / regulated data patterns → require TEE
  const teePatterns = [
    /\b(ssn|social security|passport|medical record)\b/,
    /\b(hipaa|phi|pci[-\s]?dss|sox compliance)\b/,
    /\b\d{3}-\d{2}-\d{4}\b/,        // SSN format
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // CC number
  ];
  if (teePatterns.some((p) => p.test(lower))) return 'CLOUD_TEE';

  // Business data patterns → cloud standard
  const standardPatterns = [
    /\b(confidential|internal only|proprietary|trade secret)\b/,
    /\b(customer data|user data|employee|salary)\b/,
    /\b(api[_\s]?key|secret[_\s]?key|bearer token|password)\b/,
  ];
  if (standardPatterns.some((p) => p.test(lower))) return 'CLOUD_STANDARD';

  // Default — no detected sensitivity
  return 'BEST_EFFORT';
}
