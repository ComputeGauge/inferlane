// Tether (USDT) payment facade.
//
// Commercial build, Phase F4. Strategy doc: commercial/FLOAT_MODEL.md
// Section "Tether integration".
//
// Three reasons InferLane wants USDT rails:
//   1. Operator payouts in jurisdictions Stripe Connect does not serve.
//      USDT is accepted in ~195 countries; Stripe Connect works in ~50.
//   2. Enterprise settlement from crypto-native buyers who hold
//      treasuries in stables — removes a conversion step.
//   3. Part of the 3% reserve fund held in USDT for 24/7 dispute refund
//      liquidity, rest in Treasuries for yield.
//
// Chains we care about (in order of preference):
//   1. Plasma — Tether's own L1. Gasless USDT transfers, subsidized by
//      Tether. Highest-leverage for retail deposits and outbound payouts.
//   2. Arbitrum — L2, low fees, broad exchange support.
//   3. Tron — highest USDT liquidity globally but centralised governance.
//   4. Solana — fast, low-fee, strong retail traction.
//   5. Ethereum mainnet — fallback for institutional counterparties.
//
// IMPORTANT: We do NOT hold USDT in our own hot wallets or run our own
// validators. All custody is through a licensed partner (e.g., Fireblocks,
// BitGo, Anchorage, or Tether's own merchant API). This module is the
// facade over the partner so we can swap without changing call sites.
//
// Hard gates before going live with USDT:
//   - MSB registration with FinCEN (US).
//   - Money Transmitter Licenses in states where required (~40 US states).
//   - Custodian partner contract signed.
//   - OFAC screening wired into deposit + withdrawal paths.
//   - Travel Rule compliance for transfers >$3,000 (US) or €1,000 (EU).
//
// This file ships the interface and the types; adapters land in
// src/lib/tether/adapters/ during Phase F4 proper.

import { logger, withSpan } from '@/lib/telemetry';

export type UsdtChain =
  | 'PLASMA'
  | 'ARBITRUM'
  | 'TRON'
  | 'SOLANA'
  | 'ETHEREUM';

export interface UsdtDeposit {
  /** Partner-assigned deposit id for idempotency */
  externalId: string;
  /** Chain the deposit arrived on */
  chain: UsdtChain;
  /** On-chain transaction hash */
  txHash: string;
  /** USDT amount in micro-units (1 USDT = 1_000_000) */
  amountMicroUsdt: bigint;
  /** Sender address, if available */
  fromAddress: string | null;
  /** When the transaction was confirmed on-chain */
  confirmedAt: Date;
  /** Number of confirmations at the time of notification */
  confirmations: number;
}

export interface UsdtPayoutRequest {
  /** Internal operator id */
  operatorId: string;
  /** Chain to send on (operator's preference) */
  chain: UsdtChain;
  /** Operator's destination address, validated by the partner */
  toAddress: string;
  /** Amount in micro-USDT */
  amountMicroUsdt: bigint;
  /** Idempotency key so we can safely retry */
  idempotencyKey: string;
  /** Travel Rule originator info, if required */
  travelRule?: {
    originatorName: string;
    originatorCountry: string;
  };
}

export interface UsdtPayoutResult {
  partnerPayoutId: string;
  chain: UsdtChain;
  status: 'SUBMITTED' | 'CONFIRMED' | 'FAILED';
  txHash: string | null;
  error: string | null;
}

/**
 * 1 USDT (on-chain) is 1_000_000 micro units. A US cent is ~0.01 USDT
 * ≈ 10_000 micro. Keep the conversion explicit here so downstream
 * code can't drift — there are 1,000,000 micro-USDT per USDT and
 * 100 cents per USD, so 1 cent = 10,000 micro-USDT when we peg
 * USDT:USD at 1.
 *
 * We treat USDT as USD 1:1 in the ledger and record any slippage as a
 * separate line item in OPERATIONAL_CASH so audit trails reconcile.
 */
export const MICRO_USDT_PER_CENT = BigInt(10_000);

export function centsToMicroUsdt(cents: bigint): bigint {
  return cents * MICRO_USDT_PER_CENT;
}

export function microUsdtToCents(micro: bigint): bigint {
  return micro / MICRO_USDT_PER_CENT;
}

/**
 * Screen an address + chain combination against the partner's OFAC and
 * sanctions filter. Must pass before we credit a deposit or submit a
 * payout. Stub today; Phase F4.1 wires real partner call.
 */
export async function screenAddress(params: {
  address: string;
  chain: UsdtChain;
  direction: 'INBOUND' | 'OUTBOUND';
}): Promise<{ clear: boolean; reason?: string }> {
  return withSpan(
    'tether.screen',
    { chain: params.chain, direction: params.direction },
    async () => {
      // TODO(F4.1): hit partner's screening endpoint
      logger.info('tether.screen.stub', {
        address: params.address.slice(0, 8) + '…',
        chain: params.chain,
        direction: params.direction,
      });
      return { clear: true };
    },
  );
}

/**
 * Submit a USDT payout through the custodian partner. Returns the
 * partner's payout id so we can track it to settlement. Stub today.
 */
export async function submitPayout(
  request: UsdtPayoutRequest,
): Promise<UsdtPayoutResult> {
  return withSpan(
    'tether.payout.submit',
    {
      operatorId: request.operatorId,
      chain: request.chain,
      amountMicroUsdt: request.amountMicroUsdt.toString(),
    },
    async () => {
      // Screen before submitting.
      const screen = await screenAddress({
        address: request.toAddress,
        chain: request.chain,
        direction: 'OUTBOUND',
      });
      if (!screen.clear) {
        return {
          partnerPayoutId: '',
          chain: request.chain,
          status: 'FAILED',
          txHash: null,
          error: `Screening blocked payout: ${screen.reason ?? 'unknown'}`,
        };
      }

      // TODO(F4.1): real partner call.
      logger.info('tether.payout.stub', {
        operatorId: request.operatorId,
        chain: request.chain,
        idempotencyKey: request.idempotencyKey,
      });
      return {
        partnerPayoutId: '',
        chain: request.chain,
        status: 'FAILED',
        txHash: null,
        error: 'Tether payout adapter not yet implemented (F4.1)',
      };
    },
  );
}

/**
 * Handle a deposit notification from the partner webhook. Idempotent
 * by externalId. Credits the buyer's wallet through the normal
 * wallet service.
 */
export async function handleDepositWebhook(
  deposit: UsdtDeposit,
  buyerUserId: string,
): Promise<{ credited: boolean; reason?: string }> {
  return withSpan(
    'tether.deposit.webhook',
    { chain: deposit.chain, externalId: deposit.externalId },
    async () => {
      // Require at least 3 confirmations for all chains to limit replay risk.
      // Plasma finalises in seconds; other chains vary.
      if (deposit.confirmations < 3) {
        return { credited: false, reason: 'awaiting_confirmations' };
      }

      if (deposit.fromAddress) {
        const screen = await screenAddress({
          address: deposit.fromAddress,
          chain: deposit.chain,
          direction: 'INBOUND',
        });
        if (!screen.clear) {
          logger.warn('tether.deposit.blocked', {
            reason: screen.reason,
            externalId: deposit.externalId,
          });
          return { credited: false, reason: 'screening_block' };
        }
      }

      // TODO(F4.2): call recordDeposit() from buyer-wallet once the
      // wallet service has a real-balance projection wired up. For now
      // we log the intent so an operator can reconcile manually.
      logger.info('tether.deposit.intent', {
        buyerUserId,
        chain: deposit.chain,
        externalId: deposit.externalId,
        amountMicroUsdt: deposit.amountMicroUsdt.toString(),
      });

      return { credited: false, reason: 'adapter_pending' };
    },
  );
}
