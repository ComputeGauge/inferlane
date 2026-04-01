import { describe, it, expect } from 'vitest';
import type {
  ProviderConfig,
  ModelUsage,
  CloudAlternative,
  Alert,
  SpendSnapshot,
  CostComparison,
  TimeRange,
} from '../types';

describe('type exports', () => {
  it('ProviderConfig has required shape', () => {
    const provider: ProviderConfig = {
      id: 'anthropic',
      name: 'Anthropic',
      icon: '/anthropic.svg',
      color: '#d4a27f',
      gradientFrom: '#d4a27f',
      gradientTo: '#c4956f',
      apiKeyEnvVar: 'ANTHROPIC_API_KEY',
      monthlyBudget: 500,
      currentSpend: 234.56,
      dailySpend: [10, 12, 8, 15],
      topUpUrl: 'https://console.anthropic.com',
      partnerUrl: 'https://aws.amazon.com/bedrock',
      models: [],
      cloudAlternatives: [],
    };

    expect(provider.id).toBe('anthropic');
    expect(provider.monthlyBudget).toBeGreaterThan(0);
    expect(Array.isArray(provider.dailySpend)).toBe(true);
  });

  it('Alert has correct type literals', () => {
    const alert: Alert = {
      id: '1',
      providerId: 'anthropic',
      providerName: 'Anthropic',
      type: 'warning',
      message: 'Budget at 80%',
      threshold: 400,
      triggered: true,
      timestamp: new Date(),
    };

    expect(['warning', 'critical', 'info']).toContain(alert.type);
    expect(alert.triggered).toBe(true);
  });

  it('SpendSnapshot has all provider fields', () => {
    const snapshot: SpendSnapshot = {
      date: '2026-03-01',
      anthropic: 100,
      openai: 50,
      google: 25,
      other: 10,
      total: 185,
    };

    expect(snapshot.total).toBe(
      snapshot.anthropic + snapshot.openai + snapshot.google + snapshot.other
    );
  });

  it('TimeRange accepts valid values', () => {
    const ranges: TimeRange[] = ['24h', '7d', '30d', '90d'];
    expect(ranges).toHaveLength(4);
  });

  it('CostComparison structure is valid', () => {
    const comp: CostComparison = {
      model: 'Test',
      task: 'Test task',
      providers: [
        { name: 'Model A', cost: 0.01, speed: '1s', quality: 90 },
      ],
    };

    expect(comp.providers[0].quality).toBeLessThanOrEqual(100);
  });
});
