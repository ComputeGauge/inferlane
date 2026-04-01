// ---------------------------------------------------------------------------
// Settlement Lane Engine (Stream U)
// ---------------------------------------------------------------------------
// Determines which settlement lane a compute entity gets, executes
// settlement at the appropriate timing, and handles disputes.
//
// Three lanes:
//   INSTANT  — 0h settlement, 4h clawback window (verified nodes, partners)
//   STANDARD — T+1 daily batch (established entities)
//   DEFERRED — T+7 to T+30 (new entities, unverified, disputed)
//
// OpenClaw gets instant first because node operators have skin in the game:
// reputation score, Stripe Connect KYC, clawback from pendingBalance.
// Centralised providers start STANDARD until partnership agreements develop.
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db';
import type {
  SettlementLane,
  SettlementTerms,
  SettlementRecord,
} from './types';
import { LANE_DEFAULTS } from './types';

// ── Lane Assignment ───────────────────────────────────────────────────────

interface LaneAssignmentInputs {
  entityType: 'provider' | 'node';
  trustScore: number;
  verificationScore: number;
  reputationScore: number;      // NodeOperator reputation or provider track record
  hasEscrow: boolean;
  estimatedDailyVolumeUsd?: number;
  escrowAmountUsd?: number;
  hasActiveDisputes: boolean;
  // Platform maturity can override thresholds
  instantThreshold?: number;
}

/**
 * Determine settlement lane and terms for an entity.
 */
export function assignSettlementLane(inputs: LaneAssignmentInputs): SettlementTerms {
  const {
    trustScore,
    verificationScore,
    reputationScore,
    hasEscrow,
    hasActiveDisputes,
    instantThreshold = 80,
  } = inputs;

  // Active disputes force DEFERRED regardless of trust
  if (hasActiveDisputes) {
    return {
      ...LANE_DEFAULTS.DEFERRED,
      settlementDelayHours: 336, // 14 days during dispute
    };
  }

  // --- INSTANT lane ---
  const meetsInstantByTrust =
    trustScore >= instantThreshold &&
    verificationScore >= 65 &&
    reputationScore >= 80;

  const meetsInstantByEscrow =
    hasEscrow &&
    (inputs.escrowAmountUsd ?? 0) >= (inputs.estimatedDailyVolumeUsd ?? 100);

  if (meetsInstantByTrust || meetsInstantByEscrow) {
    return {
      ...LANE_DEFAULTS.INSTANT,
      escrowRequired: meetsInstantByEscrow && !meetsInstantByTrust,
      escrowAmountUsd: meetsInstantByEscrow ? (inputs.escrowAmountUsd ?? null) : null,
    };
  }

  // --- STANDARD lane ---
  if (trustScore >= 50 && verificationScore >= 40) {
    return { ...LANE_DEFAULTS.STANDARD };
  }

  // --- DEFERRED lane ---
  // Settlement delay scales inversely with trust
  let delayHours: number;
  if (trustScore >= 30) {
    delayHours = 168;   // 7 days
  } else if (trustScore >= 10) {
    delayHours = 336;   // 14 days
  } else {
    delayHours = 720;   // 30 days
  }

  return {
    ...LANE_DEFAULTS.DEFERRED,
    settlementDelayHours: delayHours,
    disputeWindowHours: delayHours, // dispute window = settlement delay
  };
}

// ── Settlement Execution ──────────────────────────────────────────────────

/**
 * Create a settlement record for a completed proxy request.
 *
 * INSTANT: Immediately credits the payee's balance.
 * STANDARD: Queued for daily batch settlement.
 * DEFERRED: Queued with escrow release timing.
 */
export async function settleRequest(
  requestId: string,
  payeeType: 'provider' | 'node',
  payeeId: string,
  amountUsd: number,
  terms: SettlementTerms,
): Promise<SettlementRecord> {
  const now = new Date();

  // Calculate escrow release time
  const escrowReleaseAt = terms.settlementDelayHours > 0
    ? new Date(now.getTime() + terms.settlementDelayHours * 60 * 60 * 1000)
    : null;

  const record = await prisma.computeSettlementRecord.create({
    data: {
      requestId,
      lane: terms.lane as 'INSTANT' | 'STANDARD' | 'DEFERRED',
      amountUsd,
      payeeType,
      payeeId,
      status: terms.lane === 'INSTANT' ? 'SETTLED' : 'PENDING',
      settledAt: terms.lane === 'INSTANT' ? now : null,
      escrowReleaseAt,
    },
  });

  // INSTANT lane: credit the payee immediately
  // For node operators (Stream T), this means incrementing pendingBalance
  // For providers, this creates a platform credit entry
  if (terms.lane === 'INSTANT') {
    try {
      await creditPayee(payeeType, payeeId, amountUsd, record.id);
    } catch (err) {
      // If crediting fails, revert to PENDING for manual resolution
      await prisma.computeSettlementRecord.update({
        where: { id: record.id },
        data: { status: 'PENDING', settledAt: null },
      });
      console.error('[Settlement] Failed to credit payee:', err);
    }
  }

  return {
    id: record.id,
    requestId,
    lane: terms.lane,
    amountUsd,
    payeeType,
    payeeId,
    status: record.status as 'PENDING' | 'SETTLED' | 'DISPUTED' | 'REVERSED',
    settledAt: record.settledAt,
    disputeReason: null,
    escrowReleaseAt: record.escrowReleaseAt,
    createdAt: record.createdAt,
  };
}

/**
 * Credit a payee's balance. For node operators, this increments
 * pendingBalance on the NodeOperator model (Stream T).
 */
async function creditPayee(
  payeeType: string,
  payeeId: string,
  amountUsd: number,
  settlementId: string,
): Promise<void> {
  if (payeeType === 'node') {
    // Stream T NodeOperator — increment pendingBalance
    // This is a no-op if NodeOperator model doesn't exist yet
    // (Stream T is designed but not built)
    try {
      await prisma.$executeRaw`
        UPDATE node_operators
        SET pending_balance = pending_balance + ${amountUsd}
        WHERE id = ${payeeId}
      `;
    } catch {
      // NodeOperator table may not exist yet — log and continue
      console.warn(`[Settlement] NodeOperator table not yet available for payee ${payeeId}`);
    }
  }
  // For providers: settlement is informational (InferLane pays via API keys)
  // The settlement record serves as the audit trail
}

// ── Dispute Flow ──────────────────────────────────────────────────────────

/**
 * Initiate a dispute on a settlement.
 * For INSTANT lane: reverses the credit (clawback).
 * For STANDARD/DEFERRED: holds the settlement.
 */
export async function initiateDispute(
  settlementId: string,
  userId: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  const record = await prisma.computeSettlementRecord.findUnique({
    where: { id: settlementId },
  });

  if (!record) {
    return { success: false, error: 'Settlement not found' };
  }

  // Check dispute window
  const disputeDeadline = new Date(
    record.createdAt.getTime() + getDisputeWindowHours(record.lane) * 60 * 60 * 1000,
  );

  if (new Date() > disputeDeadline) {
    return { success: false, error: 'Dispute window has closed' };
  }

  if (record.status === 'DISPUTED') {
    return { success: false, error: 'Settlement is already disputed' };
  }

  if (record.status === 'REVERSED') {
    return { success: false, error: 'Settlement has already been reversed' };
  }

  // Mark as disputed
  await prisma.computeSettlementRecord.update({
    where: { id: settlementId },
    data: {
      status: 'DISPUTED',
      disputeReason: reason,
    },
  });

  // For INSTANT lane settlements that were already credited: clawback
  if (record.status === 'SETTLED' && record.lane === 'INSTANT') {
    try {
      await clawbackPayee(record.payeeType, record.payeeId, Number(record.amountUsd));
    } catch (err) {
      console.error('[Settlement] Clawback failed:', err);
      // Dispute is still marked — manual resolution needed
    }
  }

  return { success: true };
}

/**
 * Reverse a credit from a payee's balance (clawback for disputed INSTANT settlements).
 */
async function clawbackPayee(
  payeeType: string,
  payeeId: string,
  amountUsd: number,
): Promise<void> {
  if (payeeType === 'node') {
    try {
      await prisma.$executeRaw`
        UPDATE node_operators
        SET pending_balance = GREATEST(0, pending_balance - ${amountUsd})
        WHERE id = ${payeeId}
      `;
    } catch {
      console.warn(`[Settlement] Clawback: NodeOperator table not yet available for ${payeeId}`);
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getDisputeWindowHours(lane: string): number {
  switch (lane) {
    case 'INSTANT': return LANE_DEFAULTS.INSTANT.disputeWindowHours;
    case 'STANDARD': return LANE_DEFAULTS.STANDARD.disputeWindowHours;
    case 'DEFERRED': return LANE_DEFAULTS.DEFERRED.disputeWindowHours;
    default: return 24;
  }
}

/**
 * Settle all PENDING records that have passed their escrow release time.
 * Called by a daily cron job.
 */
export async function settlePendingRecords(): Promise<{
  settled: number;
  failed: number;
}> {
  const now = new Date();

  const pendingRecords = await prisma.computeSettlementRecord.findMany({
    where: {
      status: 'PENDING',
      escrowReleaseAt: { lte: now },
    },
    take: 100, // batch size
  });

  let settled = 0;
  let failed = 0;

  for (const record of pendingRecords) {
    try {
      await creditPayee(record.payeeType, record.payeeId, Number(record.amountUsd), record.id);

      await prisma.computeSettlementRecord.update({
        where: { id: record.id },
        data: { status: 'SETTLED', settledAt: now },
      });

      settled++;
    } catch (err) {
      console.error(`[Settlement] Failed to settle ${record.id}:`, err);
      failed++;
    }
  }

  return { settled, failed };
}

/**
 * Settle all STANDARD lane records from the previous day.
 * Called by the daily batch settlement cron (T+1).
 */
export async function settleStandardLane(): Promise<{
  settled: number;
  failed: number;
}> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const standardRecords = await prisma.computeSettlementRecord.findMany({
    where: {
      status: 'PENDING',
      lane: 'STANDARD',
      createdAt: { lte: oneDayAgo },
    },
    take: 500,
  });

  let settled = 0;
  let failed = 0;

  for (const record of standardRecords) {
    try {
      await creditPayee(record.payeeType, record.payeeId, Number(record.amountUsd), record.id);

      await prisma.computeSettlementRecord.update({
        where: { id: record.id },
        data: { status: 'SETTLED', settledAt: now },
      });

      settled++;
    } catch (err) {
      console.error(`[Settlement] Standard lane failed for ${record.id}:`, err);
      failed++;
    }
  }

  return { settled, failed };
}
