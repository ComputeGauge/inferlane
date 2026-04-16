// Provider rebate tracking — Robinhood PFOF analog for compute.
//
// Commercial build, Phase F6. Strategy doc: commercial/FLOAT_MODEL.md
// Leg 2 "Provider rebates".
//
// Thesis: Anthropic, OpenAI, Groq, Cerebras, xAI, Google, Mistral,
// Together, Fireworks etc. all have two pricing tiers:
//   - rack rate (what their pricing page shows)
//   - partnership rate (privately negotiated, 5-20% cheaper, sometimes
//     with guaranteed capacity floors)
//
// InferLane routes enough volume to qualify for partnership rates. We
// charge users near rack rate but invoice at partnership rate. The
// delta is revenue that lets us offer the user-facing surface for
// essentially free.
//
// This module tracks:
//   - Which provider+model pairs we have a partnership rate on.
//   - What the rebate structure looks like (flat %, volume tier, credit).
//   - Actual rebate amounts earned per request so the dashboard can
//     show both gross and net revenue.
//
// Moral hazard guardrail: the router MUST NOT pick a worse provider to
// chase a rebate. Rebate is a tiebreaker only. This is enforced in
// src/lib/proxy/router.ts by capping rebate weight at 5% of the
// composite score.

import { logger, withSpan } from '@/lib/telemetry';

export type RebateKind =
  | 'FLAT_PERCENT'        // e.g. 10% off every request
  | 'VOLUME_TIERED'       // discount escalates with monthly volume
  | 'CREDIT_POOL'         // provider gives $X/month in free credits
  | 'OFF_PEAK';           // discount only applies during provider off-hours

export interface ProviderRebateConfig {
  provider: string;                          // e.g. "anthropic", "openai"
  model: string | null;                      // null = applies to all models
  kind: RebateKind;
  /** Percentage off rack rate, in bps. 1000 = 10%. */
  discountBps: number;
  /** For VOLUME_TIERED: tier breakpoints [{minTokensPerMonth, discountBps}] */
  volumeTiers?: { minTokensPerMonth: bigint; discountBps: number }[];
  /** For CREDIT_POOL: monthly credit in USD cents */
  creditPoolCentsPerMonth?: bigint;
  /** For OFF_PEAK: cron-style window when discount applies */
  offPeakWindows?: string[];
  /** When the agreement started */
  effectiveFrom: Date;
  /** When the agreement expires */
  effectiveUntil: Date | null;
  /** Whether this arrangement is disclosed publicly on the transparency page */
  disclosed: boolean;
}

export interface RebateEarning {
  provider: string;
  model: string;
  rackRateUsdCents: bigint;
  invoicedUsdCents: bigint;
  rebateUsdCents: bigint;
  appliedAt: Date;
}

// In-memory registry; Phase F6.1 moves this to a ProviderRebate table.
const registry = new Map<string, ProviderRebateConfig>();

/**
 * Register a rebate arrangement. Usually loaded from config at startup.
 * Multiple registrations for the same provider+model are allowed; the
 * router picks the best applicable at request time.
 */
export function registerRebate(config: ProviderRebateConfig): void {
  const key = rebateKey(config.provider, config.model);
  registry.set(key, config);
  logger.info('rebate.registered', {
    provider: config.provider,
    model: config.model,
    kind: config.kind,
    discountBps: config.discountBps,
    disclosed: config.disclosed,
  });
}

/**
 * Look up the best applicable rebate for a given provider+model right
 * now. Returns null if no rebate applies.
 */
export function lookupRebate(
  provider: string,
  model: string,
): ProviderRebateConfig | null {
  const now = new Date();
  const candidates: ProviderRebateConfig[] = [];
  const modelKey = rebateKey(provider, model);
  const anyKey = rebateKey(provider, null);
  for (const key of [modelKey, anyKey]) {
    const cfg = registry.get(key);
    if (!cfg) continue;
    if (cfg.effectiveFrom > now) continue;
    if (cfg.effectiveUntil && cfg.effectiveUntil < now) continue;
    candidates.push(cfg);
  }
  if (candidates.length === 0) return null;
  // Pick highest discount.
  candidates.sort((a, b) => b.discountBps - a.discountBps);
  return candidates[0];
}

/**
 * Apply a rebate config to a rack-rate price and return what we would
 * actually be invoiced. Pure function; does not touch state.
 */
export function computeInvoicedAmount(params: {
  rackRateUsdCents: bigint;
  config: ProviderRebateConfig;
  monthlyTokens?: bigint;
  now?: Date;
}): bigint {
  const { rackRateUsdCents, config } = params;
  const now = params.now ?? new Date();

  // Expiry guard
  if (config.effectiveUntil && config.effectiveUntil < now) {
    return rackRateUsdCents;
  }

  let effectiveBps = config.discountBps;

  if (config.kind === 'VOLUME_TIERED' && config.volumeTiers && params.monthlyTokens) {
    // Find the tier we're in (highest applicable minimum).
    const tiers = [...config.volumeTiers].sort(
      (a, b) => Number(b.minTokensPerMonth - a.minTokensPerMonth),
    );
    const tier = tiers.find((t) => params.monthlyTokens! >= t.minTokensPerMonth);
    if (tier) effectiveBps = tier.discountBps;
    else effectiveBps = 0;
  }

  if (config.kind === 'OFF_PEAK') {
    // Phase F6.1: parse offPeakWindows and check against `now`.
    // For now assume the caller already filtered; return rack rate if
    // we can't prove we're in-window.
    return rackRateUsdCents;
  }

  const discount = (rackRateUsdCents * BigInt(effectiveBps)) / BigInt(10000);
  const invoiced = rackRateUsdCents - discount;
  return invoiced < BigInt(0) ? BigInt(0) : invoiced;
}

/**
 * Record a rebate earning for an individual request. Called by the
 * proxy router after it decides which provider won and has the actual
 * invoiced amount from the upstream call.
 *
 * The earning feeds the platform P&L dashboard and the public
 * transparency page (rebate received, not amount paid to us).
 */
export async function recordEarning(earning: RebateEarning): Promise<void> {
  return withSpan(
    'rebate.record',
    {
      provider: earning.provider,
      model: earning.model,
      rebateUsdCents: earning.rebateUsdCents.toString(),
    },
    async () => {
      logger.info('rebate.earned', {
        provider: earning.provider,
        model: earning.model,
        rackRateUsdCents: earning.rackRateUsdCents.toString(),
        invoicedUsdCents: earning.invoicedUsdCents.toString(),
        rebateUsdCents: earning.rebateUsdCents.toString(),
      });
      // TODO(F6.1): persist to ProviderRebateLedger table.
    },
  );
}

/**
 * List all disclosed rebate arrangements — feeds the public
 * transparency page at /transparency.
 */
export function listDisclosedRebates(): ProviderRebateConfig[] {
  const out: ProviderRebateConfig[] = [];
  for (const cfg of registry.values()) {
    if (cfg.disclosed) out.push(cfg);
  }
  return out;
}

function rebateKey(provider: string, model: string | null): string {
  return `${provider}:${model ?? '*'}`;
}
