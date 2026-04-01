import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';
import { createFuture, getUserContracts, matchFuture, getAvailableContracts } from '@/lib/trading/futures';
import { handleApiError } from '@/lib/api-errors';

// ---------------------------------------------------------------------------
// GET  /api/trading/futures — user's contracts (or ?available=true for open market)
// POST /api/trading/futures — create new or match existing contract
// ---------------------------------------------------------------------------

async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const rl = await rateLimit(`futures-read:${userId}`, 30, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // ?available=true returns open contracts on the market (not user's own)
  const { searchParams } = new URL(req.url);
  const showAvailable = searchParams.get('available') === 'true';
  const tierFilter = searchParams.get('tier') || undefined;

  if (showAvailable) {
    const available = await getAvailableContracts(userId, tierFilter);
    return NextResponse.json({
      contracts: available.map((c) => ({
        id: c.id,
        contractType: c.contractType,
        qualityTier: c.qualityTier,
        inferenceType: c.inferenceType,
        quantity: Number(c.quantity),
        strikePrice: Number(c.strikePrice),
        marginRequired: Number(c.marginRequired),
        deliveryDate: c.deliveryDate,
        createdAt: c.createdAt,
      })),
    });
  }

  const contracts = await getUserContracts(userId);

  return NextResponse.json({
    contracts: contracts.map((c) => ({
      ...c,
      quantity: Number(c.quantity),
      strikePrice: Number(c.strikePrice),
      settlementPrice: c.settlementPrice ? Number(c.settlementPrice) : null,
      pnlUsd: c.pnlUsd ? Number(c.pnlUsd) : null,
      marginRequired: Number(c.marginRequired),
    })),
  });
}

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const rl = await rateLimit(`futures-write:${userId}`, 10, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // ── Mode 1: Match an existing contract (counterparty takes the other side) ──
  if (body.contractId) {
    const { contractId } = body as { contractId: string };

    // Credit balance gate for counterparty margin
    const contract = await prisma.computeFuture.findUnique({
      where: { id: contractId },
      select: { marginRequired: true },
    });
    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    const counterpartyMargin = Number(contract.marginRequired);
    const cpBalance = await prisma.creditBalance.findUnique({
      where: { userId },
      select: { available: true },
    });
    const cpAvailable = cpBalance ? Number(cpBalance.available) : 0;
    if (cpAvailable < counterpartyMargin) {
      return NextResponse.json(
        { error: `Insufficient credits for margin. Need $${counterpartyMargin.toFixed(2)}, available $${cpAvailable.toFixed(2)}` },
        { status: 400 },
      );
    }

    try {
      const result = await matchFuture(contractId, userId);
      return NextResponse.json({
        contractId: result.contractId,
        marginRequired: result.marginRequired,
        message: 'Contract matched. You are now the counterparty.',
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Match failed' },
        { status: 400 },
      );
    }
  }

  // ── Mode 2: Create a new contract ──
  const { contractType, qualityTier, inferenceType, quantity, strikePrice, deliveryDate } = body;

  const VALID_CONTRACT_TYPES = [
    'FORWARD', 'OPTION_CALL', 'OPTION_PUT',
    'DECODE_FORWARD', 'MEMORY_FORWARD', 'DECODE_OPTION_CALL', 'MEMORY_OPTION_PUT',
  ];
  if (!contractType || !VALID_CONTRACT_TYPES.includes(contractType)) {
    return NextResponse.json({ error: `contractType must be one of: ${VALID_CONTRACT_TYPES.join(', ')}` }, { status: 400 });
  }

  // Memory/decode contracts don't require a quality tier — they settle against IL-DECODE/IL-MEMORY
  const isMemoryContract = ['DECODE_FORWARD', 'MEMORY_FORWARD', 'DECODE_OPTION_CALL', 'MEMORY_OPTION_PUT'].includes(contractType);
  if (!isMemoryContract && (!qualityTier || !['FRONTIER', 'STANDARD', 'ECONOMY', 'OPEN_WEIGHT'].includes(qualityTier))) {
    return NextResponse.json({ error: 'qualityTier is required for standard contracts' }, { status: 400 });
  }
  if (typeof quantity !== 'number' || quantity <= 0) {
    return NextResponse.json({ error: 'quantity must be positive' }, { status: 400 });
  }
  if (typeof strikePrice !== 'number' || strikePrice <= 0) {
    return NextResponse.json({ error: 'strikePrice must be positive' }, { status: 400 });
  }
  if (!deliveryDate) {
    return NextResponse.json({ error: 'deliveryDate is required' }, { status: 400 });
  }

  // ── Credit balance gate: margin requirement ──
  // Margin = 10% of notional (quantity × strikePrice)
  const marginRequired = quantity * strikePrice * 0.10;
  const balance = await prisma.creditBalance.findUnique({
    where: { userId },
    select: { available: true },
  });
  const available = balance ? Number(balance.available) : 0;
  if (available < marginRequired) {
    return NextResponse.json(
      { error: `Insufficient credits for margin. Need $${marginRequired.toFixed(2)}, available $${available.toFixed(2)}` },
      { status: 400 },
    );
  }

  try {
    const result = await createFuture({
      creatorId: userId,
      contractType,
      qualityTier,
      inferenceType,
      quantity,
      strikePrice,
      deliveryDate: new Date(deliveryDate),
    });

    return NextResponse.json({
      contractId: result.contractId,
      marginRequired: result.marginRequired,
      message: 'Contract created. Margin will be reserved from your credit balance.',
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Contract creation failed' },
      { status: 400 },
    );
  }
}

export const GET = withTiming(handleGET);
export const POST = withTiming(handlePOST);
