// Escrow ledger — double-entry bookkeeping for the marketplace.
//
// Commercial build, Phase 5.1. This is the authoritative money layer for
// settlement. Every dollar flowing through InferLane is modelled as a set
// of debits and credits across five internal accounts:
//
//   BUYER_WALLET         — buyer has deposited but not yet committed
//   ESCROW_HELD          — committed to a workload, not yet released
//   PLATFORM_FEE         — our 10% platform fee
//   RESERVE_FUND         — our 3% reserve fund contribution
//   OPERATOR_PENDING     — seller earnings awaiting payout
//
// Every state change produces a LedgerEntry row with matching debit and
// credit legs. The invariant `SUM(debits) - SUM(credits) = 0` is enforced
// per-transaction; a job nightly re-asserts it globally. If the invariant
// ever fails, the marketplace freezes until it's reconciled.
//
// Why this instead of just updating balances? Because the IRS, auditors,
// disputes, and every future forensic question needs an append-only
// trail. Balance fields on user rows lie. Journals don't.

import { prisma } from '@/lib/db';
import { logger, withSpan } from '@/lib/telemetry';
import type { Prisma } from '@/generated/prisma/client';

export type LedgerAccount =
  | 'BUYER_WALLET'       // liability to buyer
  | 'ESCROW_HELD'        // liability held pending workload completion
  | 'PLATFORM_FEE'       // revenue account
  | 'RESERVE_FUND'       // equity account reserved for disputes
  | 'OPERATOR_PENDING'   // liability to operator
  | 'OPERATOR_PAID_OUT'  // contra account tracking paid operator dollars
  | 'DISPUTE_REFUND'     // expense account for dispute losses
  | 'OPERATIONAL_CASH';  // asset account — cash actually held at the bank / partner

export type LedgerEventType =
  | 'BUYER_DEPOSIT'        // buyer tops up their wallet
  | 'WORKLOAD_COMMIT'      // funds move from wallet → escrow at routing time
  | 'WORKLOAD_COMPLETE'    // escrow → platform fee + reserve + operator pending
  | 'DISPUTE_OPEN'         // escrow release paused
  | 'DISPUTE_RESOLVE_BUYER'// escrow → buyer wallet (refund)
  | 'DISPUTE_RESOLVE_OPERATOR' // escrow → operator pending
  | 'OPERATOR_PAYOUT'      // operator pending → paid out (Stripe Connect)
  | 'RESERVE_DRAWDOWN'     // reserve → dispute refund
  | 'ADJUSTMENT';          // manual correction (must include memo + approver)

export interface LedgerLeg {
  account: LedgerAccount;
  /** Positive = debit, negative = credit (or vice versa; see `direction`). */
  amountUsdCents: bigint;
  direction: 'DEBIT' | 'CREDIT';
  subjectUserId?: string;        // buyer or operator user id this leg belongs to
  subjectOperatorId?: string;
}

export interface LedgerEntry {
  id?: string;
  eventType: LedgerEventType;
  /** Group id so both legs of the same event are queryable together. */
  groupId: string;
  /** Workload / settlement record this entry is attached to, if any. */
  settlementRecordId?: string;
  disputeId?: string;
  memo?: string;
  approvedBy?: string;             // for ADJUSTMENT events
  legs: LedgerLeg[];
  createdAt?: Date;
}

export class LedgerInvariantError extends Error {
  readonly imbalance: bigint;
  constructor(imbalance: bigint, entry: LedgerEntry) {
    super(
      `Ledger entry ${entry.eventType} (${entry.groupId}) has imbalance ${imbalance.toString()} cents`,
    );
    this.imbalance = imbalance;
  }
}

/**
 * Thrown when the ledger is frozen via the LEDGER_FREEZE env var.
 * The incident runbook escalates here during a suspected money-layer
 * corruption event: set LEDGER_FREEZE=1 in production and every
 * write path throws until the freeze is lifted.
 */
export class LedgerFrozenError extends Error {
  constructor() {
    super(
      'Ledger is frozen (LEDGER_FREEZE env var is set). ' +
        'Contact oncall to investigate before unfreezing.',
    );
  }
}

function isFrozen(): boolean {
  const v = process.env.LEDGER_FREEZE;
  return v === '1' || v === 'true';
}

/**
 * Post a ledger entry. Enforces the balanced-journal invariant inside a
 * database transaction. Never mutate ledger rows after insertion —
 * disputes and corrections are separate entries. Returns the created
 * entry id so callers can correlate.
 *
 * The entire post is wrapped in a single Prisma `$transaction` so the
 * header row and all its legs either commit together or not at all. A
 * failed invariant check throws before any write reaches the DB.
 */
export async function postLedgerEntry(
  entry: LedgerEntry,
  tx?: Prisma.TransactionClient,
): Promise<string> {
  return withSpan(
    'ledger.post',
    { eventType: entry.eventType, legCount: entry.legs.length },
    async (span) => {
      if (isFrozen()) {
        // Special-case: allow ADJUSTMENT events with an approver so
        // oncall can post compensating entries while the freeze is
        // in place. Everything else is rejected.
        if (entry.eventType !== 'ADJUSTMENT' || !entry.approvedBy) {
          span.setAttribute('frozen', true);
          throw new LedgerFrozenError();
        }
      }

      const imbalance = checkBalance(entry);
      if (imbalance !== BigInt(0)) {
        span.setAttribute('imbalance', imbalance.toString());
        throw new LedgerInvariantError(imbalance, entry);
      }

      // If caller provided an outer transaction client, use it so the
      // ledger write is atomic with whatever else they're doing (e.g.
      // a dispute status change alongside a refund). Otherwise open our
      // own short transaction scoped to just the ledger write.
      const runner = async (client: Prisma.TransactionClient) => {
        const header = await client.ledgerEntry.create({
          data: {
            eventType: entry.eventType,
            groupId: entry.groupId,
            settlementRecordId: entry.settlementRecordId,
            disputeCaseId: entry.disputeId,
            memo: entry.memo,
            approvedByUserId: entry.approvedBy,
          },
        });

        await client.ledgerLeg.createMany({
          data: entry.legs.map((leg) => ({
            entryId: header.id,
            account: leg.account,
            direction: leg.direction,
            amountUsdCents: leg.amountUsdCents,
            subjectUserId: leg.subjectUserId,
            subjectOperatorId: leg.subjectOperatorId,
          })),
        });

        return header.id;
      };

      const id = tx ? await runner(tx) : await prisma.$transaction(runner);

      logger.info('ledger.entry.persisted', {
        id,
        eventType: entry.eventType,
        groupId: entry.groupId,
        settlementRecordId: entry.settlementRecordId,
        legs: entry.legs.length,
      });
      span.setAttribute('ledgerEntryId', id);
      return id;
    },
  );
}

/**
 * Sum the current net balance for a single account, optionally scoped
 * to a subject (userId or operatorId). Net = credits - debits for
 * liability and equity accounts, debits - credits for asset accounts.
 * Callers tell us which direction they expect so we don't hard-code
 * account-type knowledge here.
 */
export async function getAccountBalance(params: {
  account: LedgerAccount;
  subjectUserId?: string;
  subjectOperatorId?: string;
  /** Which direction counts as positive for this account. */
  positiveDirection: 'DEBIT' | 'CREDIT';
}): Promise<bigint> {
  const legs = await prisma.ledgerLeg.findMany({
    where: {
      account: params.account,
      subjectUserId: params.subjectUserId,
      subjectOperatorId: params.subjectOperatorId,
    },
    select: { direction: true, amountUsdCents: true },
  });

  let positive = BigInt(0);
  let negative = BigInt(0);
  for (const leg of legs) {
    if (leg.direction === params.positiveDirection) {
      positive += leg.amountUsdCents;
    } else {
      negative += leg.amountUsdCents;
    }
  }
  return positive - negative;
}

/**
 * Reconcile the whole ledger. Walks every entry header, sums its legs,
 * and reports any entries where debits !== credits. This should always
 * return an empty array in a healthy system; it runs as a nightly cron.
 * Returns the list of violating entry ids.
 */
export async function reconcileLedger(): Promise<
  Array<{ entryId: string; imbalance: bigint }>
> {
  return withSpan('ledger.reconcile', {}, async (span) => {
    const entries = await prisma.ledgerEntry.findMany({
      select: {
        id: true,
        legs: { select: { direction: true, amountUsdCents: true } },
      },
    });

    const violations: Array<{ entryId: string; imbalance: bigint }> = [];
    for (const e of entries) {
      let debits = BigInt(0);
      let credits = BigInt(0);
      for (const leg of e.legs) {
        if (leg.direction === 'DEBIT') debits += leg.amountUsdCents;
        else credits += leg.amountUsdCents;
      }
      const imbalance = debits - credits;
      if (imbalance !== BigInt(0)) {
        violations.push({ entryId: e.id, imbalance });
      }
    }

    span.setAttribute('violationCount', violations.length);
    if (violations.length > 0) {
      // JSON-stringify the sample because the telemetry facade only
      // accepts scalar attribute values — structured objects are not
      // allowed in logs (by design, for SIEM parsability).
      logger.error('ledger.reconcile.violations', {
        count: violations.length,
        sampleJson: JSON.stringify(
          violations.slice(0, 5).map((v) => ({
            entryId: v.entryId,
            imbalance: v.imbalance.toString(),
          })),
        ),
      });
    } else {
      logger.info('ledger.reconcile.clean', { entriesChecked: entries.length });
    }

    return violations;
  });
}

/**
 * Split tiers. The default STANDARD tier is 87/10/3 — operators get
 * 87%, platform keeps 10%, reserve fund gets 3%. The ATTESTED tier
 * is 92/5/3 — reserved for operators who pass a fresh VERIFIED
 * attestation AND accept full dispute liability. The ATTESTED tier
 * is pulled from commercial/competitors/darkbloom.md action #5:
 * match Darkbloom's generosity for high-trust operators without
 * undercutting our default economics.
 */
export type SplitTier = 'STANDARD' | 'ATTESTED';

export interface SplitBasisPoints {
  /** Operator share in basis points (10000 = 100%). */
  operatorBps: number;
  /** Platform fee share in basis points. */
  platformBps: number;
  /** Reserve fund share in basis points. */
  reserveBps: number;
}

export const SPLIT_TIERS: Record<SplitTier, SplitBasisPoints> = {
  STANDARD: { operatorBps: 8700, platformBps: 1000, reserveBps: 300 },
  ATTESTED: { operatorBps: 9200, platformBps:  500, reserveBps: 300 },
};

/**
 * Compute the standard leg set for a completed workload. Defaults to
 * the STANDARD split (87/10/3); pass `tier: 'ATTESTED'` for the
 * high-trust split (92/5/3). The tier decision lives outside this
 * function — the router decides whether the operator qualifies.
 *
 * Rounds platform and reserve splits down; any remainder goes to the
 * operator so we never overcharge the buyer by a cent, regardless of
 * tier.
 *
 * Tests in `src/lib/__tests__/escrow-ledger.test.ts` exercise both
 * tiers including the pathological "7 cents" case where rounding
 * collapses all platform + reserve to zero.
 */
export function splitWorkloadPayment(params: {
  totalUsdCents: bigint;
  buyerUserId: string;
  operatorId: string;
  settlementRecordId: string;
  /** Split tier. Defaults to STANDARD if omitted. */
  tier?: SplitTier;
}): LedgerEntry {
  const total = params.totalUsdCents;
  if (total <= BigInt(0)) throw new Error('Workload total must be positive');

  const tier = params.tier ?? 'STANDARD';
  const basis = SPLIT_TIERS[tier];
  if (
    basis.operatorBps + basis.platformBps + basis.reserveBps !==
    10_000
  ) {
    throw new Error(`Split basis points for tier ${tier} do not sum to 10000`);
  }

  const platformFee = (total * BigInt(basis.platformBps)) / BigInt(10_000);
  const reserve = (total * BigInt(basis.reserveBps)) / BigInt(10_000);
  const operator = total - platformFee - reserve;

  return {
    eventType: 'WORKLOAD_COMPLETE',
    groupId: `wc:${params.settlementRecordId}`,
    settlementRecordId: params.settlementRecordId,
    memo: tier === 'ATTESTED' ? 'Attested-operator split (92/5/3)' : undefined,
    legs: [
      {
        account: 'ESCROW_HELD',
        amountUsdCents: total,
        direction: 'DEBIT',
        subjectUserId: params.buyerUserId,
      },
      {
        account: 'OPERATOR_PENDING',
        amountUsdCents: operator,
        direction: 'CREDIT',
        subjectOperatorId: params.operatorId,
      },
      {
        account: 'PLATFORM_FEE',
        amountUsdCents: platformFee,
        direction: 'CREDIT',
      },
      {
        account: 'RESERVE_FUND',
        amountUsdCents: reserve,
        direction: 'CREDIT',
      },
    ],
  };
}

/**
 * Compute the leg set for a dispute won by the buyer: funds return from
 * escrow to buyer wallet. If the operator's pending balance can't cover a
 * retroactive clawback (because work already shipped), the reserve fund
 * absorbs the shortfall.
 */
export function refundFromEscrow(params: {
  amountUsdCents: bigint;
  buyerUserId: string;
  disputeId: string;
  settlementRecordId: string;
  drawdownFromReserve?: boolean;
}): LedgerEntry {
  const legs: LedgerLeg[] = [
    {
      account: 'ESCROW_HELD',
      amountUsdCents: params.amountUsdCents,
      direction: 'DEBIT',
    },
    {
      account: 'BUYER_WALLET',
      amountUsdCents: params.amountUsdCents,
      direction: 'CREDIT',
      subjectUserId: params.buyerUserId,
    },
  ];

  if (params.drawdownFromReserve) {
    legs.push(
      {
        account: 'RESERVE_FUND',
        amountUsdCents: params.amountUsdCents,
        direction: 'DEBIT',
      },
      {
        account: 'DISPUTE_REFUND',
        amountUsdCents: params.amountUsdCents,
        direction: 'CREDIT',
      },
    );
  }

  return {
    eventType: 'DISPUTE_RESOLVE_BUYER',
    groupId: `dr:${params.disputeId}`,
    settlementRecordId: params.settlementRecordId,
    disputeId: params.disputeId,
    memo: 'Buyer-side dispute refund',
    legs,
  };
}

/**
 * Balance check. Sum of debit amounts must equal sum of credit amounts.
 * Internal function — exported for tests only.
 */
export function checkBalance(entry: LedgerEntry): bigint {
  let debits = BigInt(0);
  let credits = BigInt(0);
  for (const leg of entry.legs) {
    if (leg.amountUsdCents < BigInt(0)) {
      throw new Error('Leg amounts must be non-negative; use direction to signal sign');
    }
    if (leg.direction === 'DEBIT') debits += leg.amountUsdCents;
    else credits += leg.amountUsdCents;
  }
  return debits - credits;
}
