// ---------------------------------------------------------------------------
// Compute Futures & Derivatives (Stream V)
// ---------------------------------------------------------------------------
// Forward contracts and options on classified compute.
//
// A future is a binding agreement to deliver compute credits of a
// specific quality tier at a strike price on a delivery date.
// Margin is held in escrow (from user's credit balance).
//
// Settlement: on delivery date, the contract settles against the
// CG-{TIER} index. PnL = (settlementPrice - strikePrice) * quantity.
// Positive PnL → credit to buyer. Negative PnL → credit to seller.
//
// This enables:
// - Hedging: Enterprise locks in compute cost for Q4
// - Speculation: "Frontier compute will be cheaper in 6 months"
// - Prediction markets: "Will GPT-5 class compute trade < $0.50?"
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db';
import { getCurrentIndices } from './indices';
import { sendEmail } from '@/lib/email';
import { buildFutureMatchedHtml, buildFutureSettledHtml } from '@/lib/email-templates';

// ── Constants ────────────────────────────────────────────────────────────

export const FUTURES_CONFIG = {
  minQuantity: 100,
  maxQuantity: 1_000_000,
  minStrikePrice: 0.05,
  maxStrikePrice: 2.00,
  marginRatePct: 10,            // 10% of notional value held as margin
  maxDeliveryDays: 180,         // 6 months max
  minDeliveryDays: 1,
  maxOpenContracts: 20,         // per user
} as const;

// ── Types ────────────────────────────────────────────────────────────────

export type StandardContractType = 'FORWARD' | 'OPTION_CALL' | 'OPTION_PUT';
export type MemoryContractType = 'DECODE_FORWARD' | 'MEMORY_FORWARD' | 'DECODE_OPTION_CALL' | 'MEMORY_OPTION_PUT';
export type AllContractTypes = StandardContractType | MemoryContractType;

// Memory/decode contract types settle against IL-DECODE and IL-MEMORY indices
const MEMORY_CONTRACT_INDEX: Record<MemoryContractType, string> = {
  DECODE_FORWARD: 'IL-DECODE',
  MEMORY_FORWARD: 'IL-MEMORY',
  DECODE_OPTION_CALL: 'IL-DECODE',
  MEMORY_OPTION_PUT: 'IL-MEMORY',
};

const MEMORY_CONTRACT_TYPES: MemoryContractType[] = [
  'DECODE_FORWARD', 'MEMORY_FORWARD', 'DECODE_OPTION_CALL', 'MEMORY_OPTION_PUT',
];

export interface CreateFutureParams {
  creatorId: string;
  contractType: AllContractTypes;
  qualityTier: string;
  inferenceType?: string;
  quantity: number;
  strikePrice: number;
  deliveryDate: Date;
}

export interface SettlementResult {
  contractId: string;
  strikePrice: number;
  settlementPrice: number;
  pnlUsd: number;
  settled: boolean;
}

// ── Contract Creation ────────────────────────────────────────────────────

/**
 * Create a new compute future/option contract.
 * Margin is calculated and would be reserved from creator's credit balance.
 */
export async function createFuture(params: CreateFutureParams): Promise<{
  contractId: string;
  marginRequired: number;
}> {
  // Validate
  if (params.quantity < FUTURES_CONFIG.minQuantity || params.quantity > FUTURES_CONFIG.maxQuantity) {
    throw new Error(`Quantity must be ${FUTURES_CONFIG.minQuantity}–${FUTURES_CONFIG.maxQuantity}`);
  }
  if (params.strikePrice < FUTURES_CONFIG.minStrikePrice || params.strikePrice > FUTURES_CONFIG.maxStrikePrice) {
    throw new Error(`Strike price must be $${FUTURES_CONFIG.minStrikePrice}–$${FUTURES_CONFIG.maxStrikePrice}`);
  }

  const now = new Date();
  const deliveryDays = Math.ceil((params.deliveryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (deliveryDays < FUTURES_CONFIG.minDeliveryDays || deliveryDays > FUTURES_CONFIG.maxDeliveryDays) {
    throw new Error(`Delivery must be ${FUTURES_CONFIG.minDeliveryDays}–${FUTURES_CONFIG.maxDeliveryDays} days out`);
  }

  // Check open contract limit
  const openCount = await prisma.computeFuture.count({
    where: { creatorId: params.creatorId, status: { in: ['OPEN', 'MATCHED'] } },
  });
  if (openCount >= FUTURES_CONFIG.maxOpenContracts) {
    throw new Error(`Maximum ${FUTURES_CONFIG.maxOpenContracts} open contracts allowed`);
  }

  // Calculate margin
  const notionalValue = params.quantity * params.strikePrice;
  const marginRequired = notionalValue * (FUTURES_CONFIG.marginRatePct / 100);

  // For memory/decode contracts, qualityTier maps to the index (IL-DECODE / IL-MEMORY)
  // For standard contracts, qualityTier maps to CG-{TIER}
  const isMemoryContract = MEMORY_CONTRACT_TYPES.includes(params.contractType as MemoryContractType);
  const effectiveQualityTier = isMemoryContract
    ? (params.contractType.startsWith('DECODE') ? 'DECODE' : 'MEMORY')
    : params.qualityTier;

  const contract = await prisma.computeFuture.create({
    data: {
      creatorId: params.creatorId,
      contractType: params.contractType,
      qualityTier: effectiveQualityTier as 'FRONTIER' | 'STANDARD' | 'ECONOMY' | 'OPEN_WEIGHT',
      inferenceType: params.inferenceType as 'CHAT' | 'EMBEDDING' | 'IMAGE_GENERATION' | 'CODE' | 'REASONING' | 'AUDIO' | 'MULTIMODAL' | undefined,
      quantity: params.quantity,
      strikePrice: params.strikePrice,
      deliveryDate: params.deliveryDate,
      marginRequired,
    },
  });

  return {
    contractId: contract.id,
    marginRequired,
  };
}

// ── Counterparty Matching ─────────────────────────────────────────────────

/**
 * Match an existing OPEN contract with a counterparty.
 * The counterparty takes the opposite side of the contract.
 *
 * - Creator of a FORWARD benefits if settlement > strike (long position)
 * - Counterparty benefits if settlement < strike (short position)
 * - For options: creator is the buyer, counterparty is the writer/seller
 *
 * @returns true if matched, throws on validation failure
 */
export async function matchFuture(
  contractId: string,
  counterpartyId: string,
): Promise<{ contractId: string; marginRequired: number }> {
  // Validate contract exists and is OPEN
  const contract = await prisma.computeFuture.findUnique({
    where: { id: contractId },
  });

  if (!contract) {
    throw new Error('Contract not found');
  }

  if (contract.status !== 'OPEN') {
    throw new Error(`Contract is ${contract.status}, not OPEN`);
  }

  // Self-trade prevention
  if (contract.creatorId === counterpartyId) {
    throw new Error('Cannot take the counterparty position on your own contract');
  }

  // Check counterparty doesn't already have too many open contracts
  const counterpartyOpenCount = await prisma.computeFuture.count({
    where: {
      OR: [
        { creatorId: counterpartyId },
        { counterpartyId: counterpartyId },
      ],
      status: { in: ['OPEN', 'MATCHED'] },
    },
  });

  if (counterpartyOpenCount >= FUTURES_CONFIG.maxOpenContracts) {
    throw new Error(`Maximum ${FUTURES_CONFIG.maxOpenContracts} open contracts allowed`);
  }

  // Counterparty needs the same margin as creator
  const marginRequired = Number(contract.marginRequired);

  // Update contract status to MATCHED with counterparty
  await prisma.computeFuture.update({
    where: { id: contractId },
    data: {
      counterpartyId,
      status: 'MATCHED',
    },
  });

  // Send match notifications to both parties (non-blocking)
  notifyFutureMatched(contract.id, contract.creatorId, counterpartyId, contract.contractType, Number(contract.quantity), Number(contract.strikePrice), contract.deliveryDate).catch(() => {});

  return {
    contractId: contract.id,
    marginRequired,
  };
}

/**
 * Get available (OPEN) contracts that a user could match against.
 * Excludes contracts created by the requesting user (no self-matching).
 */
export async function getAvailableContracts(
  userId: string,
  qualityTier?: string,
) {
  return prisma.computeFuture.findMany({
    where: {
      status: 'OPEN',
      creatorId: { not: userId },
      deliveryDate: { gt: new Date() },
      ...(qualityTier ? { qualityTier: qualityTier as 'FRONTIER' | 'STANDARD' | 'ECONOMY' | 'OPEN_WEIGHT' } : {}),
    },
    orderBy: { deliveryDate: 'asc' },
    take: 50,
  });
}

// ── Settlement ───────────────────────────────────────────────────────────

/**
 * Settle all contracts that have reached their delivery date.
 * Settlement price = CG-{TIER} index value at time of settlement.
 */
export async function settleExpiredContracts(): Promise<SettlementResult[]> {
  const now = new Date();
  const results: SettlementResult[] = [];

  // Get current index prices — include both quality tier indices and memory/decode indices
  const indices = await getCurrentIndices();
  const indexPrices = new Map<string, number>();
  for (const idx of indices) {
    indexPrices.set(idx.qualityTier, idx.currentValue);
    // Also map by index name for memory/decode lookups (IL-DECODE, IL-MEMORY)
    if (idx.name) {
      indexPrices.set(idx.name, idx.currentValue);
    }
  }

  // Find contracts past delivery date
  const expiredContracts = await prisma.computeFuture.findMany({
    where: {
      status: { in: ['OPEN', 'MATCHED'] },
      deliveryDate: { lte: now },
    },
    take: 100,
  });

  for (const contract of expiredContracts) {
    // For memory/decode contracts, resolve against the correct index
    const isMemory = MEMORY_CONTRACT_TYPES.includes(contract.contractType as MemoryContractType);
    let settlementPrice: number;

    if (isMemory) {
      const indexName = MEMORY_CONTRACT_INDEX[contract.contractType as MemoryContractType];
      settlementPrice = indexPrices.get(indexName) ?? indexPrices.get(contract.qualityTier) ?? Number(contract.strikePrice);
    } else {
      settlementPrice = indexPrices.get(contract.qualityTier) ?? Number(contract.strikePrice);
    }

    const strikePrice = Number(contract.strikePrice);
    const quantity = Number(contract.quantity);

    let pnlUsd: number;

    switch (contract.contractType) {
      case 'FORWARD':
      case 'DECODE_FORWARD':
      case 'MEMORY_FORWARD':
        // PnL = (settlement - strike) * quantity
        pnlUsd = (settlementPrice - strikePrice) * quantity;
        break;
      case 'OPTION_CALL':
      case 'DECODE_OPTION_CALL':
        // Buyer profits if settlement > strike
        pnlUsd = Math.max(0, (settlementPrice - strikePrice) * quantity);
        break;
      case 'OPTION_PUT':
      case 'MEMORY_OPTION_PUT':
        // Buyer profits if settlement < strike
        pnlUsd = Math.max(0, (strikePrice - settlementPrice) * quantity);
        break;
      default:
        pnlUsd = 0;
    }

    await prisma.computeFuture.update({
      where: { id: contract.id },
      data: {
        status: 'SETTLED',
        settlementPrice,
        pnlUsd,
        settledAt: now,
      },
    });

    results.push({
      contractId: contract.id,
      strikePrice,
      settlementPrice,
      pnlUsd,
      settled: true,
    });

    // Send settlement notifications (non-blocking)
    notifyFutureSettled(contract.creatorId, contract.counterpartyId, contract.contractType, pnlUsd, settlementPrice, strikePrice).catch(() => {});
  }

  return results;
}

/**
 * Get open contracts for a user.
 */
export async function getUserContracts(userId: string) {
  return prisma.computeFuture.findMany({
    where: { creatorId: userId },
    orderBy: { deliveryDate: 'asc' },
    take: 50,
  });
}

// ── Email Notification Helpers ──────────────────────────────────────────

async function notifyFutureMatched(
  contractId: string,
  creatorId: string,
  counterpartyId: string,
  contractType: string,
  quantity: number,
  strikePrice: number,
  deliveryDate: Date,
): Promise<void> {
  const userIds = [creatorId, counterpartyId];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const notifPrefs = await prisma.notificationPreferences.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, tradeNotifs: true },
  });
  const prefsMap = new Map(notifPrefs.map((p) => [p.userId, p]));

  const deliveryStr = deliveryDate.toISOString().split('T')[0];

  for (const user of users) {
    if (!user.email) continue;
    const prefs = prefsMap.get(user.id);
    if (prefs && prefs.tradeNotifs === false) continue;

    const html = buildFutureMatchedHtml(user.name || 'Trader', contractType, quantity, strikePrice, deliveryStr);
    sendEmail({
      to: user.email,
      subject: `Futures Contract Matched — InferLane`,
      html,
    }).catch(() => {});
  }
}

async function notifyFutureSettled(
  creatorId: string,
  counterpartyId: string | null,
  contractType: string,
  pnlUsd: number,
  settlementPrice: number,
  strikePrice: number,
): Promise<void> {
  const userIds = [creatorId, ...(counterpartyId ? [counterpartyId] : [])];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const notifPrefs = await prisma.notificationPreferences.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, tradeNotifs: true },
  });
  const prefsMap = new Map(notifPrefs.map((p) => [p.userId, p]));

  for (const user of users) {
    if (!user.email) continue;
    const prefs = prefsMap.get(user.id);
    if (prefs && prefs.tradeNotifs === false) continue;

    // For counterparty, PnL is inverted
    const userPnl = user.id === creatorId ? pnlUsd : -pnlUsd;
    const pnlSign = userPnl >= 0 ? '+' : '';
    const html = buildFutureSettledHtml(user.name || 'Trader', contractType, userPnl, settlementPrice, strikePrice);
    sendEmail({
      to: user.email,
      subject: `Contract Settled: ${pnlSign}$${Math.abs(userPnl).toFixed(2)} — InferLane`,
      html,
    }).catch(() => {});
  }
}
