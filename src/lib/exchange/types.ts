// ---------------------------------------------------------------------------
// Exchange types — shared interfaces for capacity offers, fills, and spot queries
// ---------------------------------------------------------------------------
// These are the internal TypeScript types used by the spot engine and offer
// manager. Prisma models handle DB persistence separately — when the Prisma
// schema is extended with CapacityOffer / CapacityFill, these types map 1:1.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum ProviderType {
  CENTRALIZED = 'CENTRALIZED',       // Anthropic, OpenAI, Google
  DECENTRALIZED = 'DECENTRALIZED',   // Darkbloom, OpenClaw, individual operators
  HYBRID = 'HYBRID',                 // Enterprise on-prem with cloud burst
}

export enum OfferStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  EXHAUSTED = 'EXHAUSTED',   // max concurrent reached
  EXPIRED = 'EXPIRED',       // past availableUntil
  WITHDRAWN = 'WITHDRAWN',
}

export enum AttestationType {
  APPLE_SEP = 'APPLE_SEP',
  INTEL_SGX = 'INTEL_SGX',
  AMD_SEV = 'AMD_SEV',
  ARM_TRUSTZONE = 'ARM_TRUSTZONE',
  NVIDIA_CC = 'NVIDIA_CC',
}

// ---------------------------------------------------------------------------
// Capacity Offer — what a provider lists on the exchange
// ---------------------------------------------------------------------------

export interface CapacityOffer {
  id: string;
  providerId: string;
  providerType: ProviderType;

  // What's being offered
  model: string;                 // e.g. "claude-sonnet-4-5", "llama-3.3-70b"
  maxTokensPerSec: number;       // throughput ceiling
  maxConcurrent: number;         // max parallel requests
  gpuType?: string | null;       // e.g. "H100", "Apple M4 Max", "RTX 4090"
  memoryGb?: number | null;      // available VRAM/unified memory

  // Pricing (USD per million tokens)
  inputPricePerMtok: number;
  outputPricePerMtok: number;
  minimumSpend: number;

  // Availability window
  availableFrom: Date;
  availableUntil: Date;
  timezone: string;
  recurringCron?: string | null;

  // Trust / attestation
  attestationType?: AttestationType | null;
  lastAttestation?: Date | null;
  attestationHash?: string | null;

  // Status
  status: OfferStatus;
  utilizationPct: number;        // current load 0-100

  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Capacity Fill — a request matched to an offer (trade record)
// ---------------------------------------------------------------------------

export interface CapacityFill {
  id: string;
  offerId: string;
  buyerUserId: string;
  sellerProviderId: string;

  // What was filled
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;

  // Economics
  buyerPaidUsd: number;
  sellerEarnedUsd: number;
  exchangeFeeUsd: number;
  spreadBps: number;            // basis points of spread taken

  // Provenance
  attestationHash?: string | null;
  proxyRequestId?: string | null;

  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Spot Query — what a buyer asks the engine
// ---------------------------------------------------------------------------

export interface SpotQuery {
  model: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  maxLatencyMs?: number;           // exclude providers with p95 above this
  requireAttestation?: boolean;    // only TEE-verified providers
  providerType?: ProviderType;     // filter by provider category
  maxPricePerMtokInput?: number;   // price ceiling
  maxPricePerMtokOutput?: number;
  excludeProviderIds?: string[];   // blacklist specific providers
  limit?: number;                  // max candidates to return (default 5)
}

// ---------------------------------------------------------------------------
// Spot Result — what the engine returns
// ---------------------------------------------------------------------------

export interface SpotResult {
  offerId: string;
  providerId: string;
  providerType: ProviderType;
  model: string;

  // Pricing
  inputPricePerMtok: number;
  outputPricePerMtok: number;
  estimatedCostUsd: number;      // pre-calculated for the query's token estimates

  // Quality signals
  reliabilityScore: number;      // 0-1, from health tracker
  latencyP95Ms: number;          // from health tracker
  compositeScore: number;        // weighted final score (lower = better)

  // Metadata
  gpuType?: string | null;
  attestationType?: AttestationType | null;
  utilizationPct: number;
  availableUntil: Date;
}

// ---------------------------------------------------------------------------
// Offer filter options for listing
// ---------------------------------------------------------------------------

export interface OfferFilters {
  model?: string;
  providerType?: ProviderType;
  status?: OfferStatus;
  minInputPrice?: number;
  maxInputPrice?: number;
  minOutputPrice?: number;
  maxOutputPrice?: number;
  attestedOnly?: boolean;
  providerId?: string;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Offer create / update payloads
// ---------------------------------------------------------------------------

export interface CreateOfferInput {
  providerId: string;
  providerType: ProviderType;
  model: string;
  maxTokensPerSec: number;
  maxConcurrent: number;
  gpuType?: string;
  memoryGb?: number;
  inputPricePerMtok: number;
  outputPricePerMtok: number;
  minimumSpend?: number;
  availableFrom: Date | string;
  availableUntil: Date | string;
  timezone?: string;
  recurringCron?: string;
  attestationType?: AttestationType;
  attestationHash?: string;
}

export interface UpdateOfferInput {
  inputPricePerMtok?: number;
  outputPricePerMtok?: number;
  minimumSpend?: number;
  maxTokensPerSec?: number;
  maxConcurrent?: number;
  availableFrom?: Date | string;
  availableUntil?: Date | string;
  status?: OfferStatus.ACTIVE | OfferStatus.PAUSED;
  utilizationPct?: number;
}
