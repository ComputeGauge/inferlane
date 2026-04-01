// ---------------------------------------------------------------------------
// Compute Price Indices (Stream V)
// ---------------------------------------------------------------------------
// Aggregated pricing indices across the compute marketplace.
// Four tier-specific indices plus a composite.
//
// Indices are updated hourly from recent order fills and provide:
// - Current spot price per quality tier
// - 24h volume, high, low, change
// - Historical snapshots for charting
//
// Third-party platforms use these as reference prices for derivatives,
// prediction markets, and arbitrage signals.
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db';
import { valuateDecodeCapacity, valuateMemoryBandwidth } from '@/lib/pricing/decode-pricing';

// ── Index Definitions ────────────────────────────────────────────────────

export const INDEX_DEFINITIONS = [
  {
    name: 'IL-FRONTIER',
    description: 'Frontier compute price index (GPT-4o, Claude Opus, Gemini Ultra)',
    qualityTier: 'FRONTIER' as const,
  },
  {
    name: 'IL-STANDARD',
    description: 'Standard compute price index (Sonnet, GPT-4o-mini, Gemini Pro)',
    qualityTier: 'STANDARD' as const,
  },
  {
    name: 'IL-ECONOMY',
    description: 'Economy compute price index (Mixtral, Llama, DeepSeek)',
    qualityTier: 'ECONOMY' as const,
  },
  {
    name: 'IL-OPENWEIGHT',
    description: 'Open-weight compute price index (self-hosted models)',
    qualityTier: 'OPEN_WEIGHT' as const,
  },
  // --- Stream W additions: Memory & Decode Indices ---
  {
    name: 'IL-DECODE',
    description: 'Decode throughput price index (tokens/sec capacity, memory-bandwidth-bound)',
    qualityTier: 'FRONTIER' as const, // Uses FRONTIER as proxy tier for index grouping
  },
  {
    name: 'IL-MEMORY',
    description: 'Memory bandwidth price index (GB/s capacity for inference)',
    qualityTier: 'STANDARD' as const, // Uses STANDARD as proxy tier for index grouping
  },
];

// ── Default Prices (bootstrap values) ────────────────────────────────────

const DEFAULT_PRICES: Record<string, number> = {
  FRONTIER: 0.95,
  STANDARD: 0.75,
  ECONOMY: 0.50,
  OPEN_WEIGHT: 0.35,
  // Stream W: decode & memory bootstrap values
  // IL-DECODE: $/1K tokens/sec of decode capacity per hour
  'IL-DECODE': 0.15,
  // IL-MEMORY: $/GB/s of memory bandwidth per hour
  'IL-MEMORY': 0.08,
};

// ── Index Update ─────────────────────────────────────────────────────────

/**
 * Update all compute indices from recent fills.
 * Called by hourly cron.
 */
export async function updateIndices(): Promise<{
  updated: number;
  snapshots: number;
}> {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  let updated = 0;
  let snapshots = 0;

  // ── Special-case: IL-DECODE and IL-MEMORY from node memory profiles ──
  // These indices are derived from actual node hardware data, not order fills.
  const MEMORY_INDICES = new Set(['IL-DECODE', 'IL-MEMORY']);

  for (const def of INDEX_DEFINITIONS) {
    if (MEMORY_INDICES.has(def.name)) {
      // Query online nodes with memory profile data
      const profiles = await prisma.nodeMemoryProfile.findMany({
        where: {
          nodeOperator: { isOnline: true },
        },
        select: {
          decodeThroughputTps: true,
          memoryBandwidthGBs: true,
          memoryTechnology: true,
        },
      });

      let currentValue: number;
      let volume24hUsd = 0;

      if (def.name === 'IL-DECODE') {
        // Throughput-weighted average hourlyValue from decode capacity
        let totalWeight = 0;
        let weightedSum = 0;

        for (const p of profiles) {
          const tps = Number(p.decodeThroughputTps);
          const bw = Number(p.memoryBandwidthGBs);
          if (tps <= 0) continue;

          const valuation = valuateDecodeCapacity(tps, bw, p.memoryTechnology);
          weightedSum += valuation.hourlyValue * tps;
          totalWeight += tps;
          volume24hUsd += valuation.hourlyValue * 24;
        }

        currentValue = totalWeight > 0
          ? weightedSum / totalWeight
          : DEFAULT_PRICES['IL-DECODE'] ?? 0.15;
      } else {
        // IL-MEMORY: bandwidth-weighted average hourlyValue
        let totalWeight = 0;
        let weightedSum = 0;

        for (const p of profiles) {
          const bw = Number(p.memoryBandwidthGBs);
          if (bw <= 0) continue;

          const valuation = valuateMemoryBandwidth(bw, p.memoryTechnology);
          weightedSum += valuation.hourlyValue * bw;
          totalWeight += bw;
          volume24hUsd += valuation.hourlyValue * 24;
        }

        currentValue = totalWeight > 0
          ? weightedSum / totalWeight
          : DEFAULT_PRICES['IL-MEMORY'] ?? 0.08;
      }

      // Get previous value for change calculation
      const existingIndex = await prisma.computeIndex.findUnique({
        where: { name: def.name },
      });

      const previousValue = existingIndex ? Number(existingIndex.currentValue) : currentValue;
      const change24h = currentValue - previousValue;
      const changePct24h = previousValue > 0 ? (change24h / previousValue) * 100 : 0;

      await prisma.computeIndex.upsert({
        where: { name: def.name },
        create: {
          name: def.name,
          description: def.description,
          qualityTier: def.qualityTier,
          currentValue,
          change24h,
          changePct24h,
          volume24hUsd,
          high24h: currentValue,
          low24h: currentValue,
          dataPoints: profiles.length,
        },
        update: {
          currentValue,
          change24h,
          changePct24h,
          volume24hUsd,
          high24h: currentValue,
          low24h: currentValue,
          dataPoints: profiles.length,
        },
      });

      updated++;

      // Create snapshot
      const index = await prisma.computeIndex.findUnique({ where: { name: def.name } });
      if (index) {
        await prisma.indexSnapshot.create({
          data: {
            indexId: index.id,
            value: currentValue,
            volumeUsd: volume24hUsd,
          },
        });
        snapshots++;
      }

      continue; // Skip the order-fill path below
    }

    // Get 24h fills for this tier
    const fills = await prisma.orderFill.findMany({
      where: {
        createdAt: { gte: twentyFourHoursAgo },
        buyOrder: { qualityTier: def.qualityTier },
      },
      select: {
        pricePerUnit: true,
        quantity: true,
        totalUsd: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate VWAP (volume-weighted average price)
    let totalVolume = 0;
    let weightedSum = 0;
    let high24h = 0;
    let low24h = Infinity;
    let volume24hUsd = 0;

    for (const fill of fills) {
      const price = Number(fill.pricePerUnit);
      const qty = Number(fill.quantity);
      const usd = Number(fill.totalUsd);

      weightedSum += price * qty;
      totalVolume += qty;
      volume24hUsd += usd;
      high24h = Math.max(high24h, price);
      low24h = Math.min(low24h, price);
    }

    const currentValue = totalVolume > 0
      ? weightedSum / totalVolume
      : DEFAULT_PRICES[def.name] ?? DEFAULT_PRICES[def.qualityTier] ?? 0.50;

    if (low24h === Infinity) low24h = currentValue;

    // Get previous value for change calculation
    const existingIndex = await prisma.computeIndex.findUnique({
      where: { name: def.name },
    });

    const previousValue = existingIndex ? Number(existingIndex.currentValue) : currentValue;
    const change24h = currentValue - previousValue;
    const changePct24h = previousValue > 0 ? (change24h / previousValue) * 100 : 0;

    // Upsert index
    await prisma.computeIndex.upsert({
      where: { name: def.name },
      create: {
        name: def.name,
        description: def.description,
        qualityTier: def.qualityTier,
        currentValue,
        change24h,
        changePct24h,
        volume24hUsd,
        high24h: high24h || currentValue,
        low24h,
        dataPoints: fills.length,
      },
      update: {
        currentValue,
        change24h,
        changePct24h,
        volume24hUsd,
        high24h: high24h || currentValue,
        low24h,
        dataPoints: fills.length,
      },
    });

    updated++;

    // Create snapshot for historical charting
    const index = await prisma.computeIndex.findUnique({ where: { name: def.name } });
    if (index) {
      await prisma.indexSnapshot.create({
        data: {
          indexId: index.id,
          value: currentValue,
          volumeUsd: volume24hUsd,
        },
      });
      snapshots++;
    }
  }

  return { updated, snapshots };
}

/**
 * Get all current index values.
 */
export async function getCurrentIndices() {
  const indices = await prisma.computeIndex.findMany({
    orderBy: { name: 'asc' },
  });

  // If no indices exist yet, return defaults
  if (indices.length === 0) {
    return INDEX_DEFINITIONS.map((def) => {
      const defaultValue = DEFAULT_PRICES[def.name] ?? DEFAULT_PRICES[def.qualityTier] ?? 0.50;
      return {
        name: def.name,
        description: def.description,
        qualityTier: def.qualityTier,
        currentValue: defaultValue,
        change24h: 0,
        changePct24h: 0,
        volume24hUsd: 0,
        high24h: defaultValue,
        low24h: defaultValue,
        dataPoints: 0,
      };
    });
  }

  return indices.map((idx) => ({
    name: idx.name,
    description: idx.description,
    qualityTier: idx.qualityTier,
    currentValue: Number(idx.currentValue),
    change24h: Number(idx.change24h),
    changePct24h: Number(idx.changePct24h),
    volume24hUsd: Number(idx.volume24hUsd),
    high24h: Number(idx.high24h),
    low24h: Number(idx.low24h),
    dataPoints: idx.dataPoints,
  }));
}

/**
 * Get historical snapshots for a specific index.
 */
export async function getIndexHistory(
  indexName: string,
  days: number = 30,
): Promise<Array<{ value: number; volumeUsd: number; snapshotAt: Date }>> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const index = await prisma.computeIndex.findUnique({
    where: { name: indexName },
  });

  if (!index) return [];

  const snapshots = await prisma.indexSnapshot.findMany({
    where: {
      indexId: index.id,
      snapshotAt: { gte: cutoff },
    },
    orderBy: { snapshotAt: 'asc' },
  });

  return snapshots.map((s) => ({
    value: Number(s.value),
    volumeUsd: Number(s.volumeUsd),
    snapshotAt: s.snapshotAt,
  }));
}
