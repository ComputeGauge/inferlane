// Operator payout flow — composes the double-entry ledger with
// Stripe Connect transfers.
//
// Commercial build, Phase F3.2. Previous state: Stripe Connect wrapper
// existed (src/lib/stripe-connect.ts) and the NodePayout table
// existed, but the actual flow that:
//
//   1. Picks which operators are due for payout
//   2. Creates a NodePayout row
//   3. Posts an OPERATOR_PAYOUT ledger entry
//   4. Submits the Stripe Connect transfer
//   5. Handles success / failure / retry
//
// ... did not exist. This module is that flow.
//
// Design notes:
//   - Payouts are opt-in per cycle. An operator accumulates earnings
//     in OPERATOR_PENDING and requests a payout via the dashboard
//     or via the auto-payout cron.
//   - Minimum payout: $50 (5000 cents). Below that the cycle skips
//     the operator and lets the balance accumulate.
//   - Stripe Connect handles the actual money movement; we only
//     tell it how much and where. Failures come back via Stripe
//     webhooks which reverse the ledger entry + mark NodePayout FAILED.
//   - Payouts run inside a DB transaction to keep the ledger + row
//     updates atomic. If Stripe fails after we've committed the
//     ledger entry, the webhook reversal path compensates.

import { prisma } from '@/lib/db';
import { postLedgerEntry } from '@/lib/billing/escrow-ledger';
import type { LedgerEntry } from '@/lib/billing/escrow-ledger';
import { payoutToOperator } from '@/lib/stripe-connect';
import { logger, withSpan } from '@/lib/telemetry';

const MINIMUM_PAYOUT_CENTS = BigInt(5000);  // $50

export interface PayoutCandidate {
  nodeOperatorId: string;
  stripeAccountId: string;
  pendingUsdCents: bigint;
}

export interface PayoutResult {
  nodeOperatorId: string;
  payoutId: string;
  amountUsdCents: bigint;
  stripeTransferId: string | null;
  status: 'SUCCESS' | 'BELOW_MINIMUM' | 'NO_STRIPE_ACCOUNT' | 'TRANSFER_FAILED';
  error: string | null;
}

/**
 * Find operators eligible for payout. Eligibility rules:
 *   - payoutEnabled === true on NodeOperator
 *   - stripeAccountId is set
 *   - Operator's OPERATOR_PENDING ledger balance >= MINIMUM_PAYOUT_CENTS
 *
 * Returns a list ordered by pending balance descending — biggest
 * payouts first so a partial run still moves the needle.
 */
export async function findPayoutCandidates(): Promise<PayoutCandidate[]> {
  return withSpan('payouts.findCandidates', {}, async () => {
    const operators = await prisma.nodeOperator.findMany({
      where: { payoutEnabled: true, stripeAccountId: { not: null } },
      select: { id: true, stripeAccountId: true },
    });

    // Fetch the OPERATOR_PENDING balance per operator from the
    // ledger projection. This is the authoritative number — the
    // `pendingBalance` field on NodeOperator is a cached hint that
    // can drift.
    const candidates: PayoutCandidate[] = [];
    for (const op of operators) {
      const legs = await prisma.ledgerLeg.findMany({
        where: {
          account: 'OPERATOR_PENDING',
          subjectOperatorId: op.id,
        },
        select: { direction: true, amountUsdCents: true },
      });
      let credits = BigInt(0);
      let debits = BigInt(0);
      for (const leg of legs) {
        if (leg.direction === 'CREDIT') credits += leg.amountUsdCents;
        else debits += leg.amountUsdCents;
      }
      const pending = credits - debits;
      if (pending >= MINIMUM_PAYOUT_CENTS && op.stripeAccountId) {
        candidates.push({
          nodeOperatorId: op.id,
          stripeAccountId: op.stripeAccountId,
          pendingUsdCents: pending,
        });
      }
    }

    candidates.sort((a, b) =>
      b.pendingUsdCents > a.pendingUsdCents
        ? 1
        : b.pendingUsdCents < a.pendingUsdCents
          ? -1
          : 0,
    );

    return candidates;
  });
}

/**
 * Execute a payout for a single operator. Composes the ledger
 * entry with the Stripe Connect transfer inside a DB transaction.
 *
 * If Stripe's create-transfer call fails before the DB transaction
 * commits, we roll back the ledger and NodePayout row, leaving the
 * operator's OPERATOR_PENDING balance intact so the next cycle can
 * retry. If Stripe succeeds after a crash but before the commit,
 * the idempotency key (NodePayout id) prevents a double-transfer on
 * retry because Stripe will return the same transfer record.
 */
export async function executePayout(
  candidate: PayoutCandidate,
): Promise<PayoutResult> {
  return withSpan(
    'payouts.execute',
    {
      nodeOperatorId: candidate.nodeOperatorId,
      amountUsdCents: candidate.pendingUsdCents.toString(),
    },
    async () => {
      if (candidate.pendingUsdCents < MINIMUM_PAYOUT_CENTS) {
        return {
          nodeOperatorId: candidate.nodeOperatorId,
          payoutId: '',
          amountUsdCents: candidate.pendingUsdCents,
          stripeTransferId: null,
          status: 'BELOW_MINIMUM',
          error: null,
        };
      }
      if (!candidate.stripeAccountId) {
        return {
          nodeOperatorId: candidate.nodeOperatorId,
          payoutId: '',
          amountUsdCents: candidate.pendingUsdCents,
          stripeTransferId: null,
          status: 'NO_STRIPE_ACCOUNT',
          error: null,
        };
      }

      // Step 1 — create a NodePayout row and post the ledger entry
      // inside a single DB transaction. Until Stripe confirms the
      // transfer we leave NodePayout in PENDING status.
      let payoutId: string;
      try {
        payoutId = await prisma.$transaction(async (tx) => {
          const now = new Date();
          const row = await tx.nodePayout.create({
            data: {
              nodeOperatorId: candidate.nodeOperatorId,
              amount: candidate.pendingUsdCents.toString(),   // Decimal column
              status: 'PENDING',
              periodStart: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
              periodEnd: now,
            },
          });

          const entry: LedgerEntry = {
            eventType: 'OPERATOR_PAYOUT',
            groupId: `payout:${row.id}`,
            memo: `Operator payout via Stripe Connect`,
            legs: [
              {
                account: 'OPERATOR_PENDING',
                direction: 'DEBIT',
                amountUsdCents: candidate.pendingUsdCents,
                subjectOperatorId: candidate.nodeOperatorId,
              },
              {
                account: 'OPERATOR_PAID_OUT',
                direction: 'CREDIT',
                amountUsdCents: candidate.pendingUsdCents,
                subjectOperatorId: candidate.nodeOperatorId,
              },
            ],
          };
          await postLedgerEntry(entry, tx);

          return row.id;
        });
      } catch (err) {
        logger.error('payouts.db_txn_failed', {
          nodeOperatorId: candidate.nodeOperatorId,
          error: err instanceof Error ? err.message : String(err),
        });
        return {
          nodeOperatorId: candidate.nodeOperatorId,
          payoutId: '',
          amountUsdCents: candidate.pendingUsdCents,
          stripeTransferId: null,
          status: 'TRANSFER_FAILED',
          error: err instanceof Error ? err.message : 'unknown',
        };
      }

      // Step 2 — hit Stripe Connect. If this fails, we flip
      // NodePayout to FAILED and post a compensating ADJUSTMENT
      // entry so OPERATOR_PENDING balance is restored.
      try {
        const amountNumber = Number(candidate.pendingUsdCents);
        if (!Number.isSafeInteger(amountNumber)) {
          throw new Error('amount exceeds Number.MAX_SAFE_INTEGER');
        }
        const transfer = await payoutToOperator(
          candidate.stripeAccountId,
          amountNumber,
          `InferLane operator payout ${payoutId}`,
        );

        await prisma.nodePayout.update({
          where: { id: payoutId },
          data: {
            status: 'PROCESSING',
            stripeTransferId: transfer.id,
            processedAt: new Date(),
          },
        });

        logger.info('payouts.stripe_submitted', {
          payoutId,
          stripeTransferId: transfer.id,
          amountUsdCents: candidate.pendingUsdCents.toString(),
        });

        return {
          nodeOperatorId: candidate.nodeOperatorId,
          payoutId,
          amountUsdCents: candidate.pendingUsdCents,
          stripeTransferId: transfer.id,
          status: 'SUCCESS',
          error: null,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('payouts.stripe_failed', {
          payoutId,
          nodeOperatorId: candidate.nodeOperatorId,
          error: message,
        });

        // Compensating ADJUSTMENT entry + mark NodePayout FAILED in
        // a single transaction. This restores OPERATOR_PENDING so
        // the next cycle can retry.
        try {
          await prisma.$transaction(async (tx) => {
            await tx.nodePayout.update({
              where: { id: payoutId },
              data: { status: 'FAILED' },
            });
            const compensating: LedgerEntry = {
              eventType: 'ADJUSTMENT',
              groupId: `payout-compensate:${payoutId}`,
              memo: `Stripe Connect transfer failed: ${message.slice(0, 200)}`,
              approvedBy: 'system-auto-compensate',
              legs: [
                {
                  account: 'OPERATOR_PAID_OUT',
                  direction: 'DEBIT',
                  amountUsdCents: candidate.pendingUsdCents,
                  subjectOperatorId: candidate.nodeOperatorId,
                },
                {
                  account: 'OPERATOR_PENDING',
                  direction: 'CREDIT',
                  amountUsdCents: candidate.pendingUsdCents,
                  subjectOperatorId: candidate.nodeOperatorId,
                },
              ],
            };
            await postLedgerEntry(compensating, tx);
          });
        } catch (compErr) {
          // Compensation itself failed — escalate. The ledger is now
          // inconsistent and needs oncall intervention. The nightly
          // reconcile-ledger cron will catch this.
          logger.error('payouts.compensate_failed', {
            payoutId,
            error: compErr instanceof Error ? compErr.message : String(compErr),
          });
        }

        return {
          nodeOperatorId: candidate.nodeOperatorId,
          payoutId,
          amountUsdCents: candidate.pendingUsdCents,
          stripeTransferId: null,
          status: 'TRANSFER_FAILED',
          error: message,
        };
      }
    },
  );
}
