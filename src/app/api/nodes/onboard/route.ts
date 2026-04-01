import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';

// ---------------------------------------------------------------------------
// POST /api/nodes/onboard — Register as a node operator
// GET  /api/nodes/onboard — Get current node operator profile
// ---------------------------------------------------------------------------

async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  const node = await prisma.nodeOperator.findUnique({
    where: { userId },
    include: {
      _count: { select: { transactions: true, payouts: true } },
      memoryProfile: true,
    },
  });

  if (!node) {
    return NextResponse.json({ registered: false });
  }

  return NextResponse.json({
    registered: true,
    id: node.id,
    displayName: node.displayName,
    reputationScore: node.reputationScore,
    pendingBalance: Number(node.pendingBalance),
    lifetimeEarned: Number(node.lifetimeEarned),
    totalRequests: node.totalRequests,
    failedRequests: node.failedRequests,
    avgLatencyMs: node.avgLatencyMs,
    isOnline: node.isOnline,
    regions: node.regions,
    privacyTier: node.privacyTier,
    teeAttested: node.teeAttested,
    payoutEnabled: node.payoutEnabled,
    apiEndpoint: node.apiEndpoint,
    maxConcurrent: node.maxConcurrent,
    capabilities: node.capabilities,
    transactionCount: node._count.transactions,
    payoutCount: node._count.payouts,
    createdAt: node.createdAt,
    memoryProfile: node.memoryProfile ? {
      memoryTechnology: node.memoryProfile.memoryTechnology,
      vramCapacityGB: node.memoryProfile.vramCapacityGB,
      memoryBandwidthGBs: node.memoryProfile.memoryBandwidthGBs,
      interconnectType: node.memoryProfile.interconnectType,
      decodeThroughputTps: Number(node.memoryProfile.decodeThroughputTps),
      prefillThroughputTps: Number(node.memoryProfile.prefillThroughputTps),
      maxKvCacheTokens: node.memoryProfile.maxKvCacheTokens,
      kvCacheGBUsed: Number(node.memoryProfile.kvCacheGBUsed),
      kvCacheGBAvailable: Number(node.memoryProfile.kvCacheGBAvailable),
      nodeRole: node.memoryProfile.nodeRole,
      kvSharingEnabled: node.memoryProfile.kvSharingEnabled,
      kvShareBandwidthGBs: node.memoryProfile.kvShareBandwidthGBs,
      lastBenchmarkAt: node.memoryProfile.lastBenchmarkAt?.toISOString() ?? null,
    } : null,
  });
}

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const rl = await rateLimit(`node-onboard:${userId}`, 3, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // Check if already registered
  const existing = await prisma.nodeOperator.findUnique({ where: { userId } });
  if (existing) {
    return NextResponse.json({ error: 'Already registered as node operator' }, { status: 409 });
  }

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const {
    displayName,
    regions = [],
    apiEndpoint,
    maxConcurrent = 4,
    capabilities = {},
    ref,
  } = body;

  if (!displayName || typeof displayName !== 'string' || displayName.length < 2) {
    return NextResponse.json({ error: 'displayName is required (min 2 chars)' }, { status: 400 });
  }

  if (!Array.isArray(regions) || regions.length === 0) {
    return NextResponse.json({ error: 'At least one region is required' }, { status: 400 });
  }

  // Resolve referral if provided
  let referredByNodeId: string | null = null;
  if (ref && typeof ref === 'string') {
    const referrer = await prisma.nodeOperator.findUnique({
      where: { id: ref },
      select: { id: true, userId: true },
    });
    if (referrer && referrer.userId !== userId) {
      referredByNodeId = referrer.id;
    }
  }

  const node = await prisma.nodeOperator.create({
    data: {
      userId,
      displayName: displayName.trim(),
      regions,
      apiEndpoint: apiEndpoint || null,
      maxConcurrent: Math.min(32, Math.max(1, maxConcurrent)),
      capabilities,
      referredByNodeId,
    },
  });

  return NextResponse.json({
    id: node.id,
    displayName: node.displayName,
    reputationScore: node.reputationScore,
    regions: node.regions,
    message: 'Node operator registered. Configure your API endpoint and start heartbeating to go online.',
  }, { status: 201 });
}

// ---------------------------------------------------------------------------
// PATCH /api/nodes/onboard — Update node operator profile (including memory benchmark)
// ---------------------------------------------------------------------------

const VALID_MEMORY_TECH = ['HBM3E', 'HBM3', 'HBM2E', 'GDDR6X', 'GDDR6', 'DDR5', 'UNKNOWN'];
const VALID_INTERCONNECT = ['NVLINK', 'PCIE5', 'PCIE4', 'INFINIBAND', 'ETHERNET'];
const VALID_NODE_ROLES = ['PREFILL_OPTIMISED', 'DECODE_OPTIMISED', 'HYBRID', 'KV_CACHE_SERVER'];

async function handlePATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const rl = await rateLimit(`node-onboard:${userId}`, 10, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const node = await prisma.nodeOperator.findUnique({ where: { userId } });
  if (!node) {
    return NextResponse.json({ error: 'Not registered as node operator' }, { status: 404 });
  }

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { memoryProfile, apiEndpoint, displayName, regions } = body;

  // Update basic profile fields if provided
  const profileUpdates: Record<string, unknown> = {};
  if (typeof apiEndpoint === 'string') profileUpdates.apiEndpoint = apiEndpoint;
  if (typeof displayName === 'string' && displayName.length >= 2) profileUpdates.displayName = displayName.trim();
  if (Array.isArray(regions) && regions.length > 0) profileUpdates.regions = regions;

  if (Object.keys(profileUpdates).length > 0) {
    await prisma.nodeOperator.update({
      where: { id: node.id },
      data: profileUpdates,
    });
  }

  // Update memory profile if provided
  if (memoryProfile && typeof memoryProfile === 'object') {
    const {
      memoryTechnology = 'UNKNOWN',
      vramCapacityGB = 0,
      memoryBandwidthGBs = 0,
      interconnectType = 'ETHERNET',
      decodeThroughputTps = 0,
      prefillThroughputTps = 0,
      maxKvCacheTokens = 0,
      kvCacheGBAvailable = 0,
      nodeRole = 'HYBRID',
      kvSharingEnabled = false,
      kvShareBandwidthGBs = 0,
    } = memoryProfile;

    // Validate enums
    if (!VALID_MEMORY_TECH.includes(memoryTechnology)) {
      return NextResponse.json({ error: `memoryTechnology must be one of: ${VALID_MEMORY_TECH.join(', ')}` }, { status: 400 });
    }
    if (!VALID_INTERCONNECT.includes(interconnectType)) {
      return NextResponse.json({ error: `interconnectType must be one of: ${VALID_INTERCONNECT.join(', ')}` }, { status: 400 });
    }
    if (!VALID_NODE_ROLES.includes(nodeRole)) {
      return NextResponse.json({ error: `nodeRole must be one of: ${VALID_NODE_ROLES.join(', ')}` }, { status: 400 });
    }

    await prisma.nodeMemoryProfile.upsert({
      where: { nodeOperatorId: node.id },
      create: {
        nodeOperatorId: node.id,
        memoryTechnology,
        vramCapacityGB: Math.max(0, Math.round(vramCapacityGB)),
        memoryBandwidthGBs: Math.max(0, Math.round(memoryBandwidthGBs)),
        interconnectType,
        decodeThroughputTps: Math.max(0, decodeThroughputTps),
        prefillThroughputTps: Math.max(0, prefillThroughputTps),
        maxKvCacheTokens: Math.max(0, Math.round(maxKvCacheTokens)),
        kvCacheGBAvailable: Math.max(0, kvCacheGBAvailable),
        nodeRole,
        kvSharingEnabled: Boolean(kvSharingEnabled),
        kvShareBandwidthGBs: Math.max(0, Math.round(kvShareBandwidthGBs)),
        lastBenchmarkAt: new Date(),
      },
      update: {
        memoryTechnology,
        vramCapacityGB: Math.max(0, Math.round(vramCapacityGB)),
        memoryBandwidthGBs: Math.max(0, Math.round(memoryBandwidthGBs)),
        interconnectType,
        decodeThroughputTps: Math.max(0, decodeThroughputTps),
        prefillThroughputTps: Math.max(0, prefillThroughputTps),
        maxKvCacheTokens: Math.max(0, Math.round(maxKvCacheTokens)),
        kvCacheGBAvailable: Math.max(0, kvCacheGBAvailable),
        nodeRole,
        kvSharingEnabled: Boolean(kvSharingEnabled),
        kvShareBandwidthGBs: Math.max(0, Math.round(kvShareBandwidthGBs)),
        lastBenchmarkAt: new Date(),
      },
    });
  }

  return NextResponse.json({ message: 'Node profile updated', nodeId: node.id });
}

export const GET = withTiming(handleGET);
export const POST = withTiming(handlePOST);
export const PATCH = withTiming(handlePATCH);
