import { RatingIntegrityEngine } from './rating-integrity.js';

// ============================================================================
// AgentSessionTracker — Real-time cost tracking + agent rating system
//
// Every MCP server instance = one agent session. This tracks:
// - Every API request the agent makes or reports
// - Running cost total
// - Per-model breakdown
// - Cost velocity (burn rate within the session)
// - Budget alerts when approaching limits
// - Agent ratings of model recommendations (the feedback loop)
//
// THE RATING SYSTEM:
// After an agent follows a pick_model recommendation, it calls rate_recommendation
// to report whether the model actually worked well for the task. This creates:
// 1. A per-session quality report the user can see
// 2. Aggregate data that improves pick_model scores for all users
// 3. Social proof ("4.8/5 across 50K agent sessions") for marketing/acquisition
// 4. A public model quality leaderboard sourced from real agent usage
//
// This is the data flywheel engine. Every rating feeds back into better
// recommendations for all users.
// ============================================================================

interface LoggedRequest {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  taskType?: string;
  latencyMs?: number;
  success: boolean;
  timestamp: Date;
  agentId?: string;
}

interface ModelBreakdown {
  model: string;
  provider: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  avgLatencyMs: number;
}

// ============================================================================
// Agent Rating System Types
// ============================================================================

interface ModelRating {
  model: string;
  provider: string;
  taskType: string;
  rating: 1 | 2 | 3 | 4 | 5;
  taskSuccess: boolean;
  wouldUseAgain: boolean;
  costEffective: boolean;
  feedback?: string;
  actualCostUsd?: number;
  timestamp: Date;
}

interface ModelRatingAggregate {
  model: string;
  provider: string;
  totalRatings: number;
  avgRating: number;
  successRate: number;
  wouldUseAgainRate: number;
  costEffectiveRate: number;
  byTaskType: Record<string, {
    count: number;
    avgRating: number;
    successRate: number;
  }>;
}

// Known pricing for cost calculation
const PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  'claude-opus-4': { input: 15.0, output: 75.0 },
  'claude-sonnet-4': { input: 3.0, output: 15.0 },
  'claude-haiku-3.5': { input: 0.80, output: 4.0 },
  'claude-sonnet-3.5': { input: 3.0, output: 15.0 },
  'claude-3-opus': { input: 15.0, output: 75.0 },
  'claude-3-sonnet': { input: 3.0, output: 15.0 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  // OpenAI
  'gpt-4o': { input: 2.50, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'o1': { input: 15.0, output: 60.0 },
  'o1-mini': { input: 3.0, output: 12.0 },
  'o3-mini': { input: 1.10, output: 4.40 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  // Google
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  'gemini-2.0-pro': { input: 1.25, output: 10.0 },
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  // DeepSeek
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
  // Groq
  'llama-3.3-70b': { input: 0.59, output: 0.79 },
  'llama-3.1-8b': { input: 0.05, output: 0.08 },
  // Mistral
  'mistral-large': { input: 2.0, output: 6.0 },
  'mistral-small': { input: 0.10, output: 0.30 },
};

export class AgentSessionTracker {
  private requests: LoggedRequest[] = [];
  private ratings: ModelRating[] = [];
  private sessionStart: Date = new Date();
  private budgetTotal: number;
  private budgetAlertSent = false;
  private integrityEngine: RatingIntegrityEngine;
  private lastRatingTime: number = 0;

  constructor() {
    this.budgetTotal = parseFloat(process.env.INFERLANE_BUDGET_TOTAL || '0');
    this.integrityEngine = new RatingIntegrityEngine();
  }

  logRequest(params: {
    provider: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    task_type?: string;
    latency_ms?: number;
    success: boolean;
    agent_id?: string;
  }): string {
    // Calculate cost
    const pricing = this.findPricing(params.model);
    const costUsd = pricing
      ? (params.input_tokens / 1_000_000) * pricing.input +
        (params.output_tokens / 1_000_000) * pricing.output
      : 0;

    const request: LoggedRequest = {
      provider: params.provider,
      model: params.model,
      inputTokens: params.input_tokens,
      outputTokens: params.output_tokens,
      costUsd,
      taskType: params.task_type,
      latencyMs: params.latency_ms,
      success: params.success,
      timestamp: new Date(),
      agentId: params.agent_id,
    };

    this.requests.push(request);

    // Build response
    const totalCost = this.getTotalCost();
    const requestCount = this.requests.length;

    const lines: string[] = [];
    lines.push(`Logged: ${params.model} — $${costUsd.toFixed(4)}`);
    lines.push(`Session total: $${totalCost.toFixed(4)} across ${requestCount} request${requestCount === 1 ? '' : 's'}`);

    // Budget warning
    if (this.budgetTotal > 0) {
      const pct = (totalCost / this.budgetTotal) * 100;
      if (pct > 80 && !this.budgetAlertSent) {
        lines.push('');
        lines.push(`⚠️ SESSION COST ALERT: You've used ${pct.toFixed(0)}% of the $${this.budgetTotal} session budget.`);
        lines.push('Consider switching to cheaper models for remaining tasks.');
        this.budgetAlertSent = true;
      }
    }

    // If session is getting expensive, suggest optimization
    if (totalCost > 1.0 && requestCount > 5) {
      const breakdown = this.getModelBreakdowns();
      const mostExpensive = breakdown.sort((a, b) => b.totalCost - a.totalCost)[0];
      if (mostExpensive && mostExpensive.totalCost > totalCost * 0.5) {
        lines.push('');
        lines.push(`💡 ${mostExpensive.model} accounts for ${((mostExpensive.totalCost / totalCost) * 100).toFixed(0)}% of session cost.`);
        lines.push(`Consider using a cheaper model for some of those ${mostExpensive.requests} requests.`);
      }
    }

    return lines.join('\n');
  }

  getSessionSummary(agentId?: string): string {
    // Filter requests by agentId if provided
    const filteredRequests = agentId
      ? this.requests.filter(r => r.agentId === agentId)
      : this.requests;
    const totalCost = filteredRequests.reduce((sum, r) => sum + r.costUsd, 0);
    const requestCount = filteredRequests.length;
    const sessionDuration = (Date.now() - this.sessionStart.getTime()) / 1000 / 60; // minutes
    const burnRate = sessionDuration > 0 ? (totalCost / sessionDuration) * 60 : 0; // per hour

    const lines: string[] = [];
    lines.push(agentId ? `# Session Cost Summary (Agent: ${agentId})` : '# Session Cost Summary');
    lines.push('');
    lines.push(`**Total Cost**: $${totalCost.toFixed(4)}`);
    lines.push(`**Requests**: ${requestCount}`);
    lines.push(`**Duration**: ${sessionDuration.toFixed(1)} minutes`);
    lines.push(`**Burn Rate**: $${burnRate.toFixed(2)}/hour`);

    if (this.budgetTotal > 0) {
      const remaining = this.budgetTotal - totalCost;
      const pct = (totalCost / this.budgetTotal) * 100;
      lines.push('');
      lines.push(`**Budget**: $${totalCost.toFixed(2)} / $${this.budgetTotal.toFixed(2)} (${pct.toFixed(0)}% used)`);
      lines.push(`**Remaining**: $${remaining.toFixed(2)}`);
      if (burnRate > 0) {
        const minutesLeft = (remaining / burnRate) * 60;
        lines.push(`**Estimated runway**: ${minutesLeft.toFixed(0)} minutes at current rate`);
      }
    }

    // Model breakdown
    const breakdown = this.getModelBreakdowns(filteredRequests);
    if (breakdown.length > 0) {
      lines.push('');
      lines.push('## Per-Model Breakdown');
      lines.push('| Model | Requests | Input Tokens | Output Tokens | Cost | Avg Latency |');
      lines.push('|-------|----------|-------------|--------------|------|-------------|');
      for (const m of breakdown) {
        lines.push(
          `| ${m.model} | ${m.requests} | ${m.inputTokens.toLocaleString()} | ${m.outputTokens.toLocaleString()} | $${m.totalCost.toFixed(4)} | ${m.avgLatencyMs > 0 ? m.avgLatencyMs.toFixed(0) + 'ms' : '—'} |`
        );
      }
    }

    // Task type breakdown
    const taskTypes = this.getTaskTypeBreakdown(filteredRequests);
    if (Object.keys(taskTypes).length > 1) {
      lines.push('');
      lines.push('## By Task Type');
      for (const [type, data] of Object.entries(taskTypes).sort((a, b) => b[1].cost - a[1].cost)) {
        lines.push(`- **${type}**: ${data.count} requests, $${data.cost.toFixed(4)}`);
      }
    }

    if (requestCount === 0) {
      lines.push('');
      lines.push('_No requests logged yet. Call `log_request` after API calls to track costs._');
    }

    return lines.join('\n');
  }

  // ========================================================================
  // AGENT RATING SYSTEM
  // ========================================================================

  rateRecommendation(params: {
    model: string;
    provider: string;
    task_type: string;
    rating: number;
    task_success: boolean;
    would_use_again: boolean;
    cost_effective: boolean;
    feedback?: string;
  }): string {
    // Clamp rating to 1-5
    const clampedRating = Math.max(1, Math.min(5, Math.round(params.rating))) as 1 | 2 | 3 | 4 | 5;

    // Calculate time since last rating for spam detection
    const now = Date.now();
    const timeSinceLastRating = this.lastRatingTime > 0 ? now - this.lastRatingTime : 0;
    this.lastRatingTime = now;

    // --- INTEGRITY VALIDATION ---
    const validation = this.integrityEngine.validateRating({
      model: params.model,
      provider: params.provider,
      taskType: params.task_type,
      rating: clampedRating,
      taskSuccess: params.task_success,
      wouldUseAgain: params.would_use_again,
      costEffective: params.cost_effective,
      feedback: params.feedback,
      sessionRequestCount: this.requests.length,
      sessionModelHistory: this.requests.map(r => r.model),
      timeSinceLastRating,
    });

    // If rejected, return explanation
    if (!validation.accepted) {
      const lines: string[] = [];
      lines.push(`❌ Rating rejected: ${validation.rejectionReason}`);
      if (validation.flags.length > 0) {
        lines.push('');
        lines.push('Flags:');
        for (const flag of validation.flags) {
          const icon = flag.severity === 'critical' ? '🔴' : flag.severity === 'warning' ? '🟡' : 'ℹ️';
          lines.push(`${icon} [${flag.type}] ${flag.message}`);
        }
      }
      return lines.join('\n');
    }

    // Use adjusted rating if integrity engine modified it
    const effectiveRating = (validation.adjustedRating !== undefined
      ? Math.round(validation.adjustedRating)
      : clampedRating) as 1 | 2 | 3 | 4 | 5;

    // Use sanitized feedback if integrity engine modified it
    const effectiveFeedback = validation.sanitizedFeedback ?? params.feedback;

    // Find the most recent matching request to attach actual cost
    const matchingRequest = [...this.requests]
      .reverse()
      .find(r => r.model === params.model && r.provider === params.provider);

    const rating: ModelRating = {
      model: params.model,
      provider: params.provider,
      taskType: params.task_type,
      rating: effectiveRating,
      taskSuccess: params.task_success,
      wouldUseAgain: params.would_use_again,
      costEffective: params.cost_effective,
      feedback: effectiveFeedback,
      actualCostUsd: matchingRequest?.costUsd,
      timestamp: new Date(),
    };

    this.ratings.push(rating);

    // Build response
    const lines: string[] = [];
    const stars = '★'.repeat(effectiveRating) + '☆'.repeat(5 - effectiveRating);
    lines.push(`Rated: ${params.provider}/${params.model} — ${stars} (${effectiveRating}/5)`);
    lines.push(`Task: ${params.task_type} | Success: ${params.task_success ? '✅' : '❌'} | Cost-effective: ${params.cost_effective ? '✅' : '❌'}`);

    // Show integrity flags if any
    const warnings = validation.flags.filter(f => f.severity === 'warning' || f.severity === 'info');
    if (warnings.length > 0) {
      lines.push('');
      for (const flag of warnings) {
        const icon = flag.severity === 'warning' ? '🟡' : 'ℹ️';
        lines.push(`${icon} ${flag.message}`);
      }
    }

    // Note if rating was adjusted
    if (validation.adjustedRating !== undefined && effectiveRating !== clampedRating) {
      lines.push(`📊 Rating adjusted from ${clampedRating}/5 → ${effectiveRating}/5 (integrity weighting)`);
    }

    // Show session rating stats
    const totalRatings = this.ratings.length;
    const avgRating = this.ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings;
    const successRate = (this.ratings.filter(r => r.taskSuccess).length / totalRatings) * 100;
    lines.push('');
    lines.push(`Session ratings: ${totalRatings} total | Avg: ${avgRating.toFixed(1)}/5 | Success rate: ${successRate.toFixed(0)}%`);

    // If we have enough ratings, show model-level insights
    if (totalRatings >= 3) {
      const aggregates = this.getModelRatingAggregates();
      const topModel = aggregates.sort((a, b) => b.avgRating - a.avgRating)[0];
      const worstModel = aggregates.sort((a, b) => a.avgRating - b.avgRating)[0];

      if (topModel && worstModel && topModel.model !== worstModel.model) {
        lines.push('');
        lines.push(`🏆 Best rated this session: ${topModel.model} (${topModel.avgRating.toFixed(1)}/5, ${topModel.totalRatings} ratings)`);
        if (worstModel.avgRating < 3.0) {
          lines.push(`⚠️ Underperforming: ${worstModel.model} (${worstModel.avgRating.toFixed(1)}/5) — consider avoiding for ${this.getMostFailedTaskType(worstModel)}`);
        }
      }
    }

    // Feedback for pick_model improvement
    if (params.feedback) {
      lines.push('');
      lines.push(`📝 Feedback noted: "${params.feedback}"`);
    }

    // Nudge: if this is the agent's first rating, encourage more
    if (totalRatings === 1) {
      lines.push('');
      lines.push('💡 Great — rating recommendations helps improve model selection for everyone. Keep rating after each task!');
    }

    return lines.join('\n');
  }

  getModelRatings(): string {
    if (this.ratings.length === 0) {
      const lines: string[] = [];
      lines.push('# Model Ratings — This Session');
      lines.push('');
      lines.push('_No ratings yet. Call `rate_recommendation` after using a model to build the quality index._');
      lines.push('');
      lines.push('## How to Rate');
      lines.push('After completing a task with a recommended model, rate it:');
      lines.push('```');
      lines.push('rate_recommendation({');
      lines.push('  model: "claude-sonnet-4",');
      lines.push('  provider: "anthropic",');
      lines.push('  task_type: "code_generation",');
      lines.push('  rating: 4,           // 1-5 stars');
      lines.push('  task_success: true,   // did it complete the task?');
      lines.push('  would_use_again: true,');
      lines.push('  cost_effective: true');
      lines.push('})');
      lines.push('```');
      return lines.join('\n');
    }

    const aggregates = this.getModelRatingAggregates();
    const totalRatings = this.ratings.length;
    const avgRating = this.ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings;
    const overallSuccessRate = (this.ratings.filter(r => r.taskSuccess).length / totalRatings) * 100;
    const costEffectiveRate = (this.ratings.filter(r => r.costEffective).length / totalRatings) * 100;

    const lines: string[] = [];
    lines.push('# Model Ratings — This Session');
    lines.push('');
    lines.push(`**Total Ratings**: ${totalRatings}`);
    lines.push(`**Average Rating**: ${avgRating.toFixed(1)}/5 ${this.ratingToStars(avgRating)}`);
    lines.push(`**Task Success Rate**: ${overallSuccessRate.toFixed(0)}%`);
    lines.push(`**Cost-Effective Rate**: ${costEffectiveRate.toFixed(0)}%`);

    // Model leaderboard
    lines.push('');
    lines.push('## Model Leaderboard');
    lines.push('| Rank | Model | Rating | Success | Cost-Effective | Reviews |');
    lines.push('|------|-------|--------|---------|---------------|---------|');

    const sorted = aggregates.sort((a, b) => {
      // Sort by rating first, then by success rate, then by number of ratings
      if (Math.abs(a.avgRating - b.avgRating) > 0.1) return b.avgRating - a.avgRating;
      if (Math.abs(a.successRate - b.successRate) > 5) return b.successRate - a.successRate;
      return b.totalRatings - a.totalRatings;
    });

    for (let i = 0; i < sorted.length; i++) {
      const m = sorted[i];
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
      lines.push(
        `| ${medal} | ${m.provider}/${m.model} | ${m.avgRating.toFixed(1)}/5 ${this.ratingToStars(m.avgRating)} | ${m.successRate.toFixed(0)}% | ${m.costEffectiveRate.toFixed(0)}% | ${m.totalRatings} |`
      );
    }

    // Task-type breakdown for top models
    if (sorted.length > 0 && sorted[0].totalRatings >= 2) {
      const top = sorted[0];
      const taskEntries = Object.entries(top.byTaskType);
      if (taskEntries.length > 1) {
        lines.push('');
        lines.push(`## ${top.model} — By Task Type`);
        for (const [task, data] of taskEntries.sort((a, b) => b[1].avgRating - a[1].avgRating)) {
          lines.push(`- **${task}**: ${data.avgRating.toFixed(1)}/5 (${data.count} ratings, ${data.successRate.toFixed(0)}% success)`);
        }
      }
    }

    // "Would use again" insight
    const wouldUseAgainRate = (this.ratings.filter(r => r.wouldUseAgain).length / totalRatings) * 100;
    lines.push('');
    lines.push(`## Satisfaction`);
    lines.push(`**Would use again**: ${wouldUseAgainRate.toFixed(0)}% of recommendations`);
    if (wouldUseAgainRate >= 80) {
      lines.push('✅ InferLane recommendations are working well for this session.');
    } else if (wouldUseAgainRate >= 50) {
      lines.push('⚠️ Mixed results — some recommendations could be improved.');
    } else {
      lines.push('❌ Low satisfaction — consider adjusting priority settings or task type descriptions.');
    }

    return lines.join('\n');
  }

  getIntegrityReport(): string {
    return this.integrityEngine.getIntegrityReport();
  }

  runImprovementCycle(): string {
    return this.integrityEngine.runImprovementCycle();
  }

  getSessionData(): string {
    const ratingAggregates = this.ratings.length > 0 ? this.getModelRatingAggregates() : [];
    return JSON.stringify({
      sessionStart: this.sessionStart.toISOString(),
      totalCost: this.getTotalCost(),
      requestCount: this.requests.length,
      models: this.getModelBreakdowns(),
      requests: this.requests.slice(-20), // Last 20 requests
      ratings: {
        total: this.ratings.length,
        avgRating: this.ratings.length > 0
          ? this.ratings.reduce((sum, r) => sum + r.rating, 0) / this.ratings.length
          : 0,
        successRate: this.ratings.length > 0
          ? this.ratings.filter(r => r.taskSuccess).length / this.ratings.length
          : 0,
        modelAggregates: ratingAggregates,
        recentRatings: this.ratings.slice(-10),
      },
    }, null, 2);
  }

  // --- Private helpers ---

  private getModelRatingAggregates(): ModelRatingAggregate[] {
    const map = new Map<string, ModelRatingAggregate>();

    for (const r of this.ratings) {
      const key = `${r.provider}/${r.model}`;
      const existing = map.get(key) || {
        model: r.model,
        provider: r.provider,
        totalRatings: 0,
        avgRating: 0,
        successRate: 0,
        wouldUseAgainRate: 0,
        costEffectiveRate: 0,
        byTaskType: {},
      };

      // Update running averages
      const prevTotal = existing.totalRatings;
      existing.totalRatings++;
      existing.avgRating = (existing.avgRating * prevTotal + r.rating) / existing.totalRatings;
      existing.successRate = (existing.successRate * prevTotal + (r.taskSuccess ? 100 : 0)) / existing.totalRatings;
      existing.wouldUseAgainRate = (existing.wouldUseAgainRate * prevTotal + (r.wouldUseAgain ? 100 : 0)) / existing.totalRatings;
      existing.costEffectiveRate = (existing.costEffectiveRate * prevTotal + (r.costEffective ? 100 : 0)) / existing.totalRatings;

      // Update per-task-type breakdown
      if (!existing.byTaskType[r.taskType]) {
        existing.byTaskType[r.taskType] = { count: 0, avgRating: 0, successRate: 0 };
      }
      const taskData = existing.byTaskType[r.taskType];
      const prevTaskCount = taskData.count;
      taskData.count++;
      taskData.avgRating = (taskData.avgRating * prevTaskCount + r.rating) / taskData.count;
      taskData.successRate = (taskData.successRate * prevTaskCount + (r.taskSuccess ? 100 : 0)) / taskData.count;

      map.set(key, existing);
    }

    return Array.from(map.values());
  }

  private ratingToStars(rating: number): string {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
  }

  private getMostFailedTaskType(aggregate: ModelRatingAggregate): string {
    let worstTask = 'general tasks';
    let worstRate = 100;
    for (const [task, data] of Object.entries(aggregate.byTaskType)) {
      if (data.successRate < worstRate) {
        worstRate = data.successRate;
        worstTask = task;
      }
    }
    return worstTask;
  }

  private getTotalCost(): number {
    return this.requests.reduce((sum, r) => sum + r.costUsd, 0);
  }

  private getModelBreakdowns(requests?: LoggedRequest[]): ModelBreakdown[] {
    const source = requests || this.requests;
    const map = new Map<string, ModelBreakdown>();

    for (const r of source) {
      const key = `${r.provider}/${r.model}`;
      const existing = map.get(key) || {
        model: r.model,
        provider: r.provider,
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
        avgLatencyMs: 0,
      };

      existing.requests++;
      existing.inputTokens += r.inputTokens;
      existing.outputTokens += r.outputTokens;
      existing.totalCost += r.costUsd;
      if (r.latencyMs) {
        existing.avgLatencyMs = (existing.avgLatencyMs * (existing.requests - 1) + r.latencyMs) / existing.requests;
      }

      map.set(key, existing);
    }

    return Array.from(map.values()).sort((a, b) => b.totalCost - a.totalCost);
  }

  private getTaskTypeBreakdown(requests?: LoggedRequest[]): Record<string, { count: number; cost: number }> {
    const source = requests || this.requests;
    const map: Record<string, { count: number; cost: number }> = {};
    for (const r of source) {
      const type = r.taskType || 'unspecified';
      if (!map[type]) map[type] = { count: 0, cost: 0 };
      map[type].count++;
      map[type].cost += r.costUsd;
    }
    return map;
  }

  private findPricing(model: string): { input: number; output: number } | null {
    // Direct match
    if (PRICING[model]) return PRICING[model];

    // Fuzzy match — handle model version suffixes
    const normalized = model.toLowerCase().replace(/[-_]/g, '');
    for (const [key, value] of Object.entries(PRICING)) {
      if (normalized.includes(key.toLowerCase().replace(/[-_]/g, ''))) {
        return value;
      }
    }

    return null;
  }
}
