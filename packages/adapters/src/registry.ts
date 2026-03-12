// ============================================================================
// Adapter Registry — Manages provider adapters
// ============================================================================

import type { ComputeGaugeAdapter, AdapterRegistry, ProviderName } from './types.js';

export class DefaultAdapterRegistry implements AdapterRegistry {
  private adapters: Map<ProviderName, ComputeGaugeAdapter> = new Map();

  register(adapter: ComputeGaugeAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  get(provider: ProviderName): ComputeGaugeAdapter | undefined {
    return this.adapters.get(provider);
  }

  list(): ComputeGaugeAdapter[] {
    return Array.from(this.adapters.values());
  }

  async getConnected(): Promise<ComputeGaugeAdapter[]> {
    const results: ComputeGaugeAdapter[] = [];
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
