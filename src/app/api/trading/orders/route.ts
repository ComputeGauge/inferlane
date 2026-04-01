import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';
import { createOrder, getOrderBook } from '@/lib/trading/order-book';
import { handleApiError } from '@/lib/api-errors';

// ---------------------------------------------------------------------------
// GET    /api/trading/orders?tier=FRONTIER — order book + user's orders
// POST   /api/trading/orders — place a new order (with credit balance gate)
// DELETE /api/trading/orders?orderId=xxx — cancel an open order
// ---------------------------------------------------------------------------

async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const rl = await rateLimit(`trading-read:${userId}`, 60, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const tier = req.nextUrl.searchParams.get('tier') || 'FRONTIER';
  const showMyOrders = req.nextUrl.searchParams.get('mine') === 'true';

  // Get order book
  const book = await getOrderBook(tier);

  // Get user's active orders
  let myOrders: unknown[] = [];
  if (showMyOrders) {
    myOrders = await prisma.computeOrder.findMany({
      where: { userId, status: { in: ['OPEN', 'PARTIALLY_FILLED'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { fills: { take: 10, orderBy: { createdAt: 'desc' } } },
    });
  }

  return NextResponse.json({
    tier,
    orderBook: book,
    myOrders: (myOrders as Array<Record<string, unknown>>).map(serialiseOrder),
  });
}

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const rl = await rateLimit(`trading-write:${userId}`, 20, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { side, orderType, qualityTier, inferenceType, latencyClass, quantity, pricePerUnit, expiresInHours } = body;

  if (!side || !['BUY', 'SELL'].includes(side)) {
    return NextResponse.json({ error: 'side must be BUY or SELL' }, { status: 400 });
  }
  if (!orderType || !['LIMIT', 'MARKET'].includes(orderType)) {
    return NextResponse.json({ error: 'orderType must be LIMIT or MARKET' }, { status: 400 });
  }
  if (!qualityTier || !['FRONTIER', 'STANDARD', 'ECONOMY', 'OPEN_WEIGHT'].includes(qualityTier)) {
    return NextResponse.json({ error: 'qualityTier is required' }, { status: 400 });
  }
  if (typeof quantity !== 'number' || quantity <= 0) {
    return NextResponse.json({ error: 'quantity must be a positive number' }, { status: 400 });
  }
  if (typeof pricePerUnit !== 'number' || pricePerUnit <= 0) {
    return NextResponse.json({ error: 'pricePerUnit must be a positive number' }, { status: 400 });
  }

  // ── Credit balance gate (BUY orders only) ──
  // BUY orders require sufficient available credits to cover worst-case fill.
  // SELL orders don't require credits — seller receives credits on fill.
  if (side === 'BUY') {
    const maxCost = quantity * pricePerUnit;
    const balance = await prisma.creditBalance.findUnique({
      where: { userId },
      select: { available: true },
    });
    const available = balance ? Number(balance.available) : 0;
    if (available < maxCost) {
      return NextResponse.json(
        { error: `Insufficient credits. Need $${maxCost.toFixed(2)}, available $${available.toFixed(2)}` },
        { status: 400 },
      );
    }
  }

  try {
    const result = await createOrder({
      userId,
      side,
      orderType,
      qualityTier,
      inferenceType,
      latencyClass,
      quantity,
      pricePerUnit,
      expiresInHours,
    });

    return NextResponse.json({
      orderId: result.orderId,
      fills: result.matchResult.fills,
      filledQuantity: result.matchResult.totalFilledQuantity,
      remainingQuantity: result.matchResult.remainingQuantity,
      totalCostUsd: result.matchResult.totalCostUsd,
      totalFees: result.matchResult.totalFees,
    }, { status: 201 });
  } catch (err) {
    return handleApiError(err, 'CreateOrder');
  }
}

// ── DELETE — Cancel an open order ─────────────────────────────────────────

async function handleDELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const rl = await rateLimit(`trading-cancel:${userId}`, 30, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const orderId = req.nextUrl.searchParams.get('orderId');
  if (!orderId) {
    return NextResponse.json({ error: 'orderId query parameter is required' }, { status: 400 });
  }

  // Find the order — must belong to the user and be cancellable
  const order = await prisma.computeOrder.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true, status: true, filledQuantity: true },
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  if (order.userId !== userId) {
    return NextResponse.json({ error: 'Not your order' }, { status: 403 });
  }
  if (order.status !== 'OPEN' && order.status !== 'PARTIALLY_FILLED') {
    return NextResponse.json(
      { error: `Cannot cancel order with status ${order.status}` },
      { status: 400 },
    );
  }

  // Cancel the order
  await prisma.computeOrder.update({
    where: { id: orderId },
    data: { status: 'CANCELLED' },
  });

  return NextResponse.json({
    orderId,
    status: 'CANCELLED',
    filledQuantity: Number(order.filledQuantity),
    message: order.filledQuantity && Number(order.filledQuantity) > 0
      ? 'Order cancelled. Partial fills remain settled.'
      : 'Order cancelled. No fills occurred.',
  });
}

function serialiseOrder(order: Record<string, unknown>) {
  return {
    ...order,
    quantity: Number(order.quantity),
    pricePerUnit: Number(order.pricePerUnit),
    filledQuantity: Number(order.filledQuantity),
    avgFillPrice: order.avgFillPrice ? Number(order.avgFillPrice) : null,
  };
}

export const GET = withTiming(handleGET);
export const POST = withTiming(handlePOST);
export const DELETE = withTiming(handleDELETE);
