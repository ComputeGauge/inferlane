// Solana payout adapter.
//
// Commercial build, Phase F3.3. Third payout rail alongside Stripe
// Connect (src/lib/stripe-connect.ts) and the Tether/USDT custodian
// path (src/lib/tether/index.ts). Pulled into the queue from the
// Darkbloom competitor memo — they pay operators in SOL on-chain,
// which is simpler than either of our two rails and reaches
// jurisdictions Stripe Connect and Fireblocks don't.
//
// Why ship the surface now:
//   - We can verify the contract shape against the rest of the
//     payout orchestrator BEFORE picking a custodian
//   - Integration tests can exercise the stub path
//   - Our commercial roadmap can track this as F3.3 rather than a
//     nebulous "someday" item
//
// Custodian choice (when we activate this):
//   Primary:   Coinbase Custody or Anchorage (qualified custodian,
//              federal charter, USD peg for reporting)
//   Secondary: Fireblocks (they already cover USDT; adding SOL is
//              a single network enablement on their side)
//
// USD accounting: we price workloads in USD cents and convert to SOL
// at payout time using a reference oracle price pinned from the
// custodian's quote. The oracle spread is absorbed by the operational
// cash account so the ledger never records a partial payout.

import { logger, withSpan } from '@/lib/telemetry';

export interface SolanaPayoutParams {
  nodeOperatorId: string;
  toAddress: string;
  usdCents: bigint;
  /** Idempotency key; Solana payouts are not idempotent natively. */
  idempotencyKey: string;
  /** Travel Rule originator info if required by jurisdiction. */
  travelRule?: {
    originatorName: string;
    originatorCountry: string;
  };
}

export interface SolanaPayoutResult {
  ok: boolean;
  signature: string | null;
  solAmount: number | null;       // floating; informational only
  usdCentsActual: bigint;
  oracleUsdPerSol: number | null;
  error: string | null;
}

/**
 * Screen a Solana address + chain combination against our custodian
 * partner's sanctions / denied-party filter. Stub today; same contract
 * as the Tether facade's `screenAddress`.
 */
export async function screenSolanaAddress(
  address: string,
): Promise<{ clear: boolean; reason?: string }> {
  return withSpan(
    'solana-payout.screen',
    { addressPrefix: address.slice(0, 8) },
    async () => {
      // Real implementation hits the custodian partner's compliance
      // endpoint. For the stub we succeed unless the address looks
      // syntactically broken.
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
        return { clear: false, reason: 'Address is not base58-encoded' };
      }
      return { clear: true };
    },
  );
}

/**
 * Submit an SOL payout to the custodian. Stub mode (default) logs the
 * intent and returns a simulated result so the rest of the payout
 * orchestrator can run end-to-end in dev/staging. Real mode (activated
 * by SOLANA_PAYOUT_ENABLED=1 + partner credentials) hits the
 * custodian's REST or gRPC API.
 */
export async function submitSolanaPayout(
  params: SolanaPayoutParams,
): Promise<SolanaPayoutResult> {
  return withSpan(
    'solana-payout.submit',
    {
      nodeOperatorId: params.nodeOperatorId,
      usdCents: params.usdCents.toString(),
    },
    async () => {
      if (params.usdCents <= BigInt(0)) {
        return {
          ok: false,
          signature: null,
          solAmount: null,
          usdCentsActual: params.usdCents,
          oracleUsdPerSol: null,
          error: 'usdCents must be positive',
        };
      }

      // Screen first. Failed screening is a hard rejection.
      const screen = await screenSolanaAddress(params.toAddress);
      if (!screen.clear) {
        return {
          ok: false,
          signature: null,
          solAmount: null,
          usdCentsActual: params.usdCents,
          oracleUsdPerSol: null,
          error: `Screening blocked: ${screen.reason ?? 'unknown'}`,
        };
      }

      if (!isEnabled()) {
        logger.info('solana-payout.stub', {
          nodeOperatorId: params.nodeOperatorId,
          usdCents: params.usdCents.toString(),
          toAddressPrefix: params.toAddress.slice(0, 8),
          idempotencyKey: params.idempotencyKey,
        });
        return {
          ok: false,
          signature: null,
          solAmount: null,
          usdCentsActual: params.usdCents,
          oracleUsdPerSol: null,
          error: 'Solana payout adapter is in stub mode (SOLANA_PAYOUT_ENABLED unset)',
        };
      }

      // Real custodian call would go here. We keep the shape so the
      // integration point is obvious: quote the oracle, submit the
      // transfer, capture the signature, record the quoted rate.
      return {
        ok: false,
        signature: null,
        solAmount: null,
        usdCentsActual: params.usdCents,
        oracleUsdPerSol: null,
        error: 'Solana payout partner adapter not yet wired (Phase F3.3)',
      };
    },
  );
}

function isEnabled(): boolean {
  return (
    process.env.SOLANA_PAYOUT_ENABLED === '1' ||
    process.env.SOLANA_PAYOUT_ENABLED === 'true'
  );
}
