// Buyer wallet service.
//
// Commercial build, Phase F1. Strategy doc: commercial/FLOAT_MODEL.md.
//
// Every buyer has a single USD-denominated wallet that holds prepaid
// compute credits. All workload charges are drawn from this wallet.
// Deposits come from:
//   - Stripe card / ACH
//   - Tether (USDT on Plasma / Arbitrum / Solana, converted 1:1)
//   - Crypto on-ramp partners (future)
//
// The wallet balance is the Tether-style float. Every dollar sitting
// here is earning us Treasury yield via the treasury service, while
// the buyer pays nothing extra (the price they see for a workload
// already bakes our margin in).
//
// Wallet transactions flow through the double-entry ledger
// (src/lib/billing/escrow-ledger.ts) so the money trail is auditable.
// This module is the user-facing surface; the ledger is the truth.

import {
  LedgerAccount,
  LedgerEntry,
  postLedgerEntry,
} from '@/lib/billing/escrow-ledger';
import { prisma } from '@/lib/db';
import { logger, withSpan } from '@/lib/telemetry';

export type WalletTxSource =
  | 'STRIPE_CARD'
  | 'STRIPE_ACH'
  | 'TETHER_USDT'
  | 'MANUAL_CREDIT';

export interface WalletBalance {
  userId: string;
  availableUsdCents: bigint;
  reservedUsdCents: bigint;
  totalUsdCents: bigint;
  lastUpdatedAt: Date;
}

export interface DepositParams {
  userId: string;
  amountUsdCents: bigint;
  source: WalletTxSource;
  externalId: string;             // Stripe charge id, Tether tx hash, etc.
  idempotencyKey: string;
}

export class InsufficientFundsError extends Error {
  constructor(needed: bigint, available: bigint) {
    super(
      `Insufficient wallet balance: needed ${needed.toString()} cents, available ${available.toString()} cents`,
    );
  }
}

/**
 * Record a deposit to a buyer's wallet. Posts a BUYER_DEPOSIT ledger
 * entry: debit operational cash, credit the user's wallet. Idempotent
 * by (source, externalId).
 */
export async function recordDeposit(params: DepositParams): Promise<WalletBalance> {
  return withSpan(
    'wallet.deposit',
    {
      userId: params.userId,
      source: params.source,
      amountUsdCents: params.amountUsdCents.toString(),
    },
    async () => {
      if (params.amountUsdCents <= BigInt(0)) {
        throw new Error('Deposit amount must be positive');
      }

      const entry: LedgerEntry = {
        eventType: 'BUYER_DEPOSIT',
        groupId: `dep:${params.source}:${params.externalId}`,
        memo: `Deposit via ${params.source}: ${params.externalId}`,
        legs: [
          {
            account: 'OPERATIONAL_CASH' as LedgerAccount,  // fundraising-time concern: this is the operational receipt
            amountUsdCents: params.amountUsdCents,
            direction: 'DEBIT',
          },
          {
            account: 'BUYER_WALLET',
            amountUsdCents: params.amountUsdCents,
            direction: 'CREDIT',
            subjectUserId: params.userId,
          },
        ],
      };
      await postLedgerEntry(entry);

      logger.info('wallet.deposit.recorded', {
        userId: params.userId,
        source: params.source,
        amountUsdCents: params.amountUsdCents.toString(),
      });

      // Stub: real balance comes from a projection over ledger_legs.
      return {
        userId: params.userId,
        availableUsdCents: params.amountUsdCents,
        reservedUsdCents: BigInt(0),
        totalUsdCents: params.amountUsdCents,
        lastUpdatedAt: new Date(),
      };
    },
  );
}

/**
 * Commit funds from a wallet into escrow when a workload is dispatched.
 * Posts a WORKLOAD_COMMIT ledger entry: debit wallet, credit escrow.
 * Throws InsufficientFundsError if the wallet can't cover the charge.
 */
export async function commitFromWallet(params: {
  userId: string;
  amountUsdCents: bigint;
  workloadId: string;
}): Promise<void> {
  return withSpan(
    'wallet.commit',
    { userId: params.userId, workloadId: params.workloadId },
    async () => {
      // Serialize concurrent commits per user via a Postgres
      // advisory lock. Without this, two concurrent workloads for
      // the same user can both pass the balance check and commit,
      // producing a negative wallet balance (red-team finding H-1).
      //
      // The lock is keyed on a 64-bit hash of the userId. Advisory
      // locks are held for the duration of the transaction and
      // auto-release on commit or rollback.
      const lockKey = userIdToLockKey(params.userId);

      await prisma.$transaction(async (tx) => {
        // Parameterized — even though lockKey is hash-derived and
        // contains only digits, using $queryRaw with a template
        // literal keeps it impossible to drift into injection.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(${BigInt(lockKey)})`;

        // Balance projection — now safe because no other commit
        // for this user can land until we release the lock.
        const legs = await tx.ledgerLeg.findMany({
          where: {
            subjectUserId: params.userId,
            account: { in: ['BUYER_WALLET'] },
          },
          select: { direction: true, amountUsdCents: true },
        });
        let credits = BigInt(0);
        let debits = BigInt(0);
        for (const leg of legs) {
          if (leg.direction === 'CREDIT') credits += leg.amountUsdCents;
          else debits += leg.amountUsdCents;
        }
        const available = credits - debits;

        if (available < params.amountUsdCents) {
          throw new InsufficientFundsError(params.amountUsdCents, available);
        }

        const entry: LedgerEntry = {
          eventType: 'WORKLOAD_COMMIT',
          groupId: `wc:${params.workloadId}`,
          memo: `Workload commit ${params.workloadId}`,
          legs: [
            {
              account: 'BUYER_WALLET',
              amountUsdCents: params.amountUsdCents,
              direction: 'DEBIT',
              subjectUserId: params.userId,
            },
            {
              account: 'ESCROW_HELD',
              amountUsdCents: params.amountUsdCents,
              direction: 'CREDIT',
              subjectUserId: params.userId,
            },
          ],
        };
        // Post inside the same transaction so both the lock and the
        // write happen atomically.
        await postLedgerEntry(entry, tx);
      });
    },
  );
}

/**
 * Convert a userId to a stable 64-bit signed integer suitable for
 * Postgres `pg_advisory_xact_lock`. Uses the low 63 bits of a
 * SHA-256 hash so different userIds rarely collide.
 */
function userIdToLockKey(userId: string): string {
  const { createHash } = require('crypto') as typeof import('crypto');
  const hash = createHash('sha256').update(userId, 'utf8').digest();
  // Read the first 8 bytes as BigInt, mask to 63 bits (Postgres
  // bigint is signed; we avoid the sign bit).
  const asBig =
    (BigInt(hash.readUInt32BE(0)) << BigInt(32)) +
    BigInt(hash.readUInt32BE(4));
  const masked = asBig & ((BigInt(1) << BigInt(63)) - BigInt(1));
  return masked.toString();
}

/**
 * Get the current wallet balance.
 *
 * Queries the ledger_legs projection: sum of BUYER_WALLET credits
 * minus BUYER_WALLET debits for the user. Then sum of ESCROW_HELD
 * credits minus debits (with this user as subject) for the reserved
 * portion.
 *
 * This is the authoritative balance. The `buyer_wallets` row with
 * the cached counters is a hint for UI speed; the projection here is
 * what settlement trusts.
 *
 * Note: Prisma's LedgerLeg table uses BigInt for amounts, but the
 * `groupBy` / `aggregate` API can't sum BigInt directly, so we fetch
 * the legs and reduce in JS. At the volumes we care about (≤ a few
 * thousand legs per user) this is fine. If it grows, migrate to a
 * materialised view on the database side.
 */
export async function getBalance(userId: string): Promise<WalletBalance> {
  return withSpan('wallet.getBalance', { userId }, async () => {
    const legs = await prisma.ledgerLeg.findMany({
      where: {
        subjectUserId: userId,
        account: { in: ['BUYER_WALLET', 'ESCROW_HELD'] },
      },
      select: {
        account: true,
        direction: true,
        amountUsdCents: true,
      },
    });

    let walletDebits = BigInt(0);
    let walletCredits = BigInt(0);
    let escrowDebits = BigInt(0);
    let escrowCredits = BigInt(0);

    for (const leg of legs) {
      if (leg.account === 'BUYER_WALLET') {
        if (leg.direction === 'DEBIT') walletDebits += leg.amountUsdCents;
        else walletCredits += leg.amountUsdCents;
      } else if (leg.account === 'ESCROW_HELD') {
        if (leg.direction === 'DEBIT') escrowDebits += leg.amountUsdCents;
        else escrowCredits += leg.amountUsdCents;
      }
    }

    // BUYER_WALLET is a liability account: credits increase, debits decrease.
    const availableUsdCents = walletCredits - walletDebits;
    // ESCROW_HELD is also a liability account: while funds are in escrow
    // for this user, the net credit balance is the "reserved" portion.
    const reservedUsdCents = escrowCredits - escrowDebits;
    const totalUsdCents = availableUsdCents + reservedUsdCents;

    return {
      userId,
      availableUsdCents,
      reservedUsdCents,
      totalUsdCents,
      lastUpdatedAt: new Date(),
    };
  });
}

/**
 * Check whether a wallet has at least `requiredCents` available. Used
 * as the pre-flight before calling commitFromWallet() so we don't
 * post a ledger entry that would overdraw.
 */
export async function hasSufficientFunds(
  userId: string,
  requiredCents: bigint,
): Promise<boolean> {
  const balance = await getBalance(userId);
  return balance.availableUsdCents >= requiredCents;
}
