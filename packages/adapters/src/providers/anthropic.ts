// ============================================================================
// Anthropic Adapter — Connects to Anthropic's API for cost tracking
// Uses: https://api.anthropic.com/v1/usage (Admin API)
//       https://api.anthropic.com/v1/models
// ============================================================================

import type {
  ComputeGaugeAdapter,
  ProviderCredentials,
  HealthCheckResult,
  UsageData,
  SpendSummary,
  ModelInfo,
  PricingInfo,
  DateRange,
  SpendAlert,
  PricingChange,
} from '../types.js';

// Anthropic model pricing (as of Feb 2026)
const ANTHROPIC_PRICING: Record<string, { input: number; output: number; context: number }> = {
  'claude-opus-4': { input: 15.0, output: 75.0, context: 200000 },
  'claude-sonnet-4': { input: 3.0, output: 15.0, context: 200000 },
  'claude-haiku-3.5': { input: 0.80, output: 4.0, context: 200000 },
  'claude-sonnet-3.5': { input: 3.0, output: 15.0, context: 200000 },
  'claude-3-opus': { input: 15.0, output: 75.0, context: 200000 },
  'claude-3-sonnet': { input: 3.0, output: 15.0, context: 200000 },
  'claude-3-haiku': { input: 0.25, output: 1.25, context: 200000 },
};

export class AnthropicAdapter implements ComputeGaugeAdapter {
  readonly provider = 'anthropic' as const;
  readonly version = '0.1.0';

  private apiKey: string = '';
  private organizationId?: string;
  private baseUrl = 'https://api.anthropic.com';
  private connected = false;

  // Event callbacks
  private spendThresholdCallbacks: Array<(alert: SpendAlert) => void> = [];
  private pricingChangeCallbacks: Array<(change: PricingChange) => void> = [];

  async connect(credentials: ProviderCredentials): Promise<void> {
    if (!credentials.apiKey) {
      throw new Error('[Anthropic] API key required');
    }
    this.apiKey = credentials.apiKey;
    this.organizationId = credentials.organizationId;
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.apiKey = '';
    this.connected = false;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, {
        headers: this.getHeaders(),
      });
      return {
        provider: 'anthropic',
        healthy: res.ok,
        latencyMs: Date.now() - start,
        message: res.ok ? 'Connected' : `HTTP ${res.status}`,
        checkedAt: new Date(),
      };
    } catch (error) {
      return {
        provider: 'anthropic',
        healthy: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'Connection failed',
        checkedAt: new Date(),
      };
    }
  }

  async getUsage(period: DateRange): Promise<UsageData> {
    this.ensureConnected();

    // Anthropic Admin API: GET /v1/organizations/{org_id}/usage
    // Falls back to estimation if Admin API not available
    try {
      const params = new URLSearchParams({
        start_date: period.start.toISOString().split('T')[0],
        end_date: period.end.toISOString().split('T')[0],
      });

      const res = await fetch(
        `${this.baseUrl}/v1/usage?${params}`,
        { headers: this.getHeaders() }
      );

      if (res.ok) {
        const data = await res.json();
        return this.parseUsageResponse(data, period);
      }

      // Admin API not available — return structure with zero data
      // User can still see pricing data and manually input spend
      return this.getEmptyUsage(period);
    } catch {
      return this.getEmptyUsage(period);
    }
  }

  async getCurrentSpend(): Promise<SpendSummary> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const usage = await this.getUsage({ start: startOfMonth, end: now });

    const daysElapsed = Math.max(1, (now.getTime() - startOfMonth.getTime()) / (1000 * 60 * 60 * 24));
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dailyAvg = usage.totalCostUsd / daysElapsed;
    const projected = dailyAvg * daysInMonth;

    // Find top model
    const topModel = usage.models.sort((a, b) => b.costUsd - a.costUsd)[0];

    const summary: SpendSummary = {
      provider: 'anthropic',
      currentPeriod: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      totalSpendUsd: usage.totalCostUsd,
      dailyAverage: dailyAvg,
      projectedMonthEnd: projected,
      topModel: topModel?.model || 'unknown',
      topModelSpend: topModel?.costUsd || 0,
    };

    // Check spend thresholds
    this.checkSpendThresholds(summary);

    return summary;
  }

  async getModels(): Promise<ModelInfo[]> {
    this.ensureConnected();

    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, {
        headers: this.getHeaders(),
      });

      if (res.ok) {
        const data = await res.json();
        return (data.data || []).map((m: Record<string, unknown>) => this.mapModel(m));
      }
    } catch {
      // Fallback to known models
    }

    // Return known models with pricing
    return Object.entries(ANTHROPIC_PRICING).map(([id, pricing]) => ({
      id,
      name: this.formatModelName(id),
      provider: 'anthropic' as const,
      inputPricePerMToken: pricing.input,
      outputPricePerMToken: pricing.output,
      contextWindow: pricing.context,
      category: 'chat' as const,
    }));
  }

  async getPricing(): Promise<PricingInfo[]> {
    return Object.entries(ANTHROPIC_PRICING).map(([model, pricing]) => ({
      model,
      provider: 'anthropic' as const,
      inputPricePerMToken: pricing.input,
      outputPricePerMToken: pricing.output,
      effectiveDate: new Date('2026-01-01'),
    }));
  }

  onSpendThreshold(callback: (alert: SpendAlert) => void): void {
    this.spendThresholdCallbacks.push(callback);
  }

  onPricingChange(callback: (change: PricingChange) => void): void {
    this.pricingChangeCallbacks.push(callback);
  }

  // --- Private helpers ---

  private getHeaders(): Record<string, string> {
    return {
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      ...(this.organizationId ? { 'anthropic-organization': this.organizationId } : {}),
    };
  }

  private ensureConnected(): void {
    if (!this.connected || !this.apiKey) {
      throw new Error('[Anthropic] Not connected. Call connect() first.');
    }
  }

  private parseUsageResponse(data: Record<string, unknown>, period: DateRange): UsageData {
    // Parse Anthropic's usage API response format
    const usage: UsageData = {
      provider: 'anthropic',
      period,
      totalCostUsd: 0,
      totalTokens: 0,
      totalRequests: 0,
      currency: 'USD',
      models: [],
    };

    // The actual response format depends on the Anthropic Admin API
    // This handles the common structure
    const items = (data as Record<string, unknown[]>).usage || (data as Record<string, unknown[]>).data || [];
    const modelMap = new Map<string, { input: number; output: number; cost: number; requests: number }>();

    for (const item of items as Record<string, unknown>[]) {
      const model = (item.model as string) || 'unknown';
      const inputTokens = (item.input_tokens as number) || 0;
      const outputTokens = (item.output_tokens as number) || 0;

      const existing = modelMap.get(model) || { input: 0, output: 0, cost: 0, requests: 0 };
      existing.input += inputTokens;
      existing.output += outputTokens;
      existing.requests += 1;

      // Calculate cost from known pricing
      const pricing = ANTHROPIC_PRICING[model];
      if (pricing) {
        existing.cost += (inputTokens / 1_000_000) * pricing.input +
                         (outputTokens / 1_000_000) * pricing.output;
      }

      modelMap.set(model, existing);
    }

    for (const [model, data] of modelMap) {
      usage.models.push({
        model,
        inputTokens: data.input,
        outputTokens: data.output,
        totalTokens: data.input + data.output,
        costUsd: data.cost,
        requests: data.requests,
      });
      usage.totalTokens += data.input + data.output;
      usage.totalCostUsd += data.cost;
      usage.totalRequests += data.requests;
    }

    return usage;
  }

  private getEmptyUsage(period: DateRange): UsageData {
    return {
      provider: 'anthropic',
      period,
      totalCostUsd: 0,
      totalTokens: 0,
      totalRequests: 0,
      currency: 'USD',
      models: [],
    };
  }

  private mapModel(m: Record<string, unknown>): ModelInfo {
    const id = m.id as string;
    const pricing = ANTHROPIC_PRICING[id];
    return {
      id,
      name: this.formatModelName(id),
      provider: 'anthropic',
      inputPricePerMToken: pricing?.input || 0,
      outputPricePerMToken: pricing?.output || 0,
      contextWindow: pricing?.context || 200000,
      category: 'chat',
    };
  }

  private formatModelName(id: string): string {
    return id
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private checkSpendThresholds(summary: SpendSummary): void {
    if (!summary.budgetLimitUsd || !summary.budgetUsedPercent) return;

    const thresholds = [50, 80, 90, 100, 110];
    for (const threshold of thresholds) {
      if (summary.budgetUsedPercent >= threshold) {
        const alert: SpendAlert = {
          provider: 'anthropic',
          type: threshold >= 100 ? 'budget_exceeded' : 'budget_warning',
          threshold,
          currentValue: summary.budgetUsedPercent,
          message: `Anthropic spend is at ${summary.budgetUsedPercent.toFixed(0)}% of $${summary.budgetLimitUsd} budget`,
          timestamp: new Date(),
        };
        for (const cb of this.spendThresholdCallbacks) {
          cb(alert);
        }
      }
    }
  }
}
