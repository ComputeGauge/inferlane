// ---------------------------------------------------------------------------
// Triage Engine — Intelligent Prompt Assessment, Routing & Scheduling
// ---------------------------------------------------------------------------
// Sits between the user writing a prompt and the dispatch system executing it.
// Auto-assesses importance/urgency, auto-routes to best platform/provider,
// and auto-schedules based on prompt content + user preferences + market state.
// ---------------------------------------------------------------------------

import { requestClassifier, type Tier } from '@/lib/proxy/request-classifier';
import { universalDispatcher, type DispatchResult } from './universal-dispatch';
import { findModelPrice, MODEL_PRICES, type ModelPrice } from '@/lib/pricing/model-prices';
import { prisma } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TriageInput {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  userPreferences?: TriagePreferences;
  sessionId?: string;
}

export interface TriagePreferences {
  mode: 'manual' | 'auto_triage' | 'auto_full';
  costSensitivity: 'minimum' | 'balanced' | 'quality_first';
  maxCostPerPrompt?: number;
  preferDecentralized: boolean;
  allowBatchDefer: boolean;
  quietHoursStart?: number;
  quietHoursEnd?: number;
  priorityKeywords?: string[];
  batchKeywords?: string[];
}

export interface TriageResult {
  // Classification
  importance: 'critical' | 'high' | 'standard' | 'low' | 'batch';
  urgency: 'immediate' | 'soon' | 'flexible' | 'whenever';
  complexity: 'trivial' | 'standard' | 'complex' | 'reasoning';

  // Routing decision
  recommendedPlatform: 'centralized' | 'decentralized' | 'either';
  recommendedProvider?: string;
  recommendedModel?: string;
  recommendedTier: Tier;

  // Scheduling decision
  executionMode: 'immediate' | 'scheduled' | 'batch' | 'price_triggered';
  scheduledFor?: Date;
  reason: string;

  // Cost analysis
  estimatedCostUsd: number;
  cheapestOptionCostUsd: number;
  potentialSavingsUsd: number;
  potentialSavingsPercent: number;

  // Confidence
  confidence: number;
  classifierScores: Record<string, number>;
  agenticScore: number;
}

// ---------------------------------------------------------------------------
// Default keyword lists
// ---------------------------------------------------------------------------

const DEFAULT_PRIORITY_KEYWORDS = [
  'urgent', 'critical', 'production', 'hotfix', 'asap',
  'immediately', 'deadline', 'blocking', 'broken',
];

const DEFAULT_BATCH_KEYWORDS = [
  'when you get a chance', 'low priority', 'no rush', 'batch',
  'whenever', 'eventually', 'not urgent', 'backlog',
];

// ---------------------------------------------------------------------------
// Model recommendation map (tier -> recommended model)
// ---------------------------------------------------------------------------

import { LATEST_SONNET, LATEST_OPUS, LATEST_HAIKU } from '@/lib/providers/anthropic-models';

const TIER_MODEL_MAP: Record<Tier, { provider: string; model: string }> = {
  BYPASS:    { provider: 'BYPASS',    model: 'bypass' },
  TRIVIAL:   { provider: 'GROQ',      model: 'llama-3.3-70b' },
  STANDARD:  { provider: 'ANTHROPIC', model: LATEST_HAIKU },
  COMPLEX:   { provider: 'ANTHROPIC', model: LATEST_SONNET },
  REASONING: { provider: 'ANTHROPIC', model: LATEST_OPUS },
};

const QUALITY_TIER_MODEL_MAP: Record<Tier, { provider: string; model: string }> = {
  BYPASS:    { provider: 'BYPASS',    model: 'bypass' },
  TRIVIAL:   { provider: 'ANTHROPIC', model: LATEST_HAIKU },
  STANDARD:  { provider: 'ANTHROPIC', model: LATEST_SONNET },
  COMPLEX:   { provider: 'ANTHROPIC', model: LATEST_OPUS },
  REASONING: { provider: 'ANTHROPIC', model: LATEST_OPUS },
};

const CHEAPEST_TIER_MODEL_MAP: Record<Tier, { provider: string; model: string }> = {
  BYPASS:    { provider: 'BYPASS',    model: 'bypass' },
  TRIVIAL:   { provider: 'GOOGLE',   model: 'gemini-2.0-flash' },
  STANDARD:  { provider: 'GROQ',     model: 'mixtral-8x7b' },
  COMPLEX:   { provider: 'DEEPSEEK', model: 'deepseek-v3' },
  REASONING: { provider: 'DEEPSEEK', model: 'deepseek-reasoner' },
};

// ---------------------------------------------------------------------------
// Triage Engine
// ---------------------------------------------------------------------------

class TriageEngine {
  // ── Main entry point ─────────────────────────────────────────────────

  async triage(input: TriageInput): Promise<TriageResult> {
    const prefs = { ...this.getDefaultPreferences(), ...input.userPreferences };
    const priorityKeywords = prefs.priorityKeywords ?? DEFAULT_PRIORITY_KEYWORDS;
    const batchKeywords = prefs.batchKeywords ?? DEFAULT_BATCH_KEYWORDS;

    // 1. Classify the prompt
    const classification = requestClassifier.classify(input.prompt);
    const { tier, confidence, agenticScore, scores } = classification;

    // 2. Assess importance
    const importance = this.assessImportance(
      input.prompt, agenticScore, scores, tier, priorityKeywords, batchKeywords,
    );

    // 3. Assess urgency
    const urgency = this.assessUrgency(importance, prefs, batchKeywords, input.prompt);

    // 4. Decide platform
    const platform = await this.decidePlatform(tier, prefs);

    // 5. Pick model based on tier + cost sensitivity
    const { provider, model } = this.pickModel(tier, prefs);

    // 6. Decide execution mode
    const executionMode = this.decideExecutionMode(urgency, prefs);

    // 7. Estimate costs
    const estimatedTokens = Math.ceil(input.prompt.length / 4);
    const outputTokens = input.maxTokens ?? 4096;
    const { estimatedCostUsd, cheapestOptionCostUsd } = this.estimateCosts(
      model, estimatedTokens, outputTokens, tier,
    );
    const potentialSavingsUsd = Math.max(0, estimatedCostUsd - cheapestOptionCostUsd);
    const potentialSavingsPercent = estimatedCostUsd > 0
      ? Math.round((potentialSavingsUsd / estimatedCostUsd) * 100)
      : 0;

    // 8. Build reason string
    const reason = this.buildReason(
      provider, model, tier, confidence, importance, urgency,
      executionMode, agenticScore, platform, potentialSavingsPercent,
    );

    const complexityMap: Record<Tier, TriageResult['complexity']> = {
      BYPASS: 'trivial', TRIVIAL: 'trivial', STANDARD: 'standard', COMPLEX: 'complex', REASONING: 'reasoning',
    };

    return {
      importance,
      urgency,
      complexity: complexityMap[tier],
      recommendedPlatform: platform,
      recommendedProvider: provider,
      recommendedModel: model,
      recommendedTier: tier,
      executionMode,
      reason,
      estimatedCostUsd,
      cheapestOptionCostUsd,
      potentialSavingsUsd,
      potentialSavingsPercent,
      confidence,
      classifierScores: scores,
      agenticScore,
    };
  }

  // ── Triage + Dispatch convenience ────────────────────────────────────

  async triageAndDispatch(
    input: TriageInput,
    userId: string,
  ): Promise<{ triage: TriageResult; dispatch?: DispatchResult }> {
    const triageResult = await this.triage(input);
    const prefs = { ...this.getDefaultPreferences(), ...input.userPreferences };

    if (prefs.mode === 'auto_full') {
      const dispatch = await universalDispatcher.dispatch(
        {
          prompt: input.prompt,
          model: triageResult.recommendedModel,
          systemPrompt: input.systemPrompt,
          maxTokens: input.maxTokens,
          sessionId: input.sessionId,
          routing: triageResult.recommendedPlatform === 'decentralized'
            ? 'decentralized_only'
            : triageResult.recommendedPlatform === 'centralized'
              ? 'centralized_only'
              : 'auto',
          priority: triageResult.executionMode === 'immediate'
            ? 'realtime'
            : triageResult.executionMode === 'batch'
              ? 'batch'
              : 'standard',
        },
        userId,
      );
      return { triage: triageResult, dispatch };
    }

    // auto_triage or manual: return triage result without executing
    return { triage: triageResult };
  }

  // ── Default preferences ──────────────────────────────────────────────

  getDefaultPreferences(): TriagePreferences {
    return {
      mode: 'auto_triage',
      costSensitivity: 'balanced',
      preferDecentralized: false,
      allowBatchDefer: true,
      priorityKeywords: DEFAULT_PRIORITY_KEYWORDS,
      batchKeywords: DEFAULT_BATCH_KEYWORDS,
    };
  }

  // ── Private: Importance assessment ───────────────────────────────────

  private assessImportance(
    prompt: string,
    agenticScore: number,
    scores: Record<string, number>,
    tier: Tier,
    priorityKeywords: string[],
    batchKeywords: string[],
  ): TriageResult['importance'] {
    const lower = prompt.toLowerCase();

    // Priority keywords → critical or high
    const priorityHits = priorityKeywords.filter(kw => lower.includes(kw.toLowerCase()));
    if (priorityHits.length >= 2) return 'critical';
    if (priorityHits.length === 1) return 'high';

    // Batch keywords → low or batch
    const batchHits = batchKeywords.filter(kw => lower.includes(kw.toLowerCase()));
    if (batchHits.length >= 2) return 'batch';
    if (batchHits.length === 1) return 'low';

    // Agentic + code presence → high (likely a coding task)
    if (agenticScore > 0.6 && (scores.codePresence ?? 0) > 0) return 'high';

    // Simple indicators + low token count → low
    const estimatedTokens = Math.ceil(prompt.length / 4);
    if ((scores.simpleIndicators ?? 0) < -0.3 && estimatedTokens < 100) return 'low';

    return 'standard';
  }

  // ── Private: Urgency assessment ──────────────────────────────────────

  private assessUrgency(
    importance: TriageResult['importance'],
    prefs: TriagePreferences,
    batchKeywords: string[],
    prompt: string,
  ): TriageResult['urgency'] {
    // Critical/high → immediate
    if (importance === 'critical' || importance === 'high') return 'immediate';

    // Quiet hours active + standard/low → flexible/whenever
    if (prefs.quietHoursStart !== undefined && prefs.quietHoursEnd !== undefined) {
      const hour = new Date().getHours();
      const inQuiet = prefs.quietHoursStart < prefs.quietHoursEnd
        ? hour >= prefs.quietHoursStart && hour < prefs.quietHoursEnd
        : hour >= prefs.quietHoursStart || hour < prefs.quietHoursEnd;

      if (inQuiet && (importance === 'standard' || importance === 'low')) {
        return importance === 'low' ? 'whenever' : 'flexible';
      }
    }

    // Batch keywords → whenever
    const lower = prompt.toLowerCase();
    if (batchKeywords.some(kw => lower.includes(kw.toLowerCase()))) return 'whenever';

    // Batch importance → whenever
    if (importance === 'batch') return 'whenever';
    if (importance === 'low') return 'flexible';

    return 'soon';
  }

  // ── Private: Platform decision ───────────────────────────────────────

  private async decidePlatform(
    tier: Tier,
    prefs: TriagePreferences,
  ): Promise<TriageResult['recommendedPlatform']> {
    // REASONING always needs frontier models → centralized
    if (tier === 'REASONING') return 'centralized';

    // Check for online decentralized nodes
    if (prefs.preferDecentralized) {
      try {
        const onlineCount = await prisma.nodeOperator.count({
          where: { isOnline: true },
        });
        if (onlineCount > 0) return 'decentralized';
      } catch {
        // DB unavailable — fall through
      }
    }

    // TRIVIAL + minimum cost → decentralized if nodes exist
    if (tier === 'TRIVIAL' && prefs.costSensitivity === 'minimum') {
      try {
        const onlineCount = await prisma.nodeOperator.count({
          where: { isOnline: true },
        });
        if (onlineCount > 0) return 'decentralized';
      } catch {
        // DB unavailable — fall through
      }
    }

    // STANDARD + balanced → either
    if (tier === 'STANDARD' && prefs.costSensitivity === 'balanced') return 'either';

    return 'centralized';
  }

  // ── Private: Model selection ─────────────────────────────────────────

  private pickModel(
    tier: Tier,
    prefs: TriagePreferences,
  ): { provider: string; model: string } {
    switch (prefs.costSensitivity) {
      case 'minimum':
        return CHEAPEST_TIER_MODEL_MAP[tier];
      case 'quality_first':
        return QUALITY_TIER_MODEL_MAP[tier];
      default:
        return TIER_MODEL_MAP[tier];
    }
  }

  // ── Private: Execution mode ──────────────────────────────────────────

  private decideExecutionMode(
    urgency: TriageResult['urgency'],
    prefs: TriagePreferences,
  ): TriageResult['executionMode'] {
    if (urgency === 'immediate') return 'immediate';

    if (urgency === 'flexible' && prefs.allowBatchDefer && prefs.costSensitivity === 'minimum') {
      return 'price_triggered';
    }

    if (urgency === 'whenever') return 'batch';

    return 'immediate';
  }

  // ── Private: Cost estimation ─────────────────────────────────────────

  private estimateCosts(
    model: string,
    estimatedInputTokens: number,
    estimatedOutputTokens: number,
    tier: Tier,
  ): { estimatedCostUsd: number; cheapestOptionCostUsd: number } {
    // Cost at recommended model
    const price = findModelPrice(model);
    const estimatedCostUsd = price
      ? (estimatedInputTokens / 1_000_000) * price.inputPerMToken
        + (estimatedOutputTokens / 1_000_000) * price.outputPerMToken
      : 0;

    // Find cheapest chat model
    const chatModels = MODEL_PRICES.filter(p => p.category === 'chat');
    let cheapestCost = Infinity;
    for (const m of chatModels) {
      const cost = (estimatedInputTokens / 1_000_000) * m.inputPerMToken
        + (estimatedOutputTokens / 1_000_000) * m.outputPerMToken;
      if (cost < cheapestCost) cheapestCost = cost;
    }

    return {
      estimatedCostUsd: Math.round(estimatedCostUsd * 1_000_000) / 1_000_000,
      cheapestOptionCostUsd: cheapestCost === Infinity
        ? 0
        : Math.round(cheapestCost * 1_000_000) / 1_000_000,
    };
  }

  // ── Private: Human-readable reason ───────────────────────────────────

  private buildReason(
    provider: string,
    model: string,
    tier: Tier,
    confidence: number,
    importance: TriageResult['importance'],
    urgency: TriageResult['urgency'],
    executionMode: TriageResult['executionMode'],
    agenticScore: number,
    platform: TriageResult['recommendedPlatform'],
    savingsPercent: number,
  ): string {
    const parts: string[] = [];

    // Routing reason
    if (platform === 'decentralized') {
      parts.push(`Routing to OpenClaw decentralized node — ${tier} tier, ${confidence.toFixed(2)} confidence`);
    } else {
      parts.push(`Routing to ${model} via ${provider} (${tier} tier, ${confidence.toFixed(2)} confidence)`);
    }

    // Execution reason
    if (executionMode === 'immediate') {
      if (importance === 'critical' || importance === 'high') {
        parts.push(`Executing immediately — ${importance} importance detected`);
      } else {
        parts.push('Executing immediately');
      }
    } else if (executionMode === 'batch') {
      if (savingsPercent > 0) {
        parts.push(`Deferring to batch queue — low priority detected, ${savingsPercent}% savings available during off-peak`);
      } else {
        parts.push('Deferring to batch queue — low priority detected');
      }
    } else if (executionMode === 'price_triggered') {
      parts.push('Waiting for price trigger — cost sensitivity set to minimum, will execute when rates drop');
    } else if (executionMode === 'scheduled') {
      parts.push('Scheduled for later execution');
    }

    // Agentic note
    if (agenticScore > 0.6) {
      parts.push(`High agentic score (${agenticScore.toFixed(1)}) — likely a coding/automation task`);
    }

    return parts.join('. ') + '.';
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const triageEngine = new TriageEngine();
