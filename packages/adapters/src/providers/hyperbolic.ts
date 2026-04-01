// ============================================================================
// Hyperbolic Adapter — Decentralized AI inference via distributed GPU network
// Uses Hyper-dOS (decentralized operating system) to aggregate GPUs globally.
// Claims up to 75% cost reduction vs centralized providers.
// OpenAI-compatible API with zero-storage privacy guarantee.
// ============================================================================

import type {
  InferLaneAdapter,
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

// Hyperbolic model pricing (as of March 2026)
// Rapid onboarding of open-source models (1-2 day turnaround)
const HYPERBOLIC_PRICING: Record<string, { input: number; output: number; context: number }> = {
  'hyperbolic/llama-3.3-70b': { input: 0.20, output: 0.20, context: 128000 },
  'hyperbolic/llama-3.1-405b': { input: 1.50, output: 1.50, context: 128000 },
  'hyperbolic/qwen-2.5-72b': { input: 0.22, output: 0.22, context: 128000 },
  'hyperbolic/deepseek-v3': { input: 0.15, output: 0.15, context: 128000 },
  'hyperbolic/mixtral-8x22b': { input: 0.35, output: 0.35, context: 65536 },
};

export class HyperbolicAdapter implements InferLaneAdapter {
  readonly provider = 'hyperbolic' as const;
  readonly version = '0.1.0';

  private apiKey: string = '';
  private baseUrl = 'https://api.hyperbolic.xyz';
  private connected = false;

  private spendThresholdCallbacks: Array<(alert: SpendAlert) => void> = [];
  private pricingChangeCallbacks: Array<(change: PricingChange) => void> = [];

  async connect(credentials: ProviderCredentials): Promise<void> {
    if (!credentials.apiKey) {
      throw new Error('[Hyperbolic] API key required');
    }
    this.apiKey = credentials.apiKey;
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
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return {
        provider: 'hyperbolic' as any,
        healthy: res.ok,
        latencyMs: Date.now() - start,
        message: res.ok ? 'Hyperbolic API reachable' : `HTTP ${res.status}`,
        checkedAt: new Date(),
      };
    } catch (error) {
      return {
        provider: 'hyperbolic' as any,
        healthy: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'API unreachable',
        checkedAt: new Date(),
      };
    }
  }

  async getUsage(period: DateRange): Promise<UsageData> {
    this.ensureConnected();

    // Hyperbolic provides usage data via their dashboard API
    try {
      const params = new URLSearchParams({
        start: period.start.toISOString(),
        end: period.end.toISOString(),
      });
      const res = await fetch(`${this.baseUrl}/v1/usage?${params}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        return this.parseUsageResponse(data, period);
      }
    } catch {
      // Fall through
    }

    return {
      provider: 'hyperbolic' as any,
      period,
      totalCostUsd: 0,
      totalTokens: 0,
      totalRequests: 0,
      currency: 'USD',
      models: [],
    };
  }

  async getCurrentSpend(): Promise<SpendSummary> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const usage = await this.getUsage({ start: startOfMonth, end: now });

    const daysElapsed = Math.max(1, (now.getTime() - startOfMonth.getTime()) / (1000 * 60 * 60 * 24));
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    return {
      provider: 'hyperbolic' as any,
      currentPeriod: now.toISOString().slice(0, 7),
      totalSpendUsd: usage.totalCostUsd,
      dailyAverage: usage.totalCostUsd / daysElapsed,
      projectedMonthEnd: (usage.totalCostUsd / daysElapsed) * daysInMonth,
      topModel: usage.models[0]?.model ?? 'hyperbolic/llama-3.3-70b',
      topModelSpend: usage.models[0]?.costUsd ?? 0,
    };
  }

  async getModels(): Promise<ModelInfo[]> {
    this.ensureConnected();

    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data && Array.isArray(data.data)) {
          return data.data.map((m: any) => {
            const pricing = HYPERBOLIC_PRICING[`hyperbolic/${m.id}`];
            return {
              id: `hyperbolic/${m.id}`,
              name: m.id,
              provider: 'hyperbolic' as any,
              inputPricePerMToken: pricing?.input ?? 0.20,
              outputPricePerMToken: pricing?.output ?? 0.20,
              contextWindow: pricing?.context ?? 128000,
              category: 'chat' as const,
              capabilities: ['decentralized', 'zero-storage-privacy'],
            };
          });
        }
      }
    } catch {
      // Fall through
    }

    return Object.entries(HYPERBOLIC_PRICING).map(([id, pricing]) => ({
      id,
      name: id.replace('hyperbolic/', ''),
      provider: 'hyperbolic' as any,
      inputPricePerMToken: pricing.input,
      outputPricePerMToken: pricing.output,
      contextWindow: pricing.context,
      category: 'chat' as const,
      capabilities: ['decentralized', 'zero-storage-privacy'],
    }));
  }

  async getPricing(): Promise<PricingInfo[]> {
    return Object.entries(HYPERBOLIC_PRICING).map(([model, pricing]) => ({
      model,
      provider: 'hyperbolic' as any,
      inputPricePerMToken: pricing.input,
      outputPricePerMToken: pricing.output,
      effectiveDate: new Date('2026-03-01'),
    }));
  }

  onSpendThreshold(callback: (alert: SpendAlert) => void): void {
    this.spendThresholdCallbacks.push(callback);
  }

  onPricingChange(callback: (change: PricingChange) => void): void {
    this.pricingChangeCallbacks.push(callback);
  }

  private ensureConnected(): void {
    if (!this.connected || !this.apiKey) {
      throw new Error('[Hyperbolic] Not connected. Call connect() first.');
    }
  }

  private parseUsageResponse(data: any, period: DateRange): UsageData {
    const usage: UsageData = {
      provider: 'hyperbolic' as any,
      period,
      totalCostUsd: 0,
      totalTokens: 0,
      totalRequests: 0,
      currency: 'USD',
      models: [],
    };

    const items = data.usage || data.data || [];
    const modelMap = new Map<string, { input: number; output: number; cost: number; requests: number }>();

    for (const item of items) {
      const model = item.model || 'unknown';
      const inputTokens = item.input_tokens || 0;
      const outputTokens = item.output_tokens || 0;
      const existing = modelMap.get(model) || { input: 0, output: 0, cost: 0, requests: 0 };
      existing.input += inputTokens;
      existing.output += outputTokens;
      existing.requests += 1;

      const pricing = HYPERBOLIC_PRICING[`hyperbolic/${model}`];
      if (pricing) {
        existing.cost += (inputTokens / 1_000_000) * pricing.input +
                         (outputTokens / 1_000_000) * pricing.output;
      }
      modelMap.set(model, existing);
    }

    for (const [model, d] of modelMap) {
      usage.models.push({
        model: `hyperbolic/${model}`,
        inputTokens: d.input,
        outputTokens: d.output,
        totalTokens: d.input + d.output,
        costUsd: d.cost,
        requests: d.requests,
      });
      usage.totalTokens += d.input + d.output;
      usage.totalCostUsd += d.cost;
      usage.totalRequests += d.requests;
    }

    return usage;
  }
}
