// ---------------------------------------------------------------------------
// Smart Queue — Cross-Platform Price Scanning (Stream Z2)
// ---------------------------------------------------------------------------
// Evaluates queued prompts against ALL connected providers to find the
// cheapest execution path. Supports centralized API providers (with
// promotion multipliers) and decentralized node operators.
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db';
import {
  findEquivalents,
  type ModelEquivalent,
} from '@/lib/proxy/model-equivalence';
import { getCurrentCostMultiplier } from '@/lib/scheduler/optimizer';
import { getProviderFromModel } from '@/lib/scheduler/engine';

// ── Types ──────────────────────────────────────────────────────────────────

interface CheapestExecution {
  provider: string;
  model: string;
  costPer1MTokens: number;
  source: 'centralized' | 'decentralized';
  promotionActive: boolean;
  promotionMultiplier?: number;
}

interface SavingsWindowEstimate {
  estimatedCheapestAt: Date;
  estimatedSavingsPercent: number;
  reason: string;
}

interface QueueEvalResult {
  promptId: string;
  action: 'execute' | 'keep_queued';
  chosenProvider?: string;
  chosenModel?: string;
  effectiveCostPer1M?: number;
  bestCurrentPrice?: number;
}

// ── 1. Evaluate all queued prompts for cross-platform price triggers ───────

export async function evaluateQueuedPrompts(): Promise<QueueEvalResult[]> {
  const prompts = await prisma.scheduledPrompt.findMany({
    where: {
      status: 'QUEUED',
      scheduleType: { in: ['PRICE_TRIGGERED', 'OPTIMAL_WINDOW'] },
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  });

  const results: QueueEvalResult[] = [];

  for (const prompt of prompts) {
    const result = await evaluateSinglePrompt(prompt);
    results.push(result);

    // If we found a cheap enough execution path, mark it for execution
    if (result.action === 'execute' && result.chosenProvider && result.chosenModel) {
      await prisma.scheduledPrompt.update({
        where: { id: prompt.id },
        data: {
          status: 'SCHEDULED',
          // Store the chosen cross-platform target so executePrompt() uses it
          parameters: {
            ...(prompt.parameters as Record<string, any> || {}),
            _smartQueueOverride: {
              provider: result.chosenProvider,
              model: result.chosenModel,
              effectiveCostPer1M: result.effectiveCostPer1M,
            },
          },
        },
      });
    }
  }

  return results;
}

async function evaluateSinglePrompt(prompt: any): Promise<QueueEvalResult> {
  const threshold = prompt.priceThreshold as Record<string, any> | null;
  const model = prompt.model as string;
  const userId = prompt.userId as string;

  // Get all equivalent models across providers
  const equivalents = findEquivalents(model);
  if (equivalents.length === 0) {
    return { promptId: prompt.id, action: 'keep_queued' };
  }

  // Get user's connected providers
  const connections = await prisma.providerConnection.findMany({
    where: { userId, isActive: true },
    select: { provider: true },
  });
  const connectedProviders = new Set(connections.map((c: any) => c.provider));

  let cheapest: {
    equivalent: ModelEquivalent;
    effectiveCost: number;
    promotionActive: boolean;
    promotionMultiplier: number;
  } | null = null;

  // Scan centralized providers
  for (const eq of equivalents) {
    if (!connectedProviders.has(eq.provider)) continue;

    const multiplierResult = await getCurrentCostMultiplier(eq.provider);
    const multiplier = multiplierResult.multiplier > 0 ? multiplierResult.multiplier : 1;

    // Effective cost: base price divided by promotion multiplier
    // A 2x multiplier means you get 2x credits, so effective cost is half
    const effectiveInputCost = eq.inputPerMToken / multiplier;
    const effectiveOutputCost = eq.outputPerMToken / multiplier;
    // Weighted cost: input + 3*output (output-heavy weighting)
    const weightedCost = effectiveInputCost + 3 * effectiveOutputCost;

    if (!cheapest || weightedCost < cheapest.effectiveCost) {
      cheapest = {
        equivalent: eq,
        effectiveCost: weightedCost,
        promotionActive: multiplier > 1,
        promotionMultiplier: multiplier,
      };
    }
  }

  // Also check decentralized nodes
  const decentralizedResult = await findDecentralizedPrice(model);
  if (decentralizedResult && (!cheapest || decentralizedResult.weightedCost < cheapest.effectiveCost)) {
    // Decentralized is cheaper — but only if the user has credits
    const creditBalance = await prisma.creditBalance.findUnique({
      where: { userId },
      select: { available: true },
    });

    if (creditBalance && Number(creditBalance.available) > 0) {
      return {
        promptId: prompt.id,
        action: shouldExecute(decentralizedResult.weightedCost, threshold)
          ? 'execute'
          : 'keep_queued',
        chosenProvider: 'DECENTRALIZED',
        chosenModel: model,
        effectiveCostPer1M: decentralizedResult.weightedCost,
        bestCurrentPrice: decentralizedResult.weightedCost,
      };
    }
  }

  if (!cheapest) {
    return { promptId: prompt.id, action: 'keep_queued' };
  }

  const execute = shouldExecute(cheapest.effectiveCost, threshold);

  return {
    promptId: prompt.id,
    action: execute ? 'execute' : 'keep_queued',
    chosenProvider: cheapest.equivalent.provider,
    chosenModel: cheapest.equivalent.model,
    effectiveCostPer1M: cheapest.effectiveCost,
    bestCurrentPrice: cheapest.effectiveCost,
  };
}

function shouldExecute(
  effectiveCost: number,
  threshold: Record<string, any> | null,
): boolean {
  if (!threshold) return false;

  // threshold.maxWeightedCostPer1M — the user's maximum acceptable weighted cost
  if (threshold.maxWeightedCostPer1M != null) {
    return effectiveCost <= threshold.maxWeightedCostPer1M;
  }

  // Legacy: threshold.maxInputPerMToken / maxOutputPerMToken
  // Convert to a rough weighted check
  if (threshold.maxInputPerMToken != null) {
    const maxWeighted = threshold.maxInputPerMToken + 3 * (threshold.maxOutputPerMToken || threshold.maxInputPerMToken * 4);
    return effectiveCost <= maxWeighted;
  }

  return false;
}

// ── 2. Find cheapest execution across all sources ──────────────────────────

export async function findCheapestExecution(
  model: string,
  userId: string,
): Promise<CheapestExecution | null> {
  const equivalents = findEquivalents(model);
  if (equivalents.length === 0) return null;

  // Get user's connected providers
  const connections = await prisma.providerConnection.findMany({
    where: { userId, isActive: true },
    select: { provider: true },
  });
  const connectedProviders = new Set(connections.map((c: any) => c.provider));

  let best: CheapestExecution | null = null;
  let bestWeightedCost = Infinity;

  // Check centralized providers with promotions
  for (const eq of equivalents) {
    if (!connectedProviders.has(eq.provider)) continue;

    const multiplierResult = await getCurrentCostMultiplier(eq.provider);
    const multiplier = multiplierResult.multiplier > 0 ? multiplierResult.multiplier : 1;

    const effectiveInputCost = eq.inputPerMToken / multiplier;
    const effectiveOutputCost = eq.outputPerMToken / multiplier;
    const weightedCost = effectiveInputCost + 3 * effectiveOutputCost;

    if (weightedCost < bestWeightedCost) {
      bestWeightedCost = weightedCost;
      best = {
        provider: eq.provider,
        model: eq.model,
        costPer1MTokens: effectiveInputCost, // input cost as reference
        source: 'centralized',
        promotionActive: multiplier > 1,
        promotionMultiplier: multiplier,
      };
    }
  }

  // Check decentralized nodes
  const decentralized = await findDecentralizedPrice(model);
  if (decentralized && decentralized.weightedCost < bestWeightedCost) {
    best = {
      provider: 'DECENTRALIZED',
      model,
      costPer1MTokens: decentralized.inputPer1M,
      source: 'decentralized',
      promotionActive: false,
    };
  }

  return best;
}

// ── 3. Estimate next savings window ────────────────────────────────────────

export async function estimateSavingsWindow(
  model: string,
): Promise<SavingsWindowEstimate> {
  const provider = getProviderFromModel(model);
  const now = new Date();

  // Check upcoming promotions
  const upcomingPromo = await prisma.providerPromotion.findFirst({
    where: {
      provider,
      status: 'ACTIVE',
      startsAt: { gt: now },
    },
    orderBy: { startsAt: 'asc' },
  });

  if (upcomingPromo) {
    const savingsPercent = upcomingPromo.multiplier > 1
      ? Math.round((1 - 1 / upcomingPromo.multiplier) * 100)
      : 0;

    return {
      estimatedCheapestAt: upcomingPromo.startsAt,
      estimatedSavingsPercent: savingsPercent,
      reason: `Upcoming ${provider} promotion: "${upcomingPromo.title}" (${upcomingPromo.multiplier}x credits)`,
    };
  }

  // Check historical promotion patterns for this provider
  const pastPromos = await prisma.providerPromotion.findMany({
    where: { provider },
    orderBy: { startsAt: 'desc' },
    take: 10,
  });

  if (pastPromos.length >= 2) {
    // Estimate average interval between promotions
    const intervals: number[] = [];
    for (let i = 0; i < pastPromos.length - 1; i++) {
      const diff = pastPromos[i].startsAt.getTime() - pastPromos[i + 1].startsAt.getTime();
      intervals.push(diff);
    }
    const avgIntervalMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const lastPromoEnd = pastPromos[0].endsAt;
    const estimatedNext = new Date(lastPromoEnd.getTime() + avgIntervalMs);

    const avgMultiplier = pastPromos.reduce((sum, p) => sum + p.multiplier, 0) / pastPromos.length;
    const estimatedSavings = Math.round((1 - 1 / avgMultiplier) * 100);

    if (estimatedNext > now) {
      return {
        estimatedCheapestAt: estimatedNext,
        estimatedSavingsPercent: estimatedSavings,
        reason: `Based on ${pastPromos.length} historical ${provider} promotions (avg interval: ${Math.round(avgIntervalMs / 86400000)}d)`,
      };
    }
  }

  // Fallback: next off-peak window (before 8am or after 6pm ET)
  const etHour = getHourInTimezone(now, 'America/New_York');
  let nextOffPeak: Date;
  if (etHour >= 8 && etHour < 18) {
    // Currently peak — next off-peak is today at 6pm ET
    nextOffPeak = new Date(now);
    nextOffPeak.setHours(nextOffPeak.getHours() + (18 - etHour));
  } else {
    // Already off-peak
    nextOffPeak = now;
  }

  return {
    estimatedCheapestAt: nextOffPeak,
    estimatedSavingsPercent: 10, // Rough estimate for off-peak savings
    reason: 'Off-peak hours (before 8am / after 6pm ET) typically have lower latency and occasional spot pricing',
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function findDecentralizedPrice(
  model: string,
): Promise<{ inputPer1M: number; outputPer1M: number; weightedCost: number } | null> {
  // Find online nodes that support this model
  const nodes = await prisma.nodeOperator.findMany({
    where: {
      isOnline: true,
      reputationScore: { gte: 30 },
    },
    select: {
      capabilities: true,
    },
    take: 20,
  });

  if (nodes.length === 0) return null;

  // Check if any node lists pricing for this model in capabilities
  for (const node of nodes) {
    const caps = node.capabilities as Record<string, any>;
    const modelPricing = caps?.pricing?.[model] || caps?.pricing?.default;
    if (modelPricing) {
      return {
        inputPer1M: modelPricing.inputPerMToken || 0,
        outputPer1M: modelPricing.outputPerMToken || 0,
        weightedCost: (modelPricing.inputPerMToken || 0) + 3 * (modelPricing.outputPerMToken || 0),
      };
    }
  }

  return null;
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
