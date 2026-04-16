// Fireblocks treasury adapter (stub).
//
// Commercial build, Phase F4 primary custodian. Wraps Fireblocks'
// vault + transaction APIs in the same AdapterResult shape as the
// Stripe Treasury adapter (src/lib/treasury/adapters/stripe-treasury.ts)
// so the treasury service layer can swap providers without code
// churn.
//
// What this file does NOT do:
//   - Pull in @fireblocks/fireblocks-sdk as a dependency. That
//     package is ~50MB of bundled types; we keep it out of the
//     next.js build until we actually contract with Fireblocks.
//   - Hold raw API credentials. All credentials come from env at
//     request time (FIREBLOCKS_API_KEY, FIREBLOCKS_PRIVATE_KEY).
//
// What it does:
//   - Ships the typed contract so callers can code against it
//   - Returns stub results with clear error messages until
//     FIREBLOCKS_ENABLED=1 and credentials are in place
//   - Exposes checkReadiness() for the admin dashboard
//
// When the contract signs and we flip the env var:
//   1. npm i @fireblocks/fireblocks-sdk
//   2. Replace the stub functions with real SDK calls
//   3. Unit + integration tests against Fireblocks sandbox
//   4. Swap Stripe Treasury primary for Fireblocks primary in
//      the treasury service router

import { logger, withSpan } from '@/lib/telemetry';

export interface FireblocksAdapterResult<T> {
  ok: boolean;
  data: T | null;
  stub: boolean;
  error: string | null;
}

export interface FireblocksVaultSummary {
  vaultAccountId: string;
  name: string;
  usdCentsBalance: bigint;
  usdtMicroBalance: bigint;
}

export interface FireblocksPayoutRequest {
  operatorId: string;
  assetId: 'USDT_ERC20' | 'USDT_TRX' | 'USDT_SOL' | 'USDC' | 'USD';
  amount: bigint;        // In the asset's base unit (micro for USDT, cents for USD)
  destinationAddress: string;
  externalId: string;    // idempotency + reconciliation
  description: string;
}

export interface FireblocksPayoutResult {
  txId: string;
  status: 'SUBMITTED' | 'CONFIRMED' | 'FAILED' | 'PENDING_REVIEW';
  sourceVaultAccountId: string;
  blockchainTxHash: string | null;
}

function isEnabled(): boolean {
  return (
    process.env.FIREBLOCKS_ENABLED === '1' ||
    process.env.FIREBLOCKS_ENABLED === 'true'
  );
}

function stubResult<T>(reason: string): FireblocksAdapterResult<T> {
  return {
    ok: false,
    data: null,
    stub: true,
    error: `fireblocks adapter is in stub mode: ${reason}`,
  };
}

function okResult<T>(data: T): FireblocksAdapterResult<T> {
  return { ok: true, data, stub: false, error: null };
}

function errorResult<T>(error: unknown): FireblocksAdapterResult<T> {
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, data: null, stub: false, error: message };
}

/**
 * Look up the platform's default USDT vault account. In the real
 * implementation we pin this to FIREBLOCKS_VAULT_ACCOUNT_ID from
 * env. The stub returns a synthetic summary so dashboards can
 * render empty-state without throwing.
 */
export async function getVaultSummary(): Promise<
  FireblocksAdapterResult<FireblocksVaultSummary>
> {
  return withSpan('fireblocks.getVault', {}, async () => {
    if (!isEnabled()) {
      return stubResult('FIREBLOCKS_ENABLED is not set');
    }

    const vaultId = process.env.FIREBLOCKS_VAULT_ACCOUNT_ID;
    const apiKey = process.env.FIREBLOCKS_API_KEY;
    const privateKey = process.env.FIREBLOCKS_PRIVATE_KEY;

    if (!vaultId || !apiKey || !privateKey) {
      return stubResult(
        'Missing FIREBLOCKS_VAULT_ACCOUNT_ID / FIREBLOCKS_API_KEY / FIREBLOCKS_PRIVATE_KEY',
      );
    }

    try {
      // TODO(phase-F4.1): Import @fireblocks/fireblocks-sdk and call
      //   const sdk = new FireblocksSDK(privateKey, apiKey);
      //   const v = await sdk.getVaultAccount(vaultId);
      //   return okResult({ vaultAccountId: v.id, name: v.name, ... });
      return errorResult<FireblocksVaultSummary>(
        new Error('Fireblocks SDK not yet installed — npm i @fireblocks/fireblocks-sdk'),
      );
    } catch (err) {
      logger.warn('fireblocks.getVault.error', {
        error: err instanceof Error ? err.message : String(err),
      });
      return errorResult<FireblocksVaultSummary>(err);
    }
  });
}

/**
 * Submit a payout from the platform vault to an operator's
 * destination address. Idempotent by externalId. In production
 * this is used for operator payouts in jurisdictions Stripe
 * Connect doesn't serve.
 */
export async function submitFireblocksPayout(
  request: FireblocksPayoutRequest,
): Promise<FireblocksAdapterResult<FireblocksPayoutResult>> {
  return withSpan(
    'fireblocks.payout.submit',
    {
      operatorId: request.operatorId,
      assetId: request.assetId,
      amount: request.amount.toString(),
    },
    async () => {
      if (!isEnabled()) {
        return stubResult('FIREBLOCKS_ENABLED is not set');
      }
      if (request.amount <= BigInt(0)) {
        return errorResult<FireblocksPayoutResult>(
          new Error('amount must be positive'),
        );
      }

      try {
        // TODO(phase-F4.1):
        //   const sdk = new FireblocksSDK(privateKey, apiKey);
        //   const tx = await sdk.createTransaction({
        //     assetId: request.assetId,
        //     source: { type: 'VAULT_ACCOUNT', id: vaultId },
        //     destination: { type: 'ONE_TIME_ADDRESS', oneTimeAddress: { address: request.destinationAddress } },
        //     amount: String(request.amount),
        //     externalTxId: request.externalId,
        //     note: request.description,
        //   });
        //   return okResult({ txId: tx.id, status: 'SUBMITTED', ... });
        return errorResult<FireblocksPayoutResult>(
          new Error('Fireblocks SDK not yet installed'),
        );
      } catch (err) {
        return errorResult<FireblocksPayoutResult>(err);
      }
    },
  );
}

/**
 * Admin readiness check — used by /dashboard/admin/treasury health
 * card. Reports which env is set and whether the vault is
 * reachable. Never throws.
 */
export async function checkFireblocksReadiness(): Promise<{
  enabled: boolean;
  envComplete: boolean;
  vaultReachable: boolean;
  issues: string[];
}> {
  const issues: string[] = [];
  if (!isEnabled()) issues.push('FIREBLOCKS_ENABLED is not set');
  if (!process.env.FIREBLOCKS_API_KEY) issues.push('FIREBLOCKS_API_KEY is not set');
  if (!process.env.FIREBLOCKS_PRIVATE_KEY) issues.push('FIREBLOCKS_PRIVATE_KEY is not set');
  if (!process.env.FIREBLOCKS_VAULT_ACCOUNT_ID) {
    issues.push('FIREBLOCKS_VAULT_ACCOUNT_ID is not set');
  }

  let vaultReachable = false;
  if (issues.length === 0) {
    const summary = await getVaultSummary();
    if (summary.ok) vaultReachable = true;
    else if (summary.error) issues.push(summary.error);
  }

  return {
    enabled: isEnabled(),
    envComplete: issues.length === 0,
    vaultReachable,
    issues,
  };
}
