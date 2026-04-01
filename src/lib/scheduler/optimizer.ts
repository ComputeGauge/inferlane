// ---------------------------------------------------------------------------
// Prompt Scheduler — Window Optimizer (Stream Z2)
// ---------------------------------------------------------------------------
// Finds the best execution window based on promotions, off-peak pricing,
// and user timezone preferences.
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db';
import { findModelPrice } from '@/lib/pricing/model-prices';
import { getProviderFromModel } from './engine';

// -- Inline types --

interface OptimalWindow {
  executeAt: Date;
  reason: string;
  estimatedSavings: number;
  promotionId?: string;
}

interface CostMultiplierResult {
  multiplier: number;
  promotionId?: string;
}

interface PromotionWindow {
  startsAt: Date;
  endsAt: Date;
  multiplier: number;
  promotionId: string;
}

interface WindowOption {
  executeAt: Date;
  multiplier: number;
  reason: string;
  promotionId?: string;
}

// ---------------------------------------------------------------------------
// 1. Find optimal execution window
// ---------------------------------------------------------------------------

export async function findOptimalWindow(
  userId: string,
  model: string,
  estimatedTokens: number,
): Promise<OptimalWindow> {
  const provider = getProviderFromModel(model);
  const price = findModelPrice(model);
  const now = new Date();

  // Estimate base cost (assume 50/50 input/output split if not specified)
  const inputTokens = Math.ceil(estimatedTokens * 0.5);
  const outputTokens = Math.ceil(estimatedTokens * 0.5);
  const baseCostUsd = price
    ? (inputTokens / 1_000_000) * price.inputPerMToken +
      (outputTokens / 1_000_000) * price.outputPerMToken
    : 0;

  // Check current cost multiplier
  const currentMult = await getCurrentCostMultiplier(provider);

  // If we already have a good multiplier right now, execute immediately
  if (currentMult.multiplier > 1) {
    const savings = baseCostUsd - baseCostUsd / currentMult.multiplier;
    return {
      executeAt: now,
      reason: `Active promotion with ${currentMult.multiplier}x multiplier`,
      estimatedSavings: Math.round(savings * 10000) / 10000,
      promotionId: currentMult.promotionId,
    };
  }

  // Check upcoming promotion windows
  const nextWindow = await getNextPromotionWindow(provider);

  // Check off-peak windows
  const timezone = 'America/New_York'; // default
  const nextOffPeak = getNextOffPeakStart(now, timezone);

  // Build candidate windows
  const windows: WindowOption[] = [];

  if (nextWindow) {
    windows.push({
      executeAt: nextWindow.startsAt,
      multiplier: nextWindow.multiplier,
      reason: `Upcoming promotion (${nextWindow.multiplier}x multiplier)`,
      promotionId: nextWindow.promotionId,
    });
  }

  if (nextOffPeak) {
    windows.push({
      executeAt: nextOffPeak,
      multiplier: 1.0,
      reason: 'Off-peak window (lower contention, potentially faster)',
    });
  }

  // Always include "now" as an option
  windows.push({
    executeAt: now,
    multiplier: 1.0,
    reason: 'Execute immediately at current pricing',
  });

  // Rank by cost efficiency
  const ranked = rankExecutionWindows(windows);
  const best = ranked[0];

  const savings = best.multiplier > 1
    ? baseCostUsd - baseCostUsd / best.multiplier
    : 0;

  return {
    executeAt: best.executeAt,
    reason: best.reason,
    estimatedSavings: Math.round(savings * 10000) / 10000,
    promotionId: best.promotionId,
  };
}

// ---------------------------------------------------------------------------
// 2. Current cost multiplier for a provider
// ---------------------------------------------------------------------------

export async function getCurrentCostMultiplier(
  provider: string,
): Promise<CostMultiplierResult> {
  const now = new Date();

  const promotions = await prisma.providerPromotion.findMany({
    where: {
      provider,
      status: 'ACTIVE',
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    orderBy: { multiplier: 'desc' },
  });

  for (const promo of promotions) {
    if (promo.offPeakOnly) {
      // Check if we're currently in off-peak hours
      const tz = promo.peakTimezone || 'America/New_York';
      const peakStart = parseInt(promo.peakHoursStart || '8', 10);
      const peakEnd = parseInt(promo.peakHoursEnd || '18', 10);
      const currentHour = getHourInTimezone(now, tz);

      if (currentHour >= peakStart && currentHour < peakEnd) {
        // Currently in peak hours — this promo doesn't apply
        continue;
      }
    }

    return { multiplier: promo.multiplier, promotionId: promo.id };
  }

  return { multiplier: 1.0 };
}

// ---------------------------------------------------------------------------
// 3. Next promotion window
// ---------------------------------------------------------------------------

export async function getNextPromotionWindow(
  provider: string,
): Promise<PromotionWindow | null> {
  const now = new Date();

  // Find upcoming promotions
  const upcoming = await prisma.providerPromotion.findFirst({
    where: {
      provider,
      status: { in: ['ACTIVE', 'UPCOMING'] },
      endsAt: { gt: now },
      multiplier: { gt: 1 },
    },
    orderBy: { startsAt: 'asc' },
  });

  if (!upcoming) return null;

  // If the promotion is already active but off-peak-only, find next off-peak window
  if (upcoming.offPeakOnly && upcoming.startsAt <= now) {
    const tz = upcoming.peakTimezone || 'America/New_York';
    const peakEnd = parseInt(upcoming.peakHoursEnd || '18', 10);
    const currentHour = getHourInTimezone(now, tz);

    if (currentHour >= parseInt(upcoming.peakHoursStart || '8', 10) && currentHour < peakEnd) {
      // Currently in peak — next off-peak starts at peakEnd today
      const nextStart = new Date(now);
      nextStart.setHours(peakEnd, 0, 0, 0);
      if (nextStart <= now) {
        nextStart.setDate(nextStart.getDate() + 1);
        nextStart.setHours(0, 0, 0, 0);
      }

      return {
        startsAt: nextStart,
        endsAt: upcoming.endsAt,
        multiplier: upcoming.multiplier,
        promotionId: upcoming.id,
      };
    }
  }

  return {
    startsAt: upcoming.startsAt > now ? upcoming.startsAt : now,
    endsAt: upcoming.endsAt,
    multiplier: upcoming.multiplier,
    promotionId: upcoming.id,
  };
}

// ---------------------------------------------------------------------------
// 4. Rank execution windows by cost efficiency
// ---------------------------------------------------------------------------

export function rankExecutionWindows(options: WindowOption[]): WindowOption[] {
  return [...options].sort((a, b) => {
    // Higher multiplier = better savings → sort descending
    if (b.multiplier !== a.multiplier) return b.multiplier - a.multiplier;

    // Tie-break: sooner is better
    return a.executeAt.getTime() - b.executeAt.getTime();
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNextOffPeakStart(now: Date, timezone: string): Date {
  const currentHour = getHourInTimezone(now, timezone);

  // Off-peak: before 8AM or after 6PM
  if (currentHour < 8 || currentHour >= 18) {
    // Already off-peak — return now
    return now;
  }

  // Next off-peak starts at 6PM today
  const next = new Date(now);
  // Approximate: set to 18:00 in UTC offset. Not perfectly tz-aware but good enough
  // for scheduling within a 5-minute cron window.
  const hoursUntilOffPeak = 18 - currentHour;
  next.setTime(now.getTime() + hoursUntilOffPeak * 3600_000);
  next.setMinutes(0, 0, 0);
  return next;
}

function getHourInTimezone(date: Date, timezone: string): number {
  try {
    const formatted = date.toLocaleString('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    return parseInt(formatted, 10);
  } catch {
    return date.getUTCHours();
  }
}
