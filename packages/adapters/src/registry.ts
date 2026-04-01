// ============================================================================
// Adapter Registry — Manages provider adapters
// ============================================================================

import type { InferLaneAdapter, AdapterRegistry, ProviderName } from './types.js';

export class DefaultAdapterRegistry implements AdapterRegistry {
  private adapters: Map<ProviderName, InferLaneAdapter> = new Map();

  register(adapter: InferLaneAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  get(provider: ProviderName): InferLaneAdapter | undefined {
    return this.adapters.get(provider);
  }

  list(): InferLaneAdapter[] {
    return Array.from(this.adapters.values());
  }

  async getConnected(): Promise<InferLaneAdapter[]> {
    const results: InferLaneAdapter[] = [];
    for (const adapter of this.adapters.values()) {
      try {
        const health = await adapter.healthCheck();
        if (health.healthy) {
          results.push(adapter);
        }
      } catch {
        // Skip unhealthy adapters
      }
    }
    return results;
  }

  /** Get aggregated spend across all connected providers */
  async getAggregatedSpend(): Promise<{
    totalSpendUsd: number;
    projectedMonthEnd: number;
    byProvider: Array<{
      provider: ProviderName;
      spendUsd: number;
      percent: number;
    }>;
  }> {
    const connected = await this.getConnected();
    const spends = await Promise.allSettled(
      connected.map((a) => a.getCurrentSpend())
    );

    let totalSpend = 0;
    let totalProjected = 0;
    const byProvider: Array<{ provider: ProviderName; spendUsd: number; percent: number }> = [];

    for (const result of spends) {
      if (result.status === 'fulfilled') {
        totalSpend += result.value.totalSpendUsd;
        totalProjected += result.value.projectedMonthEnd;
        byProvider.push({
          provider: result.value.provider,
          spendUsd: result.value.totalSpendUsd,
          percent: 0, // calculated below
        });
      }
    }

    // Calculate percentages
    for (const entry of byProvider) {
      entry.percent = totalSpend > 0 ? (entry.spendUsd / totalSpend) * 100 : 0;
    }

    return {
      totalSpendUsd: totalSpend,
      projectedMonthEnd: totalProjected,
      byProvider: byProvider.sort((a, b) => b.spendUsd - a.spendUsd),
    };
  }
}

/** Singleton registry */
export const registry = new DefaultAdapterRegistry();
