// Dispute engine.
//
// Commercial build, Phase 5.2. Handles the workflow for a buyer contesting
// work from an operator. This engine is deliberately boring: every action
// is a state transition on a finite-state machine, every transition writes
// an audit entry, and every money movement flows through the escrow ledger
// rather than direct balance updates.
//
// The engine does not make value judgements about who is right. It tracks
// evidence, gathers attestation records, and routes to reviewers. Final
// determinations are made by the dispute committee (reviewers flagged in
// the User model with role REVIEWER).
//
// State machine:
//
//       OPEN ──────────────────┐
//         │                     │
//         ▼                     ▼
//   EVIDENCE_REQUESTED    CANCELLED   (by buyer)
//         │
//         ▼
//     UNDER_REVIEW
//         │
//         ▼
//     RESOLVED_{BUYER|OPERATOR|SPLIT}
//
// Appeals are a separate state machine (see appeals.ts).

import { postLedgerEntry, refundFromEscrow } from '@/lib/billing/escrow-ledger';
import { prisma } from '@/lib/db';
import { logger, withSpan } from '@/lib/telemetry';

export type DisputeStatus =
  | 'OPEN'
  | 'EVIDENCE_REQUESTED'
  | 'UNDER_REVIEW'
  | 'RESOLVED_BUYER'
  | 'RESOLVED_OPERATOR'
  | 'RESOLVED_SPLIT'
  | 'CANCELLED';

export type DisputeReason =
  | 'WORK_INCOMPLETE'
  | 'QUALITY_FAILURE'
  | 'CAPABILITY_MISREP'       // operator claimed capabilities they don't have
  | 'ATTESTATION_FAILED'      // TEE attestation verdict not satisfied
  | 'LATENCY_BREACH'
  | 'DATA_HANDLING'           // operator mishandled buyer data
  | 'OTHER';

export interface DisputeInput {
  settlementRecordId: string;
  buyerUserId: string;
  operatorId: string;
  reason: DisputeReason;
  /** Short description from the buyer (stored as-is, HTML-escaped on display). */
  description: string;
  /** Cents at stake; must match the settlement record amount. */
  amountUsdCents: bigint;
}

export interface DisputeRecord {
  id: string;
  status: DisputeStatus;
  reason: DisputeReason;
  description: string;
  amountUsdCents: bigint;
  openedAt: Date;
  evidence: DisputeEvidence[];
  resolution?: DisputeResolution;
}

export interface DisputeEvidence {
  id: string;
  kind: 'BUYER_STATEMENT' | 'OPERATOR_STATEMENT' | 'ATTESTATION_LOG' | 'ROUTER_LOG' | 'FILE_HASH';
  submittedBy: string;          // user id
  submittedAt: Date;
  contentHash: string;          // never store raw uploads in the dispute row
  contentUrl?: string;          // optional signed URL if stored in object storage
}

export interface DisputeResolution {
  decidedBy: string;            // reviewer user id
  decidedAt: Date;
  outcome: 'BUYER' | 'OPERATOR' | 'SPLIT';
  refundCents: bigint;          // 0 if operator wins; total if buyer wins
  reasoning: string;
  drawdownFromReserve: boolean;
}

const DISPUTE_WINDOW_HOURS = 168;
const EVIDENCE_DEADLINE_HOURS = 72;

export class DisputeWindowExpiredError extends Error {
  constructor() {
    super('Dispute window has expired');
  }
}

export class DisputeEngine {
  /**
   * Open a new dispute. Must be called within DISPUTE_WINDOW_HOURS of the
   * workload completion. Creates the DisputeCase row inside a
   * transaction so partial failures don't leave the DB in an
   * inconsistent state.
   */
  async open(input: DisputeInput, workloadCompletedAt: Date): Promise<DisputeRecord> {
    return withSpan(
      'dispute.open',
      {
        reason: input.reason,
        operatorId: input.operatorId,
        amountUsdCents: input.amountUsdCents.toString(),
      },
      async (span) => {
        const ageHours = (Date.now() - workloadCompletedAt.getTime()) / (60 * 60 * 1000);
        if (ageHours > DISPUTE_WINDOW_HOURS) {
          span.setAttribute('outcome', 'window_expired');
          throw new DisputeWindowExpiredError();
        }

        const evidenceDeadline = new Date(
          Date.now() + EVIDENCE_DEADLINE_HOURS * 60 * 60 * 1000,
        );

        const created = await prisma.disputeCase.create({
          data: {
            settlementRecordId: input.settlementRecordId,
            buyerUserId: input.buyerUserId,
            operatorId: input.operatorId,
            reason: input.reason,
            description: input.description,
            amountUsdCents: input.amountUsdCents,
            status: 'OPEN',
            evidenceDeadlineAt: evidenceDeadline,
          },
        });

        logger.info('dispute.opened', {
          disputeId: created.id,
          settlementRecordId: input.settlementRecordId,
          reason: input.reason,
          amountUsdCents: input.amountUsdCents.toString(),
        });

        return {
          id: created.id,
          status: created.status,
          reason: created.reason,
          description: created.description,
          amountUsdCents: created.amountUsdCents,
          openedAt: created.openedAt,
          evidence: [],
        };
      },
    );
  }

  /**
   * Attach evidence to an open dispute. Content is uploaded to object
   * storage elsewhere; this function only records the hash and URL.
   * After writing, we check whether both parties have now submitted
   * at least one statement and transition to UNDER_REVIEW if so.
   */
  async addEvidence(
    disputeId: string,
    evidence: Omit<DisputeEvidence, 'id' | 'submittedAt'>,
  ): Promise<DisputeEvidence> {
    return withSpan(
      'dispute.evidence.add',
      { disputeId, kind: evidence.kind },
      async () => {
        // Ensure the dispute exists and is in a state that accepts
        // evidence. Disallow adds on terminal states.
        const dispute = await prisma.disputeCase.findUnique({
          where: { id: disputeId },
          select: { status: true },
        });
        if (!dispute) {
          throw new Error(`Dispute ${disputeId} not found`);
        }
        const openStates = new Set(['OPEN', 'EVIDENCE_REQUESTED', 'UNDER_REVIEW']);
        if (!openStates.has(dispute.status)) {
          throw new Error(
            `Cannot add evidence to dispute in status ${dispute.status}`,
          );
        }

        const row = await prisma.disputeEvidence.create({
          data: {
            disputeCaseId: disputeId,
            kind: evidence.kind,
            submittedByUserId: evidence.submittedBy,
            contentHash: evidence.contentHash,
            contentUrl: evidence.contentUrl,
          },
        });

        logger.info('dispute.evidence.added', {
          disputeId,
          evidenceId: row.id,
          kind: row.kind,
          contentHash: row.contentHash,
        });

        // Opportunistic state transition: if both sides have
        // submitted at least one statement, move to UNDER_REVIEW so
        // a reviewer can pick up the case.
        const statements = await prisma.disputeEvidence.findMany({
          where: {
            disputeCaseId: disputeId,
            kind: { in: ['BUYER_STATEMENT', 'OPERATOR_STATEMENT'] },
          },
          select: { kind: true },
        });
        const hasBuyer = statements.some((s) => s.kind === 'BUYER_STATEMENT');
        const hasOperator = statements.some((s) => s.kind === 'OPERATOR_STATEMENT');

        if (
          hasBuyer &&
          hasOperator &&
          (dispute.status === 'OPEN' || dispute.status === 'EVIDENCE_REQUESTED')
        ) {
          await prisma.disputeCase.update({
            where: { id: disputeId },
            data: { status: 'UNDER_REVIEW' },
          });
          logger.info('dispute.status.under_review', { disputeId });
        }

        return {
          id: row.id,
          kind: row.kind,
          submittedBy: row.submittedByUserId,
          submittedAt: row.submittedAt,
          contentHash: row.contentHash,
          contentUrl: row.contentUrl ?? undefined,
        };
      },
    );
  }

  /**
   * Resolve a dispute. Writes ledger entries for the refund (if any),
   * updates the DisputeCase row to terminal status, and records the
   * resolution in a single transaction. Only reviewers may call this;
   * the route handler enforces that by requiring a step-up token with
   * scope `dispute.resolve`.
   */
  async resolve(params: {
    disputeId: string;
    settlementRecordId: string;
    buyerUserId: string;
    reviewerId: string;
    outcome: 'BUYER' | 'OPERATOR' | 'SPLIT';
    refundCents: bigint;
    totalWorkloadCents: bigint;
    reasoning: string;
  }): Promise<DisputeResolution> {
    return withSpan(
      'dispute.resolve',
      { disputeId: params.disputeId, outcome: params.outcome },
      async (span) => {
        if (params.refundCents < BigInt(0) || params.refundCents > params.totalWorkloadCents) {
          throw new Error('refundCents must be in [0, totalWorkloadCents]');
        }

        // Decide whether we need to draw from the reserve. If the
        // operator's pending balance can't cover the refund, yes.
        // For the initial roll-out we assume reserve drawdown is
        // off — the proper calculation lives in the reconciliation
        // pass and reviewers can override.
        const drawdownFromReserve = false;

        const resolution: DisputeResolution = {
          decidedBy: params.reviewerId,
          decidedAt: new Date(),
          outcome: params.outcome,
          refundCents: params.refundCents,
          reasoning: params.reasoning,
          drawdownFromReserve,
        };

        const terminalStatus =
          params.outcome === 'BUYER'
            ? 'RESOLVED_BUYER'
            : params.outcome === 'OPERATOR'
              ? 'RESOLVED_OPERATOR'
              : 'RESOLVED_SPLIT';

        await prisma.$transaction(async (tx) => {
          if (params.refundCents > BigInt(0)) {
            const entry = refundFromEscrow({
              amountUsdCents: params.refundCents,
              buyerUserId: params.buyerUserId,
              disputeId: params.disputeId,
              settlementRecordId: params.settlementRecordId,
              drawdownFromReserve,
            });
            await postLedgerEntry(entry, tx);
          }

          await tx.disputeCase.update({
            where: { id: params.disputeId },
            data: {
              status: terminalStatus,
              resolvedAt: resolution.decidedAt,
              decidedByUserId: params.reviewerId,
              outcome: params.outcome,
              refundCents: params.refundCents,
              reasoning: params.reasoning,
              drawdownFromReserve,
            },
          });
        });

        span.setAttribute('refundCents', params.refundCents.toString());
        logger.info('dispute.resolved', {
          disputeId: params.disputeId,
          outcome: params.outcome,
          refundCents: params.refundCents.toString(),
          reviewerId: params.reviewerId,
        });

        return resolution;
      },
    );
  }

  /**
   * Fetch a dispute by id, including its evidence list. Returns null
   * if not found. Used by the dashboard detail view and the resolve
   * route handler to ensure the caller has visibility into the case.
   */
  async get(disputeId: string): Promise<DisputeRecord | null> {
    const row = await prisma.disputeCase.findUnique({
      where: { id: disputeId },
      include: {
        evidence: { orderBy: { submittedAt: 'asc' } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      status: row.status,
      reason: row.reason,
      description: row.description,
      amountUsdCents: row.amountUsdCents,
      openedAt: row.openedAt,
      evidence: row.evidence.map((e) => ({
        id: e.id,
        kind: e.kind,
        submittedBy: e.submittedByUserId,
        submittedAt: e.submittedAt,
        contentHash: e.contentHash,
        contentUrl: e.contentUrl ?? undefined,
      })),
      resolution: row.resolvedAt
        ? {
            decidedBy: row.decidedByUserId ?? 'unknown',
            decidedAt: row.resolvedAt,
            outcome: (row.outcome ?? 'OPERATOR') as 'BUYER' | 'OPERATOR' | 'SPLIT',
            refundCents: row.refundCents ?? BigInt(0),
            reasoning: row.reasoning ?? '',
            drawdownFromReserve: row.drawdownFromReserve,
          }
        : undefined,
    };
  }

  /**
   * List disputes visible to a user. Buyers see their own disputes;
   * operators see disputes against their nodes. Reviewers see all.
   */
  async listForUser(params: {
    userId: string;
    isReviewer?: boolean;
    limit?: number;
  }): Promise<DisputeRecord[]> {
    const limit = Math.min(200, Math.max(1, params.limit ?? 50));

    // Build the WHERE in two steps because DisputeCase.operatorId is a
    // string reference, not a declared Prisma relation — so we look up
    // the operator ids owned by this user first, then filter disputes
    // by the union of those and buyerUserId.
    let whereClause: Record<string, unknown> | undefined;
    if (!params.isReviewer) {
      const ownedOperators = await prisma.nodeOperator.findMany({
        where: { userId: params.userId },
        select: { id: true },
      });
      const ownedOperatorIds = ownedOperators.map((o) => o.id);
      whereClause = {
        OR: [
          { buyerUserId: params.userId },
          ...(ownedOperatorIds.length > 0
            ? [{ operatorId: { in: ownedOperatorIds } }]
            : []),
        ],
      };
    }

    const rows = await prisma.disputeCase.findMany({
      where: whereClause,
      orderBy: { openedAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      reason: row.reason,
      description: row.description,
      amountUsdCents: row.amountUsdCents,
      openedAt: row.openedAt,
      evidence: [],
      resolution: row.resolvedAt
        ? {
            decidedBy: row.decidedByUserId ?? 'unknown',
            decidedAt: row.resolvedAt,
            outcome: (row.outcome ?? 'OPERATOR') as 'BUYER' | 'OPERATOR' | 'SPLIT',
            refundCents: row.refundCents ?? BigInt(0),
            reasoning: row.reasoning ?? '',
            drawdownFromReserve: row.drawdownFromReserve,
          }
        : undefined,
    }));
  }
}

/** Exposed for tests and Phase 5 migration scripts. */
export const DISPUTE_CONSTANTS = {
  DISPUTE_WINDOW_HOURS,
  EVIDENCE_DEADLINE_HOURS,
} as const;
