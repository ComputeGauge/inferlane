// ============================================================================
// Bittensor Adapter — Decentralized AI inference via Bittensor subnets
// Primary subnets: Chutes (SN64) for serverless inference,
//                  Nineteen (SN19) for ultra-low-latency inference
// Uses OpenAI-compatible API endpoints exposed by subnet gateways
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

// Bittensor subnet model pricing (subsidized rates as of March 2026)
// NOTE: These prices are artificially low due to ~$52M/year in TAO emission
// subsidies. Actual unsubsidized costs are 1.6-3.5x higher than centralized.
// Prices should be monitored and updated as subsidy levels change post-halving.
const BITTENSOR_PRICING: Record<string, { input: number; output: number; context: number }> = {
  // Chutes (SN64) — serverless inference, largest subnet
  'bittensor/llama-3.3-70b': { input: 0.18, output: 0.18, context: 128000 },
  'bittensor/llama-3.1-405b': { input: 1.20, output: 1.20, context: 128000 },
  'bittensor/mixtral-8x22b': { input: 0.30, output: 0.30, context: 65536 },
  'bittensor/qwen-2.5-72b': { input: 0.20, output: 0.20, context: 128000 },
  // Nineteen (SN19) — low-latency inference
  'bittensor/llama-3.3-70b-fast': { input: 0.25, output: 0.25, context: 128000 },
  // Covenant-72B — Bittensor's own permissionlessly trained model
  'bittensor/covenant-72b': { input: 0.20, output: 0.20, context: 32768 },
};

export class BittensorAdapter implements InferLaneAdapter {
  readonly provider = 'bittensor' as const;
  readonly version = '0.1.0';

  private apiKey: string = '';
  private gatewayUrl = 'https://api.chutes.ai'; // Chutes SN64 gateway
  private connected = false;

  private spendThresholdCallbacks: Array<(alert: SpendAlert) => void> = [];
  private pricingChangeCallbacks: Array<(change: PricingChange) => void> = [];

  async connect(credentials: ProviderCredentials): Promise<void> {
    if (!credentials.apiKey) {
      throw new Error('[Bittensor] API key required for subnet gateway access');
    }
    this.apiKey = credentials.apiKey;
    // Allow custom gateway URL (e.g., Nineteen SN19, self-hosted validator)
    if (credentials.metadata?.gatewayUrl) {
      this.gatewayUrl = credentials.metadata.gatewayUrl as string;
    }
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.apiKey = '';
    this.connected = false;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.gatewayUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return {
        provider: 'bittensor' as any,
        healthy: res.ok,
        latencyMs: Date.now() - start,
        message: res.ok ? 'Subnet gateway reachable' : `HTTP ${res.status}`,
        checkedAt: new Date(),
      };
    } catch (error) {
      return {
        provider: 'bittensor' as any,
        healthy: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'Gateway unreachable',
        checkedAt: new Date(),
      };
    }
  }

  async getUsage(period: DateRange): Promise<UsageData> {
    // Bittensor subnet gateways don't expose usage APIs in the same way
    // centralized providers do. Usage is tracked on-chain via TAO transactions
    // but per-request data is off-chain. We return empty usage and rely on
    // InferLane's own ProxyRequest logging for cost tracking.
    return {
      provider: 'bittensor' as any,
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
      provider: 'bittensor' as any,
      currentPeriod: new Date().toISOString().slice(0, 7),
      totalSpendUsd: 0,
      dailyAverage: 0,
      projectedMonthEnd: 0,
      topModel: 'bittensor/llama-3.3-70b',
      topModelSpend: 0,
    };
  }

  async getModels(): Promise<ModelInfo[]> {
    this.ensureConnected();

    // Try fetching from gateway first
    try {
      const res = await fetch(`${this.gatewayUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data && Array.isArray(data.data)) {
          return data.data.map((m: any) => {
            const pricing = BITTENSOR_PRICING[`bittensor/${m.id}`];
            return {
              id: `bittensor/${m.id}`,
              name: m.id,
              provider: 'bittensor' as any,
              inputPricePerMToken: pricing?.input ?? 0.20,
              outputPricePerMToken: pricing?.output ?? 0.20,
              contextWindow: pricing?.context ?? 128000,
              category: 'chat' as const,
              capabilities: ['decentralized', 'subsidized'],
            };
          });
        }
      }
    } catch {
      // Fall through to known models
    }

    return Object.entries(BITTENSOR_PRICING).map(([id, pricing]) => ({
      id,
      name: id.replace('bittensor/', ''),
      provider: 'bittensor' as any,
      inputPricePerMToken: pricing.input,
      outputPricePerMToken: pricing.output,
      contextWindow: pricing.context,
      category: 'chat' as const,
      capabilities: ['decentralized', 'subsidized'],
    }));
  }

  async getPricing(): Promise<PricingInfo[]> {
    return Object.entries(BITTENSOR_PRICING).map(([model, pricing]) => ({
      model,
      provider: 'bittensor' as any,
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
      throw new Error('[Bittensor] Not connected. Call connect() first.');
    }
  }
}
