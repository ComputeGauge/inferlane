// ---------------------------------------------------------------------------
// KV Cache Registry & P2P Sharing Protocol (Stream W4)
// ---------------------------------------------------------------------------
// Enables decentralised nodes to register, share, and trade KV cache
// segments for distributed long-context inference.
//
// The KV cache is the key data structure in transformer inference:
// - Generated during prefill (prompt ingestion)
// - Read sequentially during decode (token generation)
// - Size scales linearly with context length
// - Stored in expensive HBM — scarce resource
//
// P2P sharing enables:
// - Reduced redundant prefill: if another node already processed a prompt,
//   share the KV cache instead of recomputing
// - Distributed long-context: shard 100K+ token caches across nodes
// - Cache marketplace: nodes earn by serving cached KV data
//
// Revenue: 15% platform take on all KV cache transactions.
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db';
import { createHash } from 'crypto';
import { calculateKvCacheCost } from '@/lib/pricing/decode-pricing';

// ── Constants ────────────────────────────────────────────────────────────

export const KV_CACHE_CONFIG = {
  /** Default cache TTL in hours (nodes can override) */
  defaultTtlHours: 24,
  /** Maximum cache TTL */
  maxTtlHours: 168, // 7 days
  /** Minimum cache size worth registering (GB) */
  minCacheSizeGB: 0.001, // ~1MB
  /** Maximum entries per node */
  maxEntriesPerNode: 100,
  /** Platform take rate on cache transfers */
  platformTakeRate: 0.15,
  /** Stale cache cleanup: entries not accessed in this many hours */
  staleAccessHours: 12,
} as const;

// ── Types ────────────────────────────────────────────────────────────────

export interface RegisterCacheInput {
  nodeOperatorId: string;
  modelId: string;
  promptContent: string;  // raw prompt to hash
  tokenRangeStart?: number;
  tokenRangeEnd: number;
  cacheSizeGB: number;
  ttlHours?: number;
  pricePerGBHour?: number;
}

export interface CacheLookupResult {
  found: boolean;
  entries: Array<{
    id: string;
    nodeOperatorId: string;
    tokenRangeStart: number;
    tokenRangeEnd: number;
    cacheSizeGB: number;
    status: string;
    pricePerGBHour: number;
  }>;
  totalCoverage: number;  // percentage of requested context covered
}

export interface TransferResult {
  transferId: string;
  costUsd: number;
  platformFeeUsd: number;
  estimatedTransferMs: number;
}

// ── Cache Registration ──────────────────────────────────────────────────

/**
 * Register a KV cache entry for a node.
 *
 * After a node completes prefill for a prompt, it registers the resulting
 * KV cache so other nodes can request it instead of recomputing.
 */
export async function registerKvCache(input: RegisterCacheInput): Promise<{ entryId: string }> {
  // Validate
  if (input.cacheSizeGB < KV_CACHE_CONFIG.minCacheSizeGB) {
    throw new Error(`Cache too small: ${input.cacheSizeGB}GB (min ${KV_CACHE_CONFIG.minCacheSizeGB}GB)`);
  }

  const ttlHours = Math.min(
    input.ttlHours ?? KV_CACHE_CONFIG.defaultTtlHours,
    KV_CACHE_CONFIG.maxTtlHours,
  );

  // Check node entry limit
  const existingCount = await prisma.kvCacheEntry.count({
    where: { nodeOperatorId: input.nodeOperatorId, status: { in: ['WARM', 'COLD'] } },
  });
  if (existingCount >= KV_CACHE_CONFIG.maxEntriesPerNode) {
    throw new Error(`Node has ${existingCount} cache entries (max ${KV_CACHE_CONFIG.maxEntriesPerNode})`);
  }

  // Hash the prompt for lookup matching
  const promptHash = createHash('sha256').update(input.promptContent).digest('hex');

  const entry = await prisma.kvCacheEntry.upsert({
    where: {
      nodeOperatorId_modelId_promptHash: {
        nodeOperatorId: input.nodeOperatorId,
        modelId: input.modelId,
        promptHash,
      },
    },
    update: {
      tokenRangeEnd: input.tokenRangeEnd,
      cacheSizeGB: input.cacheSizeGB,
      status: 'WARM',
      lastAccessedAt: new Date(),
      expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
      pricePerGBHour: input.pricePerGBHour ?? 0.01,
    },
    create: {
      nodeOperatorId: input.nodeOperatorId,
      modelId: input.modelId,
      promptHash,
      tokenRangeStart: input.tokenRangeStart ?? 0,
      tokenRangeEnd: input.tokenRangeEnd,
      cacheSizeGB: input.cacheSizeGB,
      status: 'WARM',
      pricePerGBHour: input.pricePerGBHour ?? 0.01,
      expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
    },
  });

  return { entryId: entry.id };
}

// ── Cache Lookup ────────────────────────────────────────────────────────

/**
 * Look up available KV cache entries for a given prompt and model.
 *
 * Before dispatching prefill to a node, check if any node already has
 * the KV cache. If so, route decode to that node (or transfer the cache).
 */
export async function lookupKvCache(
  modelId: string,
  promptContent: string,
): Promise<CacheLookupResult> {
  const promptHash = createHash('sha256').update(promptContent).digest('hex');

  const entries = await prisma.kvCacheEntry.findMany({
    where: {
      modelId,
      promptHash,
      status: { in: ['WARM', 'COLD'] },
      expiresAt: { gt: new Date() },
    },
    include: {
      nodeOperator: {
        select: { isOnline: true, reputationScore: true },
      },
    },
    orderBy: [
      { status: 'asc' }, // WARM before COLD
      { tokenRangeEnd: 'desc' }, // Most coverage first
    ],
  });

  // Filter to online nodes with good reputation
  const validEntries = entries
    .filter((e) => e.nodeOperator.isOnline && e.nodeOperator.reputationScore >= 30)
    .map((e) => ({
      id: e.id,
      nodeOperatorId: e.nodeOperatorId,
      tokenRangeStart: e.tokenRangeStart,
      tokenRangeEnd: e.tokenRangeEnd,
      cacheSizeGB: Number(e.cacheSizeGB),
      status: e.status,
      pricePerGBHour: Number(e.pricePerGBHour),
    }));

  // Calculate coverage
  const maxTokenEnd = validEntries.reduce((max, e) => Math.max(max, e.tokenRangeEnd), 0);
  const estimatedPromptTokens = Math.ceil(promptContent.length / 4);
  const totalCoverage = estimatedPromptTokens > 0
    ? Math.min(1.0, maxTokenEnd / estimatedPromptTokens)
    : 0;

  return {
    found: validEntries.length > 0,
    entries: validEntries,
    totalCoverage,
  };
}

// ── P2P Cache Transfer ──────────────────────────────────────────────────

/**
 * Initiate a P2P KV cache transfer between nodes.
 *
 * When a decode-optimised node needs a KV cache that exists on another
 * node, this creates a transfer record and calculates the cost.
 * The actual data transfer happens at the node level via direct P2P.
 */
export async function initiateTransfer(
  cacheEntryId: string,
  targetNodeId: string,
): Promise<TransferResult> {
  const entry = await prisma.kvCacheEntry.findUnique({
    where: { id: cacheEntryId },
    include: {
      nodeOperator: {
        select: {
          id: true,
          isOnline: true,
          memoryProfile: {
            select: { kvShareBandwidthGBs: true, memoryTechnology: true },
          },
        },
      },
    },
  });

  if (!entry) throw new Error('Cache entry not found');
  if (!entry.nodeOperator.isOnline) throw new Error('Source node is offline');

  const cacheSizeGB = Number(entry.cacheSizeGB);
  const memTech = entry.nodeOperator.memoryProfile?.memoryTechnology ?? 'UNKNOWN';

  // Calculate cost
  const cost = calculateKvCacheCost(cacheSizeGB, 1, memTech); // 1 hour base

  // Estimate transfer time based on P2P bandwidth
  const bandwidthGBs = entry.nodeOperator.memoryProfile?.kvShareBandwidthGBs ?? 1;
  const estimatedTransferMs = Math.ceil((cacheSizeGB / bandwidthGBs) * 1000);

  // Create transfer record
  const transfer = await prisma.kvCacheTransfer.create({
    data: {
      sourceNodeId: entry.nodeOperatorId,
      targetNodeId,
      cacheEntryId,
      transferSizeGB: cacheSizeGB,
      transferTimeMs: estimatedTransferMs,
      costUsd: cost.costUsd,
      platformFeeUsd: cost.platformFee,
      status: 'PENDING',
    },
  });

  // Update cache access time
  await prisma.kvCacheEntry.update({
    where: { id: cacheEntryId },
    data: { lastAccessedAt: new Date() },
  });

  return {
    transferId: transfer.id,
    costUsd: cost.costUsd,
    platformFeeUsd: cost.platformFee,
    estimatedTransferMs,
  };
}

// ── Cache Cleanup ───────────────────────────────────────────────────────

/**
 * Evict expired and stale cache entries.
 * Called by cron job.
 */
export async function evictStaleCaches(): Promise<{ expired: number; stale: number }> {
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - KV_CACHE_CONFIG.staleAccessHours * 60 * 60 * 1000);

  // Mark expired entries
  const expiredResult = await prisma.kvCacheEntry.updateMany({
    where: {
      expiresAt: { lt: now },
      status: { in: ['WARM', 'COLD'] },
    },
    data: { status: 'EXPIRED' },
  });

  // Mark stale (not accessed recently) as COLD
  const staleResult = await prisma.kvCacheEntry.updateMany({
    where: {
      lastAccessedAt: { lt: staleCutoff },
      status: 'WARM',
    },
    data: { status: 'COLD' },
  });

  // Delete old expired entries (>24h past expiry)
  const deleteCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  await prisma.kvCacheEntry.deleteMany({
    where: {
      status: 'EXPIRED',
      expiresAt: { lt: deleteCutoff },
    },
  });

  return {
    expired: expiredResult.count,
    stale: staleResult.count,
  };
}

// ── Cache Stats ─────────────────────────────────────────────────────────

/**
 * Get aggregate KV cache statistics for the platform.
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  warmEntries: number;
  coldEntries: number;
  totalCacheSizeGB: number;
  totalTransfers: number;
  totalRevenueUsd: number;
}> {
  const [warm, cold, totalSize, transferStats] = await Promise.all([
    prisma.kvCacheEntry.count({ where: { status: 'WARM' } }),
    prisma.kvCacheEntry.count({ where: { status: 'COLD' } }),
    prisma.kvCacheEntry.aggregate({
      where: { status: { in: ['WARM', 'COLD'] } },
      _sum: { cacheSizeGB: true },
    }),
    prisma.kvCacheTransfer.aggregate({
      where: { status: 'COMPLETED' },
      _count: true,
      _sum: { platformFeeUsd: true },
    }),
  ]);

  return {
    totalEntries: warm + cold,
    warmEntries: warm,
    coldEntries: cold,
    totalCacheSizeGB: Number(totalSize._sum.cacheSizeGB ?? 0),
    totalTransfers: transferStats._count,
    totalRevenueUsd: Number(transferStats._sum.platformFeeUsd ?? 0),
  };
}
