// ---------------------------------------------------------------------------
// Compute Order Book Engine (Stream V)
// ---------------------------------------------------------------------------
// The core matching engine for the compute trading protocol.
// Supports LIMIT and MARKET orders for classified compute credits.
//
// Orders are matched by quality tier: a FRONTIER buy order only matches
// FRONTIER sell orders. Price-time priority within each tier.
//
// Platform take rate: 2.5% per fill (split: 1.25% buyer, 1.25% seller).
//
// Third-party platforms connect via TradingApiKey and submit orders
// through the REST API. This enables futures desks, prediction markets,
// and arbitrage bots to build on InferLane's compute liquidity.
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { buildOrderFillHtml } from '@/lib/email-templates';

// ── Constants ────────────────────────────────────────────────────────────

export const TRADING_FEE_RATE = 0.025;  // 2.5% per fill
export const MIN_ORDER_QUANTITY = 1;     // 1 credit minimum
export const MAX_ORDER_QUANTITY = 100_000;
export const MIN_PRICE = 0.05;           // $0.05/credit floor
export const MAX_PRICE = 2.00;           // $2.00/credit ceiling
export const MAX_ACTIVE_ORDERS = 50;     // per user
export const ORDER_MAX_TTL_DAYS = 30;

// ── Types ────────────────────────────────────────────────────────────────

export interface CreateOrderParams {
  userId: string;
  side: 'BUY' | 'SELL';
  orderType: 'LIMIT' | 'MARKET';
  qualityTier: string;
  inferenceType?: string;
  latencyClass?: string;
  quantity: number;
  pricePerUnit: number;        // For LIMIT orders; MARKET uses best available
  expiresInHours?: number;     // Default 24h
  tradingApiKeyId?: string;
  classificationId?: string;
}

export interface MatchResult {
  fills: FillRecord[];
  remainingQuantity: number;
  totalFilledQuantity: number;
  totalCostUsd: number;
  totalFees: number;
}

export interface FillRecord {
  buyOrderId: string;
  sellOrderId: string;
  quantity: number;
  pricePerUnit: number;
  totalUsd: number;
  platformFeeUsd: number;
}

// ── Order Creation ───────────────────────────────────────────────────────

/**
 * Create and attempt to match a new order.
 * Returns the order ID and any immediate fills.
 */
export async function createOrder(params: CreateOrderParams): Promise<{
  orderId: string;
  matchResult: MatchResult;
}> {
  // Validate
  if (params.quantity < MIN_ORDER_QUANTITY || params.quantity > MAX_ORDER_QUANTITY) {
    throw new Error(`Quantity must be between ${MIN_ORDER_QUANTITY} and ${MAX_ORDER_QUANTITY}`);
  }
  if (params.pricePerUnit < MIN_PRICE || params.pricePerUnit > MAX_PRICE) {
    throw new Error(`Price must be between $${MIN_PRICE} and $${MAX_PRICE}`);
  }

  // Check active order limit
  const activeCount = await prisma.computeOrder.count({
    where: { userId: params.userId, status: { in: ['OPEN', 'PARTIALLY_FILLED'] } },
  });
  if (activeCount >= MAX_ACTIVE_ORDERS) {
    throw new Error(`Maximum ${MAX_ACTIVE_ORDERS} active orders allowed`);
  }

  const expiresAt = new Date(
    Date.now() + (params.expiresInHours ?? 24) * 60 * 60 * 1000,
  );

  // Create the order
  const order = await prisma.computeOrder.create({
    data: {
      userId: params.userId,
      side: params.side,
      orderType: params.orderType,
      qualityTier: params.qualityTier as 'FRONTIER' | 'STANDARD' | 'ECONOMY' | 'OPEN_WEIGHT',
      inferenceType: params.inferenceType as 'CHAT' | 'EMBEDDING' | 'IMAGE_GENERATION' | 'CODE' | 'REASONING' | 'AUDIO' | 'MULTIMODAL' | undefined,
      latencyClass: params.latencyClass as 'REALTIME' | 'INTERACTIVE' | 'BATCH' | 'ASYNC' | undefined,
      quantity: params.quantity,
      pricePerUnit: params.pricePerUnit,
      expiresAt,
      tradingApiKeyId: params.tradingApiKeyId,
      classificationId: params.classificationId,
    },
  });

  // Attempt matching
  const matchResult = await matchOrder(order.id, params);

  return { orderId: order.id, matchResult };
}

// ── Order Matching ───────────────────────────────────────────────────────

/**
 * Match an order against the opposite side of the book.
 * Price-time priority: best price first, then earliest order.
 */
async function matchOrder(
  orderId: string,
  params: CreateOrderParams,
): Promise<MatchResult> {
  const fills: FillRecord[] = [];
  let remainingQty = params.quantity;
  let totalFilled = 0;
  let totalCost = 0;
  let totalFees = 0;

  // Find counterparty orders
  const oppositeSide = params.side === 'BUY' ? 'SELL' : 'BUY';
  const priceCondition = params.side === 'BUY'
    ? { lte: params.pricePerUnit }   // Buy: match sells at or below our price
    : { gte: params.pricePerUnit };   // Sell: match buys at or above our price
  const priceOrder = params.side === 'BUY' ? 'asc' : 'desc'; // Best price first

  const counterpartyOrders = await prisma.computeOrder.findMany({
    where: {
      side: oppositeSide,
      status: { in: ['OPEN', 'PARTIALLY_FILLED'] },
      qualityTier: params.qualityTier as 'FRONTIER' | 'STANDARD' | 'ECONOMY' | 'OPEN_WEIGHT',
      pricePerUnit: priceCondition,
      expiresAt: { gt: new Date() },
      userId: { not: params.userId }, // No self-trade
    },
    orderBy: [
      { pricePerUnit: priceOrder as 'asc' | 'desc' },
      { createdAt: 'asc' }, // Time priority
    ],
    take: 50,
  });

  for (const counterparty of counterpartyOrders) {
    if (remainingQty <= 0) break;

    const counterAvailable = Number(counterparty.quantity) - Number(counterparty.filledQuantity);
    if (counterAvailable <= 0) continue;

    const fillQty = Math.min(remainingQty, counterAvailable);
    const fillPrice = Number(counterparty.pricePerUnit); // Taker gets maker's price
    const fillTotal = fillQty * fillPrice;
    const fee = fillTotal * TRADING_FEE_RATE;

    // Create fill record
    const buyOrderId = params.side === 'BUY' ? orderId : counterparty.id;
    const sellOrderId = params.side === 'SELL' ? orderId : counterparty.id;

    await prisma.orderFill.create({
      data: {
        buyOrderId,
        sellOrderId,
        quantity: fillQty,
        pricePerUnit: fillPrice,
        totalUsd: fillTotal,
        platformFeeUsd: fee,
      },
    });

    // Update counterparty order
    const newCounterFilled = Number(counterparty.filledQuantity) + fillQty;
    const counterStatus = newCounterFilled >= Number(counterparty.quantity) ? 'FILLED' : 'PARTIALLY_FILLED';
    await prisma.computeOrder.update({
      where: { id: counterparty.id },
      data: {
        filledQuantity: newCounterFilled,
        status: counterStatus,
        avgFillPrice: fillPrice,
      },
    });

    fills.push({
      buyOrderId,
      sellOrderId,
      quantity: fillQty,
      pricePerUnit: fillPrice,
      totalUsd: fillTotal,
      platformFeeUsd: fee,
    });

    remainingQty -= fillQty;
    totalFilled += fillQty;
    totalCost += fillTotal;
    totalFees += fee;
  }

  // Update our order
  const orderStatus = totalFilled >= params.quantity
    ? 'FILLED'
    : totalFilled > 0
      ? 'PARTIALLY_FILLED'
      : 'OPEN';

  const avgPrice = totalFilled > 0 ? totalCost / totalFilled : null;

  await prisma.computeOrder.update({
    where: { id: orderId },
    data: {
      filledQuantity: totalFilled,
      status: orderStatus,
      avgFillPrice: avgPrice,
    },
  });

  // Send fill notifications (non-blocking, fire-and-forget)
  if (fills.length > 0) {
    notifyFills(orderId, params, fills).catch(() => {});
  }

  return {
    fills,
    remainingQuantity: remainingQty,
    totalFilledQuantity: totalFilled,
    totalCostUsd: totalCost,
    totalFees,
  };
}

/**
 * Send email notifications for order fills to both parties.
 * Non-blocking — errors are silently caught.
 */
async function notifyFills(
  orderId: string,
  params: CreateOrderParams,
  fills: FillRecord[],
): Promise<void> {
  // Collect unique counterparty user IDs from fills
  const counterpartyOrderIds = fills.map((f) =>
    params.side === 'BUY' ? f.sellOrderId : f.buyOrderId,
  );

  const counterpartyOrders = await prisma.computeOrder.findMany({
    where: { id: { in: counterpartyOrderIds } },
    select: { userId: true },
  });
  const allUserIds = [params.userId, ...counterpartyOrders.map((o) => o.userId)];
  const uniqueUserIds = [...new Set(allUserIds)];

  // Fetch users + notification prefs
  const users = await prisma.user.findMany({
    where: { id: { in: uniqueUserIds } },
    select: { id: true, name: true, email: true },
  });
  const notifPrefs = await prisma.notificationPreferences.findMany({
    where: { userId: { in: uniqueUserIds } },
    select: { userId: true, tradeNotifs: true },
  });
  const prefsMap = new Map(notifPrefs.map((p) => [p.userId, p]));

  const totalFillQty = fills.reduce((sum, f) => sum + f.quantity, 0);
  const totalFillCost = fills.reduce((sum, f) => sum + f.totalUsd, 0);
  const avgPrice = totalFillCost / totalFillQty;

  for (const user of users) {
    if (!user.email) continue;
    const prefs = prefsMap.get(user.id);
    if (prefs && prefs.tradeNotifs === false) continue;

    const isOriginator = user.id === params.userId;
    const side = isOriginator ? params.side : (params.side === 'BUY' ? 'SELL' : 'BUY');
    const html = buildOrderFillHtml(user.name || 'Trader', side as 'BUY' | 'SELL', totalFillQty, avgPrice, params.qualityTier);
    sendEmail({
      to: user.email,
      subject: `Order Filled: ${side} ${totalFillQty} ${params.qualityTier} credits — InferLane`,
      html,
    }).catch(() => {});
  }
}

// ── Order Book Queries ───────────────────────────────────────────────────

export interface OrderBookLevel {
  price: number;
  quantity: number;
  orderCount: number;
}

/**
 * Get the current order book for a quality tier.
 * Returns bids (buy orders) and asks (sell orders) aggregated by price level.
 */
export async function getOrderBook(
  qualityTier: string,
  depth: number = 20,
): Promise<{ bids: OrderBookLevel[]; asks: OrderBookLevel[] }> {
  const now = new Date();

  const [buyOrders, sellOrders] = await Promise.all([
    prisma.computeOrder.findMany({
      where: {
        side: 'BUY',
        status: { in: ['OPEN', 'PARTIALLY_FILLED'] },
        qualityTier: qualityTier as 'FRONTIER' | 'STANDARD' | 'ECONOMY' | 'OPEN_WEIGHT',
        expiresAt: { gt: now },
      },
      orderBy: { pricePerUnit: 'desc' },
      take: 200,
    }),
    prisma.computeOrder.findMany({
      where: {
        side: 'SELL',
        status: { in: ['OPEN', 'PARTIALLY_FILLED'] },
        qualityTier: qualityTier as 'FRONTIER' | 'STANDARD' | 'ECONOMY' | 'OPEN_WEIGHT',
        expiresAt: { gt: now },
      },
      orderBy: { pricePerUnit: 'asc' },
      take: 200,
    }),
  ]);

  const bids = aggregateLevels(buyOrders, depth);
  const asks = aggregateLevels(sellOrders, depth);

  return { bids, asks };
}

function aggregateLevels(
  orders: Array<{ pricePerUnit: unknown; quantity: unknown; filledQuantity: unknown }>,
  depth: number,
): OrderBookLevel[] {
  const levels = new Map<number, { quantity: number; count: number }>();

  for (const order of orders) {
    const price = Number(order.pricePerUnit);
    const available = Number(order.quantity) - Number(order.filledQuantity);
    if (available <= 0) continue;

    const existing = levels.get(price);
    if (existing) {
      existing.quantity += available;
      existing.count++;
    } else {
      levels.set(price, { quantity: available, count: 1 });
    }
  }

  return Array.from(levels.entries())
    .slice(0, depth)
    .map(([price, data]) => ({
      price,
      quantity: Math.round(data.quantity * 100) / 100,
      orderCount: data.count,
    }));
}

// ── Expire Stale Orders ──────────────────────────────────────────────────

/**
 * Cancel all expired orders. Called by cron.
 */
export async function expireOrders(): Promise<number> {
  const result = await prisma.computeOrder.updateMany({
    where: {
      status: { in: ['OPEN', 'PARTIALLY_FILLED'] },
      expiresAt: { lt: new Date() },
    },
    data: { status: 'EXPIRED' },
  });

  return result.count;
}
