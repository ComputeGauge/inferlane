// ---------------------------------------------------------------------------
// Spot Engine — real-time best-available-price discovery across active offers
// ---------------------------------------------------------------------------
// READ-ONLY query over the offers table + health tracker data.
// Given a model + token estimate + constraints, returns ranked candidates.
//
// Scoring weights:
//   70% price    — normalized effective cost
//   20% reliability — from health tracker (1 - errorRate)
//   10% latency  — normalized inverse p95
// ---------------------------------------------------------------------------

import {
  type SpotQuery,
  type SpotResult,
  type CapacityOffer,
  OfferStatus,
  ProviderType,
} from './types';
import { findEquivalents } from '@/lib/proxy/model-equivalence';
import { healthTracker, type ProviderHealth } from '@/lib/proxy/health-tracker';

// ---------------------------------------------------------------------------
// Scoring weights
// ---------------------------------------------------------------------------

const WEIGHT_PRICE = 0.7;
const WEIGHT_RELIABILITY = 0.2;
const WEIGHT_LATENCY = 0.1;

const DEFAULT_LIMIT = 5;
const MAX_LATENCY_FALLBACK_MS = 10_000; // 10s default if no constraint

// ---------------------------------------------------------------------------
// Core matching algorithm
// ---------------------------------------------------------------------------

export async function findBestOffers(query: SpotQuery): Promise<SpotResult[]> {
  const offers = await fetchActiveOffers(query);

  if (offers.length === 0) return [];

  // Resolve equivalent model names so we can match cross-provider
  const equivalentModels = resolveEquivalentModels(query.model);

  // Phase 1: Filter
  const candidates = offers.filter((offer) => {
    // Model match — exact or equivalent
    if (!matchesModel(offer.model, query.model, equivalentModels)) return false;

    // Exhausted / expired check
    if (offer.status !== OfferStatus.ACTIVE) return false;
    if (offer.utilizationPct >= 100) return false;

    // Time window check
    const now = new Date();
    if (offer.availableFrom > now || offer.availableUntil < now) return false;

    // Attestation filter
    if (query.requireAttestation && !offer.attestationType) return false;

    // Provider type filter
    if (query.providerType && offer.providerType !== query.providerType) return false;

    // Price ceiling filters
    if (query.maxPricePerMtokInput !== undefined && offer.inputPricePerMtok > query.maxPricePerMtokInput) return false;
    if (query.maxPricePerMtokOutput !== undefined && offer.outputPricePerMtok > query.maxPricePerMtokOutput) return false;

    // Exclude blacklisted providers
    if (query.excludeProviderIds?.includes(offer.providerId)) return false;

    return true;
  });

  if (candidates.length === 0) return [];

  // Phase 2: Score and rank
  const scored = candidates.map((offer) => scoreOffer(offer, query));

  // Sort by composite score (lower = better)
  scored.sort((a, b) => a.compositeScore - b.compositeScore);

  // Return top N
  const limit = query.limit ?? DEFAULT_LIMIT;
  return scored.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Fetch active offers from the database
// ---------------------------------------------------------------------------

async function fetchActiveOffers(query: SpotQuery): Promise<CapacityOffer[]> {
  try {
    const { prisma } = await import('@/lib/db');
    const now = new Date();

    const where: Record<string, unknown> = {
      status: OfferStatus.ACTIVE,
      availableFrom: { lte: now },
      availableUntil: { gte: now },
      utilizationPct: { lt: 100 },
    };

    // Pre-filter by provider type if specified
    if (query.providerType) {
      where.providerType = query.providerType;
    }

    // Exclude specific providers
    if (query.excludeProviderIds && query.excludeProviderIds.length > 0) {
      where.providerId = { notIn: query.excludeProviderIds };
    }

    const records = await (prisma as any).capacityOffer.findMany({
      where,
      orderBy: { inputPricePerMtok: 'asc' },
      take: 100, // cap the scan — the scoring phase narrows further
    });

    return records.map(mapRecord);
  } catch {
    // If DB is not available (no Prisma schema yet), return empty
    return [];
  }
}

// ---------------------------------------------------------------------------
// Model matching — exact + equivalence tier
// ---------------------------------------------------------------------------

function resolveEquivalentModels(model: string): Set<string> {
  const equivalents = findEquivalents(model);
  const names = new Set<string>();
  names.add(model.toLowerCase());
  for (const eq of equivalents) {
    names.add(eq.model.toLowerCase());
  }
  return names;
}

function matchesModel(
  offerModel: string,
  queryModel: string,
  equivalentModels: Set<string>,
): boolean {
  const offerLower = offerModel.toLowerCase();
  const queryLower = queryModel.toLowerCase();

  // Exact match
  if (offerLower === queryLower) return true;

  // Equivalence tier match
  if (equivalentModels.has(offerLower)) return true;

  // Substring match for versioned models (e.g. query "claude-sonnet-4-5" matches "claude-sonnet-4-5-20250514")
  if (offerLower.startsWith(queryLower) || queryLower.startsWith(offerLower)) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function scoreOffer(offer: CapacityOffer, query: SpotQuery): SpotResult {
  // Effective cost for this query
  const inputCost = (offer.inputPricePerMtok / 1_000_000) * query.estimatedInputTokens;
  const outputCost = (offer.outputPricePerMtok / 1_000_000) * query.estimatedOutputTokens;
  const estimatedCostUsd = inputCost + outputCost;

  // Health data from the tracker
  const health = getHealth(offer.providerId);
  const reliabilityScore = health.totalSamples > 0
    ? Math.max(0, 1 - health.errorRate)
    : 0.8; // default for unknown providers
  const latencyP95Ms = health.latencyP95 || 500; // default 500ms for unknown

  // Latency filter — if query has a max latency constraint, penalize heavily
  const maxLatency = query.maxLatencyMs ?? MAX_LATENCY_FALLBACK_MS;
  const latencyPenalty = latencyP95Ms > maxLatency ? 1000 : 0;

  // Normalize scores to 0-1 range for composite calculation
  // Price: lower is better — use the raw cost (will be compared relatively)
  const priceScore = estimatedCostUsd;

  // Reliability: higher is better — invert so lower = better in composite
  const reliabilityInverse = 1 - reliabilityScore;

  // Latency: lower is better — normalize against max
  const latencyNorm = Math.min(latencyP95Ms / maxLatency, 1);

  // Composite (lower = better)
  const compositeScore =
    WEIGHT_PRICE * priceScore * 1000 + // scale price to be comparable
    WEIGHT_RELIABILITY * reliabilityInverse * 100 +
    WEIGHT_LATENCY * latencyNorm * 100 +
    latencyPenalty;

  return {
    offerId: offer.id,
    providerId: offer.providerId,
    providerType: offer.providerType,
    model: offer.model,
    inputPricePerMtok: offer.inputPricePerMtok,
    outputPricePerMtok: offer.outputPricePerMtok,
    estimatedCostUsd: Math.round(estimatedCostUsd * 100_000_000) / 100_000_000, // 8 decimal places
    reliabilityScore,
    latencyP95Ms,
    compositeScore: Math.round(compositeScore * 1000) / 1000,
    gpuType: offer.gpuType,
    attestationType: offer.attestationType,
    utilizationPct: offer.utilizationPct,
    availableUntil: offer.availableUntil,
  };
}

// ---------------------------------------------------------------------------
// Health tracker integration
// ---------------------------------------------------------------------------

function getHealth(providerId: string): ProviderHealth {
  // The health tracker keys by provider name (ANTHROPIC, OPENAI, etc.)
  // For decentralized providers, we use the providerId directly
  try {
    return healthTracker.getProviderHealth(providerId);
  } catch {
    return {
      latencyP50: 0,
      latencyP95: 0,
      errorRate: 0,
      isHealthy: true,
      cooldownUntil: null,
      totalSamples: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// Record mapper — Prisma record -> CapacityOffer
// ---------------------------------------------------------------------------

function mapRecord(record: any): CapacityOffer {
  return {
    id: record.id,
    providerId: record.providerId,
    providerType: record.providerType as ProviderType,
    model: record.model,
    maxTokensPerSec: record.maxTokensPerSec,
    maxConcurrent: record.maxConcurrent,
    gpuType: record.gpuType ?? null,
    memoryGb: record.memoryGb ?? null,
    inputPricePerMtok: Number(record.inputPricePerMtok),
    outputPricePerMtok: Number(record.outputPricePerMtok),
    minimumSpend: Number(record.minimumSpend),
    availableFrom: new Date(record.availableFrom),
    availableUntil: new Date(record.availableUntil),
    timezone: record.timezone,
    recurringCron: record.recurringCron ?? null,
    attestationType: record.attestationType ?? null,
    lastAttestation: record.lastAttestation ? new Date(record.lastAttestation) : null,
    attestationHash: record.attestationHash ?? null,
    status: record.status as OfferStatus,
    utilizationPct: record.utilizationPct,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}
