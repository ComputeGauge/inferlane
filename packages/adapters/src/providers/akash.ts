// ============================================================================
// Akash Network Adapter — Decentralized GPU marketplace for AI inference
// Uses reverse auction pricing; GPU providers compete for workloads.
// 60-80% cheaper than AWS/Azure on-demand. 428% YoY growth.
// Supports OpenAI-compatible API via deployed inference containers.
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

// Akash inference pricing — based on typical deployment costs for open-weight
// models on Akash GPU marketplace. Prices are per-token estimates derived from
// hourly GPU rates (e.g., H100 ~$2.50/hr on Akash vs ~$8-12/hr on AWS).
const AKASH_PRICING: Record<string, { input: number; output: number; context: number }> = {
  'akash/llama-3.3-70b': { input: 0.30, output: 0.30, context: 128000 },
  'akash/llama-3.1-405b': { input: 2.00, output: 2.00, context: 128000 },
  'akash/mixtral-8x22b': { input: 0.40, output: 0.40, context: 65536 },
  'akash/qwen-2.5-72b': { input: 0.35, output: 0.35, context: 128000 },
  'akash/mistral-large': { input: 0.60, output: 0.60, context: 128000 },
};

export class AkashAdapter implements InferLaneAdapter {
  readonly provider = 'akash' as const;
  readonly version = '0.1.0';

  private apiKey: string = '';
  private gatewayUrl = ''; // User must provide their Akash deployment URL
  private connected = false;

  private spendThresholdCallbacks: Array<(alert: SpendAlert) => void> = [];
  private pricingChangeCallbacks: Array<(change: PricingChange) => void> = [];

  async connect(credentials: ProviderCredentials): Promise<void> {
    // Akash requires a deployment URL — users deploy inference containers
    // and get a unique endpoint. API key is optional (depends on deployment).
    if (!credentials.metadata?.gatewayUrl) {
      throw new Error(
        '[Akash] Deployment URL required. Deploy an inference container on Akash ' +
        'and provide the endpoint URL via metadata.gatewayUrl.'
      );
    }
    this.gatewayUrl = credentials.metadata.gatewayUrl as string;
    this.apiKey = credentials.apiKey ?? '';
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.apiKey = '';
    this.gatewayUrl = '';
    this.connected = false;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    if (!this.gatewayUrl) {
      return {
        provider: 'akash' as any,
        healthy: false,
        latencyMs: 0,
        message: 'No deployment URL configured',
        checkedAt: new Date(),
      };
    }

    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

      const res = await fetch(`${this.gatewayUrl}/v1/models`, { headers });
      return {
        provider: 'akash' as any,
        healthy: res.ok,
        latencyMs: Date.now() - start,
        message: res.ok ? 'Akash deployment reachable' : `HTTP ${res.status}`,
        checkedAt: new Date(),
      };
    } catch (error) {
      return {
        provider: 'akash' as any,
        healthy: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'Deployment unreachable',
        checkedAt: new Date(),
      };
    }
  }

  async getUsage(period: DateRange): Promise<UsageData> {
    // Akash billing is hourly GPU rental — not per-token.
    // Actual per-request costs are tracked by InferLane's ProxyRequest logging.
    return {
      provider: 'akash' as any,
      period,
      totalCostUsd: 0,
      totalTokens: 0,
      totalRequests: 0,
      currency: 'USD',
      models: [],
    };
  }

  async getCurrentSpend(): Promise<SpendSummary> {
    return {
      provider: 'akash' as any,
      currentPeriod: new Date().toISOString().slice(0, 7),
      totalSpendUsd: 0,
      dailyAverage: 0,
      projectedMonthEnd: 0,
      topModel: 'akash/llama-3.3-70b',
      topModelSpend: 0,
    };
  }

  async getModels(): Promise<ModelInfo[]> {
    this.ensureConnected();

    // Try fetching from the Akash deployment
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

      const res = await fetch(`${this.gatewayUrl}/v1/models`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.data && Array.isArray(data.data)) {
          return data.data.map((m: any) => {
            const pricing = AKASH_PRICING[`akash/${m.id}`];
            return {
              id: `akash/${m.id}`,
              name: m.id,
              provider: 'akash' as any,
              inputPricePerMToken: pricing?.input ?? 0.35,
              outputPricePerMToken: pricing?.output ?? 0.35,
              contextWindow: pricing?.context ?? 128000,
              category: 'chat' as const,
              capabilities: ['decentralized', 'self-hosted'],
            };
          });
        }
      }
    } catch {
      // Fall through
    }

    return Object.entries(AKASH_PRICING).map(([id, pricing]) => ({
      id,
      name: id.replace('akash/', ''),
      provider: 'akash' as any,
      inputPricePerMToken: pricing.input,
      outputPricePerMToken: pricing.output,
      contextWindow: pricing.context,
      category: 'chat' as const,
      capabilities: ['decentralized', 'self-hosted'],
    }));
  }

  async getPricing(): Promise<PricingInfo[]> {
    return Object.entries(AKASH_PRICING).map(([model, pricing]) => ({
      model,
      provider: 'akash' as any,
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
    if (!this.connected) {
      throw new Error('[Akash] Not connected. Call connect() first.');
    }
  }
}
