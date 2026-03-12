// ============================================================================
// OpenAI Adapter — Connects to OpenAI's API for cost tracking
// Uses: https://api.openai.com/v1/organization/usage
//       https://api.openai.com/v1/models
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

// OpenAI model pricing (as of Feb 2026)
const OPENAI_PRICING: Record<string, { input: number; output: number; context: number }> = {
  'gpt-4o': { input: 2.50, output: 10.0, context: 128000 },
  'gpt-4o-mini': { input: 0.15, output: 0.60, context: 128000 },
  'gpt-4-turbo': { input: 10.0, output: 30.0, context: 128000 },
  'gpt-4': { input: 30.0, output: 60.0, context: 8192 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50, context: 16385 },
  'o1': { input: 15.0, output: 60.0, context: 200000 },
  'o1-mini': { input: 3.0, output: 12.0, context: 128000 },
  'o3-mini': { input: 1.10, output: 4.40, context: 200000 },
  'text-embedding-3-small': { input: 0.02, output: 0, context: 8191 },
  'text-embedding-3-large': { input: 0.13, output: 0, context: 8191 },
  'dall-e-3': { input: 40.0, output: 0, context: 0 }, // per image, approximated
};

export class OpenAIAdapter implements ComputeGaugeAdapter {
  readonly provider = 'openai' as const;
  readonly version = '0.1.0';

  private apiKey: string = '';
  private organizationId?: string;
  private baseUrl = 'https://api.openai.com';
  private connected = false;

  private spendThresholdCallbacks: Array<(alert: SpendAlert) => void> = [];
  private pricingChangeCallbacks: Array<(change: PricingChange) => void> = [];

  async connect(credentials: ProviderCredentials): Promise<void> {
    if (!credentials.apiKey) {
      throw new Error('[OpenAI] API key required');
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
        provider: 'openai',
        healthy: res.ok,
        latencyMs: Date.now() - start,
        message: res.ok ? 'Connected' : `HTTP ${res.status}`,
        checkedAt: new Date(),
      };
    } catch (error) {
      return {
        provider: 'openai',
        healthy: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'Connection failed',
        checkedAt: new Date(),
      };
    }
  }

  async getUsage(period: DateRange): Promise<UsageData> {
    this.ensureConnected();

    try {
      // OpenAI Usage API
      const startDate = Math.floor(period.start.getTime() / 1000);
      const endDate = Math.floor(period.end.getTime() / 1000);

      const res = await fetch(
        `${this.baseUrl}/v1/organization/usage?start_time=${startDate}&end_time=${endDate}`,
        { headers: this.getHeaders() }
      );

      if (res.ok) {
        const data = await res.json();
        return this.parseUsageResponse(data, period);
      }

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

    const topModel = usage.models.sort((a, b) => b.costUsd - a.costUsd)[0];

    return {
      provider: 'openai',
      currentPeriod: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      totalSpendUsd: usage.totalCostUsd,
      dailyAverage: dailyAvg,
      projectedMonthEnd: projected,
      topModel: topModel?.model || 'unknown',
      topModelSpend: topModel?.costUsd || 0,
    };
  }

  async getModels(): Promise<ModelInfo[]> {
    this.ensureConnected();

    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, {
        headers: this.getHeaders(),
      });

      if (res.ok) {
        const data = await res.json();
        return (data.data || [])
          .filter((m: Record<string, string>) => OPENAI_PRICING[m.id])
          .map((m: Record<string, string>) => this.mapModel(m));
      }
    } catch {
      // Fallback
    }

    return Object.entries(OPENAI_PRICING).map(([id, pricing]) => ({
      id,
      name: id,
      provider: 'openai' as const,
      inputPricePerMToken: pricing.input,
      outputPricePerMToken: pricing.output,
      contextWindow: pricing.context,
      category: id.includes('embedding') ? 'embedding' as const :
               id.includes('dall-e') ? 'image' as const : 'chat' as const,
    }));
  }

  async getPricing(): Promise<PricingInfo[]> {
    return Object.entries(OPENAI_PRICING).map(([model, pricing]) => ({
      model,
      provider: 'openai' as const,
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
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...(this.organizationId ? { 'OpenAI-Organization': this.organizationId } : {}),
    };
  }

  private ensureConnected(): void {
    if (!this.connected || !this.apiKey) {
      throw new Error('[OpenAI] Not connected. Call connect() first.');
    }
  }

  private parseUsageResponse(data: Record<string, unknown>, period: DateRange): UsageData {
    const usage: UsageData = {
      provider: 'openai',
      period,
      totalCostUsd: 0,
      totalTokens: 0,
      totalRequests: 0,
      currency: 'USD',
      models: [],
    };

    const buckets = (data as Record<string, unknown[]>).data || [];
    const modelMap = new Map<string, { input: number; output: number; cost: number; requests: number }>();

    for (const bucket of buckets as Record<string, unknown>[]) {
      const results = (bucket as Record<string, unknown[]>).results || [];
      for (const item of results as Record<string, unknown>[]) {
        const model = ((item as Record<string, Record<string, string>>).snapshot?.model) || 'unknown';
        const inputTokens = (item.input_tokens as number) || 0;
        const outputTokens = (item.output_tokens as number) || 0;
        const numRequests = (item.num_model_requests as number) || 1;

        const existing = modelMap.get(model) || { input: 0, output: 0, cost: 0, requests: 0 };
        existing.input += inputTokens;
        existing.output += outputTokens;
        existing.requests += numRequests;

        const pricing = OPENAI_PRICING[model];
        if (pricing) {
          existing.cost += (inputTokens / 1_000_000) * pricing.input +
                           (outputTokens / 1_000_000) * pricing.output;
        }

        modelMap.set(model, existing);
      }
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
      provider: 'openai',
      period,
      totalCostUsd: 0,
      totalTokens: 0,
      totalRequests: 0,
      currency: 'USD',
      models: [],
    };
  }

  private mapModel(m: Record<string, string>): ModelInfo {
    const id = m.id;
    const pricing = OPENAI_PRICING[id];
    return {
      id,
      name: id,
      provider: 'openai',
      inputPricePerMToken: pricing?.input || 0,
      outputPricePerMToken: pricing?.output || 0,
      contextWindow: pricing?.context || 128000,
      category: id.includes('embedding') ? 'embedding' :
               id.includes('dall-e') ? 'image' : 'chat',
    };
  }
}
