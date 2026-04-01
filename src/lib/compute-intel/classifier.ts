// ---------------------------------------------------------------------------
// Compute Classification Engine (Stream U)
// ---------------------------------------------------------------------------
// Introspects providers and nodes to produce a ComputeClassification —
// a multi-dimensional descriptor of what compute a resource actually delivers.
//
// Three data sources:
// 1. Static registry — ProviderEntry + ModelPrice baseline
// 2. Active verification — probe results update measured metrics
// 3. Node self-reporting — OpenClaw nodes declare, probes confirm
// ---------------------------------------------------------------------------

import { PROVIDER_REGISTRY } from '@/lib/providers/registry';
import { MODEL_PRICES, findModelPrice } from '@/lib/pricing/model-prices';
import type {
  ComputeClassification,
  InferenceType,
  QualityTier,
  LatencyClass,
  PrivacyClass,
  AvailabilityClass,
  HardwareClass,
  SettlementLane,
  SettlementTerms,
  VerificationMethod,
  VerificationResult,
  VerificationOutcome,
} from './types';
import {
  QUALITY_TIER_PATTERNS,
  DEFAULT_NODE_TIER,
  DEFAULT_PROVIDER_TIER,
  CATEGORY_TO_INFERENCE,
  INFERENCE_TYPE_PATTERNS,
  DATACENTER_PROVIDERS,
  LANE_DEFAULTS,
  deriveLatencyClass,
  calculateVerificationScore,
} from './types';
import { randomBytes } from 'crypto';

// ── Static Classification (from registry + model prices) ──────────────────

/**
 * Build a baseline classification from static provider/model metadata.
 * No network calls — purely from the registry and pricing data.
 */
export function classifyFromRegistry(
  targetType: 'provider' | 'node',
  targetId: string,
  model: string,
): ComputeClassification {
  const now = new Date();
  const id = randomBytes(12).toString('hex');

  // --- Inference Type ---
  let inferenceType: InferenceType = 'CHAT'; // default

  // Check model-specific patterns first (reasoning, code, audio)
  for (const { pattern, type } of INFERENCE_TYPE_PATTERNS) {
    if (pattern.test(model)) {
      inferenceType = type;
      break;
    }
  }

  // If no pattern matched, use ModelPrice.category
  if (inferenceType === 'CHAT') {
    const price = findModelPrice(model);
    if (price && CATEGORY_TO_INFERENCE[price.category]) {
      inferenceType = CATEGORY_TO_INFERENCE[price.category];
    }
  }

  // --- Quality Tier ---
  let qualityTier: QualityTier = targetType === 'node' ? DEFAULT_NODE_TIER : DEFAULT_PROVIDER_TIER;
  for (const { pattern, tier } of QUALITY_TIER_PATTERNS) {
    if (pattern.test(model)) {
      qualityTier = tier;
      break;
    }
  }

  // --- Hardware Class ---
  let hardwareClass: HardwareClass = 'UNKNOWN';
  if (targetType === 'provider' && DATACENTER_PROVIDERS.has(targetId.toUpperCase())) {
    hardwareClass = 'DATACENTER_GPU';
  }
  // Nodes start as UNKNOWN until verified (TEE attestation upgrades to TEE_CAPABLE)

  // --- Privacy Class ---
  // Default: centralised providers = TRANSPORT (they see everything anyway)
  // Nodes can potentially support higher tiers
  let privacyClass: PrivacyClass = 'TRANSPORT';

  // --- Availability Class ---
  // Centralised providers with SLAs = RESERVED; nodes = SPOT by default
  let availabilityClass: AvailabilityClass = targetType === 'provider' ? 'RESERVED' : 'SPOT';

  // --- Regions ---
  const regions: string[] = [];
  if (targetType === 'provider') {
    // Known providers mostly operate multi-region, but we don't have specifics
    // Leave empty — will be populated by latency attestation
  }

  // --- Settlement Lane ---
  // Known centralised providers start at STANDARD (we trust them to deliver, but
  // no partnership agreement yet for instant settlement).
  // Nodes start at DEFERRED (must build trust).
  const settlementLane: SettlementLane = targetType === 'provider' ? 'STANDARD' : 'DEFERRED';
  const settlementTerms: SettlementTerms = { ...LANE_DEFAULTS[settlementLane] };

  return {
    id,
    targetType,
    targetId,
    model,
    inferenceType,
    qualityTier,
    latencyClass: 'INTERACTIVE' as LatencyClass, // default until measured
    privacyClass,
    availabilityClass,
    hardwareClass,
    regions,
    measuredLatencyMs: null,
    measuredThroughputTps: null,
    measuredAccuracy: null,
    verificationMethods: ['SELF_REPORTED'],
    verificationScore: 0,
    lastVerifiedAt: null,
    verificationTTLHours: 24,
    signature: null,
    signedAt: null,
    signerKeyId: null,
    settlementLane,
    settlementTerms,
    createdAt: now,
    updatedAt: now,
  };
}

// ── Update Classification from Verification ──────────────────────────────

/**
 * Update a classification with verification probe results.
 * Modifies measured metrics, verification score, and latency class.
 */
export function updateFromVerification(
  classification: ComputeClassification,
  results: VerificationResult[],
): ComputeClassification {
  const updated = { ...classification };
  const now = new Date();

  // Collect all methods that were VERIFIED
  const verifiedMethods = new Set<VerificationMethod>();
  const latencies: number[] = [];
  const accuracies: number[] = [];

  for (const result of results) {
    if (result.outcome === 'VERIFIED') {
      verifiedMethods.add(result.method);
    }

    // Extract measured metrics from probe details
    if (result.method === 'PROBE_REQUEST' || result.method === 'QUALITY_SAMPLE') {
      latencies.push(result.latencyMs);

      const accuracy = result.details?.accuracy as number | undefined;
      if (accuracy !== undefined) {
        accuracies.push(accuracy);
      }

      const throughput = result.details?.tokensPerSecond as number | undefined;
      if (throughput !== undefined) {
        updated.measuredThroughputTps = throughput;
      }
    }

    if (result.method === 'LATENCY_ATTESTATION') {
      latencies.push(result.latencyMs);

      const detectedRegion = result.details?.detectedRegion as string | undefined;
      if (detectedRegion && !updated.regions.includes(detectedRegion)) {
        updated.regions = [...updated.regions, detectedRegion];
      }
    }

    if (result.method === 'HARDWARE_ATTESTATION' && result.outcome === 'VERIFIED') {
      const teeType = result.details?.teeType as string | undefined;
      if (teeType) {
        updated.hardwareClass = 'TEE_CAPABLE';
        updated.privacyClass = 'CONFIDENTIAL';
      }
    }
  }

  // Update measured latency (p50)
  if (latencies.length > 0) {
    latencies.sort((a, b) => a - b);
    const p50Index = Math.floor(latencies.length / 2);
    updated.measuredLatencyMs = latencies[p50Index];
    updated.latencyClass = deriveLatencyClass(latencies[p50Index]);
  }

  // Update measured accuracy (average)
  if (accuracies.length > 0) {
    updated.measuredAccuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
  }

  // Update verification
  const allMethods = new Set([...updated.verificationMethods, ...verifiedMethods]);
  // Remove SELF_REPORTED if we have any real verification
  if (allMethods.size > 1) {
    allMethods.delete('SELF_REPORTED');
  }
  updated.verificationMethods = Array.from(allMethods);

  updated.verificationScore = calculateVerificationScore(
    results.map((r) => ({ method: r.method, outcome: r.outcome })),
  );

  updated.lastVerifiedAt = now;
  updated.updatedAt = now;

  return updated;
}

// ── Node Self-Report Classification ───────────────────────────────────────

/** Fields a node operator can declare about their compute */
export interface NodeSelfReport {
  models: string[];
  regions: string[];
  teeAttested: boolean;
  teeType?: 'SGX' | 'SEV' | 'TZ' | 'NVIDIA_CC';
  maxConcurrent: number;
  gpuType?: string;
  availabilityClass?: AvailabilityClass;
}

/**
 * Build classification from a node's self-reported capabilities.
 * All claims start as SELF_REPORTED verification — probes upgrade later.
 */
export function classifyFromNodeReport(
  nodeId: string,
  model: string,
  report: NodeSelfReport,
): ComputeClassification {
  const base = classifyFromRegistry('node', nodeId, model);

  // Apply self-reported data
  base.regions = report.regions;
  base.availabilityClass = report.availabilityClass || 'SPOT';

  if (report.teeAttested) {
    base.hardwareClass = 'TEE_CAPABLE';
    base.privacyClass = 'TEE_PREFERRED'; // not CONFIDENTIAL until hardware attestation verified
  }

  if (report.gpuType) {
    const gpu = report.gpuType.toUpperCase();
    if (/A100|H100|H200|A10G|L40|B200/i.test(gpu)) {
      base.hardwareClass = base.hardwareClass === 'TEE_CAPABLE' ? 'TEE_CAPABLE' : 'DATACENTER_GPU';
    } else if (/RTX|GTX|3090|4090|3080|4080/i.test(gpu)) {
      base.hardwareClass = base.hardwareClass === 'TEE_CAPABLE' ? 'TEE_CAPABLE' : 'CONSUMER_GPU';
    }
  }

  return base;
}

// ── Classification Lookup Helpers ─────────────────────────────────────────

/** Get all models available from a provider */
export function getProviderModels(providerId: string): string[] {
  return MODEL_PRICES
    .filter((p) => p.provider.toUpperCase() === providerId.toUpperCase())
    .map((p) => p.model);
}

/** Check if a provider exists in the registry */
export function isKnownProvider(providerId: string): boolean {
  return providerId.toUpperCase() in PROVIDER_REGISTRY;
}

/**
 * Generate classifications for all models of a known provider.
 * Useful for initial seeding when a provider connects.
 */
export function classifyAllProviderModels(providerId: string): ComputeClassification[] {
  const models = getProviderModels(providerId);
  return models.map((model) => classifyFromRegistry('provider', providerId, model));
}
