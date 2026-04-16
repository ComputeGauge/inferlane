// Treasury management — how InferLane earns yield on held balances.
//
// Commercial build, Phase F2. Strategy doc: commercial/FLOAT_MODEL.md.
//
// InferLane holds three pools of customer and platform funds:
//   1. Buyer wallet balances       (prepaid compute credits)
//   2. Operator pending balances   (work completed, not yet paid out)
//   3. Reserve fund                (3% of every workload; dispute pool)
//
// Each dollar sitting in any of these pools is potential float yield.
// This module is the facade the rest of the app uses to:
//   - Ask "what is our total float right now?"
//   - Record deposits and withdrawals into the yield vehicle
//   - Compute accrued yield for reconciliation
//   - Trigger a sweep to a licensed custodian (Stripe Treasury, a
//     broker-dealer sweep, or similar)
//
// Important: we do NOT hold customer funds in our own bank accounts
// ourselves. That would require money transmitter licenses in most US
// states and equivalent elsewhere. The licensed path is to route funds
// through a partner (Stripe Treasury, Modern Treasury, Mercury Treasury,
// or an FDIC-insured sweep) and capture the interest share negotiated
// with that partner.
//
// This module abstracts the partner so we can swap between them or use
// multiple in parallel without changing call sites.

import { logger, withSpan } from '@/lib/telemetry';

export type TreasuryVehicle =
  | 'STRIPE_TREASURY'      // Stripe-managed FDIC sweep
  | 'MODERN_TREASURY'       // Modern Treasury routed sweep
  | 'BROKER_DEALER_SWEEP'   // licensed broker-dealer sweep
  | 'USDT_RESERVE'          // stablecoin holdings (via licensed processor)
  | 'OPERATIONAL_CASH';     // unprotected working capital (non-customer)

export type TreasuryPool =
  | 'BUYER_WALLETS'
  | 'OPERATOR_PENDING'
  | 'RESERVE_FUND';

export interface TreasurySnapshot {
  vehicle: TreasuryVehicle;
  pool: TreasuryPool;
  balanceUsdCents: bigint;
  /** 1-day trailing yield rate, used to estimate accrual. */
  apyBps: number;
  /** Seconds since this snapshot was fetched from the partner. */
  ageSeconds: number;
}

export interface TreasuryFloat {
  totalUsdCents: bigint;
  byPool: Record<TreasuryPool, bigint>;
  byVehicle: Record<TreasuryVehicle, bigint>;
  snapshots: TreasurySnapshot[];
  estimatedAnnualYieldUsdCents: bigint;
}

/**
 * Compute the current float across all pools and vehicles. Called by the
 * internal dashboard and by the nightly reconciliation job.
 *
 * Stub implementation: sums zero until the partner adapters land. The
 * contract is stable so Phase F2.1 can plug in Stripe Treasury without
 * churning call sites.
 */
export async function getCurrentFloat(): Promise<TreasuryFloat> {
  return withSpan('treasury.current_float', {}, async () => {
    // TODO(F2.1): call Stripe Treasury / Modern Treasury adapters and
    // populate real balances. Today we return a zeroed shape so
    // downstream dashboards can render empty state.
    const snapshots: TreasurySnapshot[] = [];

    const byPool: Record<TreasuryPool, bigint> = {
      BUYER_WALLETS: BigInt(0),
      OPERATOR_PENDING: BigInt(0),
      RESERVE_FUND: BigInt(0),
    };
    const byVehicle: Record<TreasuryVehicle, bigint> = {
      STRIPE_TREASURY: BigInt(0),
      MODERN_TREASURY: BigInt(0),
      BROKER_DEALER_SWEEP: BigInt(0),
      USDT_RESERVE: BigInt(0),
      OPERATIONAL_CASH: BigInt(0),
    };

    return {
      totalUsdCents: BigInt(0),
      byPool,
      byVehicle,
      snapshots,
      estimatedAnnualYieldUsdCents: BigInt(0),
    };
  });
}

/**
 * Estimate annual yield on a balance at a given APY (in bps).
 * 450 bps = 4.50% APY. Purely local math; no partner call.
 */
export function estimateAnnualYieldUsdCents(
  balanceUsdCents: bigint,
  apyBps: number,
): bigint {
  if (balanceUsdCents <= BigInt(0) || apyBps <= 0) return BigInt(0);
  // balance * apy / 10000
  return (balanceUsdCents * BigInt(apyBps)) / BigInt(10000);
}

/**
 * Sweep idle working capital into the yield vehicle. Called daily by a
 * cron. Stub: logs the intent and returns. Phase F2.1 replaces this
 * with Stripe Treasury outbound payment API.
 */
export async function sweepToYieldVehicle(params: {
  fromPool: TreasuryPool;
  vehicle: TreasuryVehicle;
  amountUsdCents: bigint;
  reason: string;
}): Promise<{ swept: boolean; message: string }> {
  return withSpan(
    'treasury.sweep',
    { pool: params.fromPool, vehicle: params.vehicle },
    async () => {
      if (params.amountUsdCents <= BigInt(0)) {
        return { swept: false, message: 'Nothing to sweep' };
      }
      logger.info('treasury.sweep.intent', {
        fromPool: params.fromPool,
        vehicle: params.vehicle,
        amountUsdCents: params.amountUsdCents.toString(),
        reason: params.reason,
      });
      return { swept: false, message: 'Adapter not yet implemented (F2.1)' };
    },
  );
}
