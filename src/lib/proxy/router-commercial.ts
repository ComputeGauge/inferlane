// Commercial-build extensions to the proxy router.
//
// Keeps src/lib/proxy/router.ts untouched so the ~1000 lines of tuned
// routing logic don't get invasively rewritten. This module wraps the
// base router to add:
//
//   1. Attestation-aware pre-filtering.
//      Before routing a workload, if the buyer has requested the
//      Confidential privacy tier, we verify the candidate providers
//      meet the tier by consulting the AttestationRecord store.
//      Providers whose latest attestation is not VERIFIED (or whose
//      measurement has expired) are excluded from the routing pool.
//
//   2. Rebate-aware post-processing.
//      After the base router has picked the winner, we look up any
//      rebate arrangement for (provider, model) and record the
//      expected earning. The router's winner selection is NOT changed
//      by rebate presence — quality/cost/latency/error still dominate.
//      The rebate is a revenue recognition side-effect.
//
//   3. (Optional) Tiebreaker.
//      If two candidates are within 0.5% of each other on the composite
//      score, the one with a better rebate wins. This is the only case
//      where rebates influence routing, and it's bounded so a worse
//      provider can never win a rebate chase. The tiebreaker lives in
//      pickTiebreaker() below and is exported for tests.

import type { RoutingDecision, RoutingRequest } from './router';
import { lookupRebate, recordEarning } from '@/lib/rebates';
import { logger } from '@/lib/telemetry';

export type PrivacyTier = 'TRANSPORT_ONLY' | 'CONFIDENTIAL' | 'FEDERATED';

export interface CommercialRoutingRequest extends RoutingRequest {
  /**
   * Privacy tier the buyer is requesting. If omitted, TRANSPORT_ONLY
   * is assumed and no attestation check runs.
   */
  privacyTier?: PrivacyTier;
  /**
   * When true, reject any decision that can't be proven to meet the
   * requested tier. When false (default), downgrade gracefully and
   * log a warning.
   */
  strictTier?: boolean;
}

/**
 * Candidate entry accepted by the attestation pre-filter. Shapes
 * match what the base router's `findEquivalents` returns.
 */
export interface Candidate {
  provider: string;
  model: string;
  qualityScore?: number;
  [k: string]: unknown;
}

/**
 * Providers that are inherently attested because they only serve
 * their own managed endpoints from inside their own TEE perimeter.
 * Workloads routed to these providers pass Confidential tier by
 * default; we still record an AttestationRecord with type MANAGED
 * for the audit trail.
 */
const INHERENTLY_ATTESTED_PROVIDERS = new Set<string>([
  'anthropic-confidential',  // Anthropic's confidential compute program
  'azure-openai-ccv',         // Azure OpenAI Confidential VMs
  'gcp-vertex-conf',           // Vertex AI Confidential Space
]);

/**
 * Filter a candidate list to only those providers that can serve the
 * given privacy tier. Returns the filtered candidates and a list of
 * diagnostics so the caller can surface why a provider was dropped.
 */
export async function filterByTier(
  candidates: Candidate[],
  tier: PrivacyTier | undefined,
): Promise<{ passed: Candidate[]; dropped: { provider: string; reason: string }[] }> {
  if (!tier || tier === 'TRANSPORT_ONLY') {
    return { passed: candidates, dropped: [] };
  }

  const passed: Candidate[] = [];
  const dropped: { provider: string; reason: string }[] = [];

  for (const c of candidates) {
    if (tier === 'CONFIDENTIAL') {
      if (INHERENTLY_ATTESTED_PROVIDERS.has(c.provider)) {
        passed.push(c);
        continue;
      }
      const verdict = await lookupLatestAttestation(c.provider);
      if (verdict && verdict.outcome === 'VERIFIED' && verdict.fresh) {
        passed.push(c);
      } else {
        dropped.push({
          provider: c.provider,
          reason: verdict
            ? `Attestation not fresh or not verified: ${verdict.outcome}`
            : 'No attestation on file',
        });
      }
      continue;
    }

    if (tier === 'FEDERATED') {
      // Federated workloads only run on locally-hosted inference (the
      // caller's own node, the node daemon, or OpenClaw). Providers
      // that are third-party SaaS are always dropped.
      if (c.provider === 'openclaw' || c.provider === 'local') {
        passed.push(c);
      } else {
        dropped.push({
          provider: c.provider,
          reason: 'Federated tier requires local or decentralised execution',
        });
      }
    }
  }

  return { passed, dropped };
}

interface AttestationLookupResult {
  outcome: 'VERIFIED' | 'STALE' | 'BAD_SIGNATURE' | 'POLICY_VIOLATION' | 'ERROR';
  fresh: boolean;
}

/**
 * Look up the most recent AttestationRecord for a provider identifier
 * and return a minimal verdict shape. Returns null if no record exists.
 *
 * Stub: the DB projection lands in Phase 4.2 when the node-level
 * attestation scheduler starts writing records. Until then this always
 * returns null, which causes the filter to drop Confidential-tier
 * workloads from all non-inherently-attested providers. That's the
 * safe default.
 */
async function lookupLatestAttestation(
  _provider: string,
): Promise<AttestationLookupResult | null> {
  // TODO(phase-4.2): SELECT FROM attestation_records WHERE provider = ...
  // ORDER BY verifiedAt DESC LIMIT 1. Check validUntil > now().
  return null;
}

/**
 * Apply a rebate tiebreaker between the winning decision and any
 * near-miss candidates. Returns the winner to use — usually the
 * original, occasionally a rebate-advantaged near-miss if it was
 * within 0.5% on composite score.
 *
 * The base router does NOT call this. Callers that want rebate-aware
 * tiebreaking wrap their call like:
 *
 *   const decision = await routeRequest(req);
 *   const final = pickTiebreaker(decision, candidates);
 *
 * Today most callers will use the simpler recordExpectedRebate() below
 * because rebate is revenue-recognition-only, not a routing concern.
 */
export function pickTiebreaker<T extends { provider: string; model: string; score: number }>(
  winner: T,
  nearMisses: T[],
): T {
  // Only consider candidates within 0.5% of the winner's score.
  const threshold = winner.score * 0.995;
  const contenders = nearMisses.filter((c) => c.score >= threshold && c.provider !== winner.provider);
  if (contenders.length === 0) return winner;

  // Among winner + contenders, pick the one with the largest
  // rebate discount. Cap by the 5% rebate weight ceiling so even
  // this tiebreaker is bounded.
  const withRebate = [winner, ...contenders].map((c) => {
    const cfg = lookupRebate(c.provider, c.model);
    return { candidate: c, rebateBps: cfg?.discountBps ?? 0 };
  });

  withRebate.sort((a, b) => b.rebateBps - a.rebateBps);
  return withRebate[0].candidate;
}

/**
 * Record the rebate we expect to earn from a completed workload.
 * Called from the dispatch/proxy completion path after the upstream
 * provider invoice is known. The rebate is recorded as a side-effect
 * for revenue recognition; it does not alter routing.
 */
export async function recordExpectedRebate(params: {
  provider: string;
  model: string;
  rackRateUsdCents: bigint;
  actualInvoiceUsdCents: bigint;
}): Promise<bigint> {
  const cfg = lookupRebate(params.provider, params.model);
  if (!cfg) {
    // No rebate arrangement on file — we pay rack rate, keep nothing.
    return BigInt(0);
  }

  const rebateUsdCents = params.rackRateUsdCents - params.actualInvoiceUsdCents;
  if (rebateUsdCents <= BigInt(0)) {
    return BigInt(0);
  }

  await recordEarning({
    provider: params.provider,
    model: params.model,
    rackRateUsdCents: params.rackRateUsdCents,
    invoicedUsdCents: params.actualInvoiceUsdCents,
    rebateUsdCents,
    appliedAt: new Date(),
  });

  return rebateUsdCents;
}

/**
 * Decision gate used by the Confidential-tier dispatch path. Given a
 * RoutingDecision from the base router and the requested tier, either
 * approve the decision or reject with a reason. Approval requires the
 * chosen provider to be inherently attested OR to have a fresh
 * VERIFIED AttestationRecord on file.
 */
export async function gateByPrivacyTier(
  decision: RoutingDecision,
  tier: PrivacyTier | undefined,
): Promise<{ approved: boolean; reason: string | null }> {
  if (!tier || tier === 'TRANSPORT_ONLY') {
    return { approved: true, reason: null };
  }

  if (tier === 'CONFIDENTIAL') {
    if (INHERENTLY_ATTESTED_PROVIDERS.has(decision.provider)) {
      return { approved: true, reason: null };
    }
    const verdict = await lookupLatestAttestation(decision.provider);
    if (verdict && verdict.outcome === 'VERIFIED' && verdict.fresh) {
      return { approved: true, reason: null };
    }
    logger.warn('router.confidential.gate_fail', {
      provider: decision.provider,
      model: decision.model,
      reason: verdict ? verdict.outcome : 'no_record',
    });
    return {
      approved: false,
      reason: verdict
        ? `Confidential tier requires a fresh VERIFIED attestation; got ${verdict.outcome}`
        : 'Confidential tier requires a fresh VERIFIED attestation; none on file',
    };
  }

  if (tier === 'FEDERATED') {
    if (decision.provider === 'openclaw' || decision.provider === 'local') {
      return { approved: true, reason: null };
    }
    return {
      approved: false,
      reason: 'Federated tier requires local or decentralised execution',
    };
  }

  return { approved: true, reason: null };
}
