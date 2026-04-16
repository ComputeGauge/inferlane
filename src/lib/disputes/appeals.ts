// Appeal workflow — second-level review of resolved disputes.
//
// Commercial build, Phase 5.4. A party that loses a dispute can
// appeal within 7 days. Appeals are reviewed by a 2-person panel
// (3-person for disputes over $10K). If the panel overturns the
// original decision, the ledger posts a compensating ADJUSTMENT
// entry that reverses the refund outcome.
//
// States:
//   PENDING             — appeal filed, awaiting reviewer assignment
//   UNDER_PANEL_REVIEW  — at least one panel reviewer has opened
//   OVERTURNED          — panel reversed the original decision
//   UPHELD              — panel affirmed the original decision
//   WITHDRAWN           — appellant withdrew before panel decided
//
// Only the first three are meaningful for money movement.

import { prisma } from '@/lib/db';
import { postLedgerEntry } from '@/lib/billing/escrow-ledger';
import type { LedgerEntry } from '@/lib/billing/escrow-ledger';
import { logger, withSpan } from '@/lib/telemetry';

const APPEAL_WINDOW_HOURS = 168;           // 7 days
const HIGH_VALUE_THRESHOLD_CENTS = BigInt(1_000_000);  // $10,000

export class AppealWindowExpiredError extends Error {
  constructor() {
    super(`Appeal window has expired (${APPEAL_WINDOW_HOURS}h after resolution)`);
  }
}

export class AlreadyAppealedError extends Error {
  constructor() {
    super('This dispute has already been appealed');
  }
}

export interface AppealInput {
  disputeCaseId: string;
  appellantUserId: string;
  appellantRole: 'BUYER' | 'OPERATOR';
  statement: string;
  newEvidenceUrls?: string[];
}

export async function fileAppeal(input: AppealInput): Promise<{ id: string }> {
  return withSpan(
    'appeal.file',
    {
      disputeCaseId: input.disputeCaseId,
      appellantRole: input.appellantRole,
    },
    async () => {
      const dispute = await prisma.disputeCase.findUnique({
        where: { id: input.disputeCaseId },
      });
      if (!dispute) throw new Error('Dispute not found');
      if (!dispute.resolvedAt) {
        throw new Error('Cannot appeal a dispute that is not yet resolved');
      }

      const ageHours = (Date.now() - dispute.resolvedAt.getTime()) / (60 * 60 * 1000);
      if (ageHours > APPEAL_WINDOW_HOURS) {
        throw new AppealWindowExpiredError();
      }

      // Ensure the appellant has standing. Buyer must own buyerUserId;
      // operator must own the NodeOperator referenced.
      if (input.appellantRole === 'BUYER' && dispute.buyerUserId !== input.appellantUserId) {
        throw new Error('Appellant is not the buyer on this dispute');
      }
      if (input.appellantRole === 'OPERATOR') {
        if (!dispute.operatorId) throw new Error('Dispute has no operator');
        const op = await prisma.nodeOperator.findUnique({
          where: { id: dispute.operatorId },
          select: { userId: true },
        });
        if (op?.userId !== input.appellantUserId) {
          throw new Error('Appellant is not the operator on this dispute');
        }
      }

      // Only one appeal per dispute.
      const existing = await prisma.disputeAppeal.findFirst({
        where: { disputeCaseId: input.disputeCaseId },
      });
      if (existing) throw new AlreadyAppealedError();

      const row = await prisma.disputeAppeal.create({
        data: {
          disputeCaseId: input.disputeCaseId,
          appellantUserId: input.appellantUserId,
          appellantRole: input.appellantRole,
          statement: input.statement,
          newEvidenceUrls: input.newEvidenceUrls ?? [],
          status: 'PENDING',
        },
      });

      logger.info('appeal.filed', {
        appealId: row.id,
        disputeCaseId: input.disputeCaseId,
        appellantRole: input.appellantRole,
        amountUsdCents: dispute.amountUsdCents.toString(),
        isHighValue: dispute.amountUsdCents >= HIGH_VALUE_THRESHOLD_CENTS,
      });

      return { id: row.id };
    },
  );
}

/**
 * Assign reviewers to a PENDING appeal. For normal disputes, 2
 * reviewers. For high-value disputes ($10K+), 3 reviewers. The
 * assignment should exclude any reviewer who decided the original
 * dispute — that exclusion is enforced here.
 */
export async function assignPanel(
  appealId: string,
  candidateReviewerIds: string[],
): Promise<{ assigned: string[]; required: number }> {
  return withSpan('appeal.assignPanel', { appealId }, async () => {
    const appeal = await prisma.disputeAppeal.findUnique({
      where: { id: appealId },
    });
    if (!appeal) throw new Error('Appeal not found');

    const original = await prisma.disputeCase.findUnique({
      where: { id: appeal.disputeCaseId },
      select: { amountUsdCents: true, decidedByUserId: true },
    });
    if (!original) throw new Error('Original dispute not found');

    const required = original.amountUsdCents >= HIGH_VALUE_THRESHOLD_CENTS ? 3 : 2;

    const eligible = candidateReviewerIds.filter(
      (id) => id !== original.decidedByUserId,
    );
    if (eligible.length < required) {
      throw new Error(
        `Need ${required} reviewers; only ${eligible.length} eligible after excluding the original decider`,
      );
    }

    const assigned = eligible.slice(0, required);

    await prisma.disputeAppeal.update({
      where: { id: appealId },
      data: {
        panelReviewers: assigned,
        status: 'UNDER_PANEL_REVIEW',
      },
    });

    return { assigned, required };
  });
}

/**
 * Decide an appeal. Only meaningful if the appeal is in the
 * UNDER_PANEL_REVIEW state. If `overturn` is true and
 * `overrideRefundCents` differs from the original refund, we post
 * a compensating ADJUSTMENT ledger entry that reverses the money
 * movement.
 */
export async function decideAppeal(params: {
  appealId: string;
  reviewerId: string;
  overturn: boolean;
  overrideRefundCents?: bigint;
  reasoning: string;
}): Promise<{ outcome: 'OVERTURNED' | 'UPHELD' }> {
  return withSpan(
    'appeal.decide',
    { appealId: params.appealId, overturn: params.overturn },
    async () => {
      const appeal = await prisma.disputeAppeal.findUnique({
        where: { id: params.appealId },
      });
      if (!appeal) throw new Error('Appeal not found');
      if (appeal.status !== 'UNDER_PANEL_REVIEW') {
        throw new Error(
          `Appeal is in status ${appeal.status}; cannot decide`,
        );
      }
      if (!appeal.panelReviewers.includes(params.reviewerId)) {
        throw new Error('Reviewer is not on the assigned panel');
      }

      const original = await prisma.disputeCase.findUnique({
        where: { id: appeal.disputeCaseId },
      });
      if (!original) throw new Error('Original dispute not found');
      if (!original.resolvedAt || original.refundCents == null) {
        throw new Error('Original dispute has no resolved refund to override');
      }

      const nextStatus = params.overturn ? 'OVERTURNED' : 'UPHELD';
      const overrideAmount = params.overrideRefundCents ?? BigInt(0);

      await prisma.$transaction(async (tx) => {
        await tx.disputeAppeal.update({
          where: { id: params.appealId },
          data: {
            status: nextStatus,
            overturned: params.overturn,
            overrideRefundCents: params.overrideRefundCents ?? null,
            decidedByUserId: params.reviewerId,
            decidedAt: new Date(),
            reasoning: params.reasoning,
          },
        });

        if (params.overturn) {
          // Compensating ADJUSTMENT: move the delta between the
          // original refund and the override. Direction depends on
          // whether the override is larger or smaller than the
          // original refund.
          const originalRefund = original.refundCents!;
          const delta = overrideAmount - originalRefund;
          if (delta !== BigInt(0)) {
            const absDelta = delta > BigInt(0) ? delta : -delta;
            // If delta > 0, buyer gets more money (more goes from
            // operator pending → buyer wallet). If delta < 0, buyer
            // refund was too generous — the operator gets the
            // difference back from buyer wallet.
            const legs =
              delta > BigInt(0)
                ? [
                    {
                      account: 'OPERATOR_PENDING' as const,
                      direction: 'DEBIT' as const,
                      amountUsdCents: absDelta,
                      subjectOperatorId: original.operatorId,
                    },
                    {
                      account: 'BUYER_WALLET' as const,
                      direction: 'CREDIT' as const,
                      amountUsdCents: absDelta,
                      subjectUserId: original.buyerUserId,
                    },
                  ]
                : [
                    {
                      account: 'BUYER_WALLET' as const,
                      direction: 'DEBIT' as const,
                      amountUsdCents: absDelta,
                      subjectUserId: original.buyerUserId,
                    },
                    {
                      account: 'OPERATOR_PENDING' as const,
                      direction: 'CREDIT' as const,
                      amountUsdCents: absDelta,
                      subjectOperatorId: original.operatorId,
                    },
                  ];
            const entry: LedgerEntry = {
              eventType: 'ADJUSTMENT',
              groupId: `appeal:${params.appealId}`,
              disputeId: appeal.disputeCaseId,
              memo: `Appeal overturn: ${params.reasoning.slice(0, 200)}`,
              approvedBy: params.reviewerId,
              legs,
            };
            await postLedgerEntry(entry, tx);
          }
        }
      });

      logger.info('appeal.decided', {
        appealId: params.appealId,
        outcome: nextStatus,
        reviewerId: params.reviewerId,
      });

      return { outcome: nextStatus };
    },
  );
}

export const APPEAL_CONSTANTS = {
  APPEAL_WINDOW_HOURS,
  HIGH_VALUE_THRESHOLD_CENTS,
} as const;
