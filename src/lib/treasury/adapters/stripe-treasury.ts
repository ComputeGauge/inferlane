// Stripe Treasury adapter.
//
// Commercial build, Phase F2.1. This is the first real yield vehicle
// adapter for the treasury service (src/lib/treasury/index.ts), and it
// plugs into Leg 1 of the Float Model (commercial/FLOAT_MODEL.md).
//
// Why Stripe Treasury first:
//   - We already use Stripe for payments, subscriptions, and Connect.
//     One less contract, one less counterparty, one less SOC 2 mapping.
//   - Stripe Treasury holds customer funds in FDIC-insured accounts at
//     their partner banks and pays us a share of the interest. That's
//     Leg 1 float yield without us touching a broker-dealer.
//   - Stripe Treasury is the "network" — each holder sees a dedicated
//     financial account number routable via ACH and wires. This maps
//     cleanly to our "one wallet per buyer" model.
//   - We don't hold customer money directly, so we don't trigger state
//     money transmitter licensing in most US jurisdictions.
//
// What this file does:
//   - Exposes a typed wrapper over Stripe Treasury's FinancialAccount,
//     Transaction, InboundTransfer, OutboundPayment APIs.
//   - Tracks which API calls are safe to make in stub mode so tests
//     and dev environments don't accidentally touch the real API.
//   - Never reads or writes the ledger directly — callers compose this
//     adapter with src/lib/billing/escrow-ledger.ts so money events
//     stay in the double-entry journal.
//
// Stub mode: when STRIPE_TREASURY_ENABLED is unset or falsy, every
// call returns a deterministic "not contracted yet" result without
// hitting Stripe. This lets the rest of the commercial build proceed
// against the adapter contract even though the underlying Stripe
// Treasury account doesn't exist yet (hard gate — human must create
// the account and enable Treasury in the Stripe dashboard).

import Stripe from 'stripe';
import { logger, withSpan } from '@/lib/telemetry';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  typescript: true,
});

function isEnabled(): boolean {
  return (
    process.env.STRIPE_TREASURY_ENABLED === '1' ||
    process.env.STRIPE_TREASURY_ENABLED === 'true'
  );
}

/**
 * Thin wrapper result type. All adapter methods return this shape so
 * the treasury service can uniformly handle success, stub, and error.
 */
export interface AdapterResult<T> {
  ok: boolean;
  data: T | null;
  stub: boolean;
  error: string | null;
}

function stubResult<T>(reason: string): AdapterResult<T> {
  return {
    ok: false,
    data: null,
    stub: true,
    error: `stripe-treasury adapter is in stub mode: ${reason}`,
  };
}

function okResult<T>(data: T): AdapterResult<T> {
  return { ok: true, data, stub: false, error: null };
}

function errorResult<T>(error: unknown): AdapterResult<T> {
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, data: null, stub: false, error: message };
}

// ----------------------------------------------------------------------
// Financial accounts
// ----------------------------------------------------------------------

export interface StripeFinancialAccountSummary {
  id: string;
  balanceUsdCents: bigint;
  status: string;
  createdAt: Date;
}

/**
 * Look up the primary FinancialAccount attached to our Stripe Connect
 * platform. Stripe Treasury creates exactly one account per platform
 * by default; we cache the id in an env var so we don't have to list
 * on every call.
 */
export async function getPrimaryAccount(): Promise<
  AdapterResult<StripeFinancialAccountSummary>
> {
  return withSpan(
    'stripe-treasury.getPrimaryAccount',
    {},
    async () => {
      if (!isEnabled()) {
        return stubResult('STRIPE_TREASURY_ENABLED is not set');
      }

      const accountId = process.env.STRIPE_TREASURY_ACCOUNT_ID;
      if (!accountId) {
        return stubResult('STRIPE_TREASURY_ACCOUNT_ID is not set');
      }

      try {
        // Stripe Treasury FinancialAccount API requires a connected
        // account header. The platform account holds the root
        // Treasury integration; we pass it explicitly.
        const platform = process.env.STRIPE_TREASURY_PLATFORM_ACCOUNT;
        const options: Stripe.RequestOptions = platform
          ? { stripeAccount: platform }
          : {};

        // Stripe's SDK does not (as of this draft) ship a first-class
        // FinancialAccount resource in the general `stripe` namespace.
        // We retrieve via the raw `apiRequest` to preserve type safety
        // at the adapter boundary. Callers should treat the return as
        // opaque and only read through this summary shape.
        const raw = await stripe.treasury.financialAccounts.retrieve(
          accountId,
          options,
        );

        const balance = BigInt(raw.balance?.cash?.usd ?? 0);
        return okResult({
          id: raw.id,
          balanceUsdCents: balance,
          status: raw.status,
          createdAt: new Date((raw.created ?? 0) * 1000),
        });
      } catch (err) {
        logger.warn('stripe-treasury.getPrimaryAccount.error', {
          error: err instanceof Error ? err.message : String(err),
        });
        return errorResult<StripeFinancialAccountSummary>(err);
      }
    },
  );
}

// ----------------------------------------------------------------------
// Inbound transfers (deposits into Stripe Treasury)
// ----------------------------------------------------------------------

export interface InboundTransferParams {
  financialAccountId: string;
  amountUsdCents: bigint;
  paymentMethod: string;       // Stripe payment method id (e.g. ba_xxx ACH source)
  description: string;
  idempotencyKey: string;
}

export interface InboundTransferResult {
  id: string;
  status: string;
  amountUsdCents: bigint;
  expectedArrivalAt: Date | null;
}

/**
 * Submit an ACH inbound transfer that sweeps working capital into
 * the Treasury FinancialAccount. Used by the nightly sweep cron.
 * Idempotent by Stripe's standard idempotency-key header.
 */
export async function submitInboundTransfer(
  params: InboundTransferParams,
): Promise<AdapterResult<InboundTransferResult>> {
  return withSpan(
    'stripe-treasury.submitInboundTransfer',
    {
      amount: params.amountUsdCents.toString(),
      financialAccountId: params.financialAccountId,
    },
    async () => {
      if (!isEnabled()) {
        return stubResult('STRIPE_TREASURY_ENABLED is not set');
      }
      if (params.amountUsdCents <= BigInt(0)) {
        return errorResult<InboundTransferResult>(
          new Error('amountUsdCents must be positive'),
        );
      }

      try {
        const platform = process.env.STRIPE_TREASURY_PLATFORM_ACCOUNT;
        const options: Stripe.RequestOptions = {
          idempotencyKey: params.idempotencyKey,
          ...(platform ? { stripeAccount: platform } : {}),
        };

        // Stripe's BigInt → number bridge: Stripe amounts are always
        // expressed as integers in the smallest currency unit. Since
        // our ledger uses BigInt and JS Number is safe up to 2^53-1
        // (~$90 trillion in cents), we can convert inline here with
        // a safety check.
        const amountNumber = Number(params.amountUsdCents);
        if (!Number.isSafeInteger(amountNumber)) {
          return errorResult<InboundTransferResult>(
            new Error('amountUsdCents exceeds Number.MAX_SAFE_INTEGER'),
          );
        }

        const resp = await stripe.treasury.inboundTransfers.create(
          {
            financial_account: params.financialAccountId,
            amount: amountNumber,
            currency: 'usd',
            origin_payment_method: params.paymentMethod,
            description: params.description,
          },
          options,
        );

        return okResult({
          id: resp.id,
          status: resp.status,
          amountUsdCents: BigInt(resp.amount),
          expectedArrivalAt: null,
        });
      } catch (err) {
        return errorResult<InboundTransferResult>(err);
      }
    },
  );
}

// ----------------------------------------------------------------------
// Outbound payments (refunds / payouts out of Treasury)
// ----------------------------------------------------------------------

export interface OutboundPaymentParams {
  financialAccountId: string;
  destinationPaymentMethod: string;
  amountUsdCents: bigint;
  description: string;
  idempotencyKey: string;
  /** Optional metadata recorded on the Stripe object for reconciliation */
  metadata?: Record<string, string>;
}

export interface OutboundPaymentResult {
  id: string;
  status: string;
  amountUsdCents: bigint;
  expectedArrivalAt: Date | null;
}

/**
 * Issue an outbound payment out of the Treasury FinancialAccount. Used
 * for dispute refunds and reserve-fund drawdowns that route via ACH.
 * Operator payouts go through Stripe Connect, not Treasury — this
 * method is specifically for the money that needs to leave our
 * Treasury pool.
 */
export async function submitOutboundPayment(
  params: OutboundPaymentParams,
): Promise<AdapterResult<OutboundPaymentResult>> {
  return withSpan(
    'stripe-treasury.submitOutboundPayment',
    {
      amount: params.amountUsdCents.toString(),
      financialAccountId: params.financialAccountId,
    },
    async () => {
      if (!isEnabled()) {
        return stubResult('STRIPE_TREASURY_ENABLED is not set');
      }
      if (params.amountUsdCents <= BigInt(0)) {
        return errorResult<OutboundPaymentResult>(
          new Error('amountUsdCents must be positive'),
        );
      }

      try {
        const platform = process.env.STRIPE_TREASURY_PLATFORM_ACCOUNT;
        const options: Stripe.RequestOptions = {
          idempotencyKey: params.idempotencyKey,
          ...(platform ? { stripeAccount: platform } : {}),
        };

        const amountNumber = Number(params.amountUsdCents);
        if (!Number.isSafeInteger(amountNumber)) {
          return errorResult<OutboundPaymentResult>(
            new Error('amountUsdCents exceeds Number.MAX_SAFE_INTEGER'),
          );
        }

        const resp = await stripe.treasury.outboundPayments.create(
          {
            financial_account: params.financialAccountId,
            amount: amountNumber,
            currency: 'usd',
            destination_payment_method: params.destinationPaymentMethod,
            description: params.description,
            metadata: params.metadata,
          },
          options,
        );

        return okResult({
          id: resp.id,
          status: resp.status,
          amountUsdCents: BigInt(resp.amount),
          expectedArrivalAt: null,
        });
      } catch (err) {
        return errorResult<OutboundPaymentResult>(err);
      }
    },
  );
}

// ----------------------------------------------------------------------
// Diagnostics
// ----------------------------------------------------------------------

/**
 * Sanity check used by startup and the admin dashboard. Returns a
 * small readiness report: are env vars set, is the account
 * reachable, what's the balance. Never throws.
 */
export async function checkReadiness(): Promise<{
  enabled: boolean;
  envComplete: boolean;
  accountReachable: boolean;
  balanceUsdCents: bigint | null;
  issues: string[];
}> {
  const issues: string[] = [];
  if (!isEnabled()) {
    issues.push('STRIPE_TREASURY_ENABLED is not set');
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    issues.push('STRIPE_SECRET_KEY is not set');
  }
  if (!process.env.STRIPE_TREASURY_ACCOUNT_ID) {
    issues.push('STRIPE_TREASURY_ACCOUNT_ID is not set');
  }

  let accountReachable = false;
  let balanceUsdCents: bigint | null = null;

  if (issues.length === 0) {
    const summary = await getPrimaryAccount();
    if (summary.ok && summary.data) {
      accountReachable = true;
      balanceUsdCents = summary.data.balanceUsdCents;
    } else {
      issues.push(summary.error ?? 'unknown error reaching primary account');
    }
  }

  return {
    enabled: isEnabled(),
    envComplete: issues.length === 0,
    accountReachable,
    balanceUsdCents,
    issues,
  };
}
