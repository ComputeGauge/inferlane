import { describe, it, expect } from 'vitest';
import { costComparisons } from '../pricing-data';

describe('pricing-data', () => {
  it('has at least 3 comparison categories', () => {
    expect(costComparisons.length).toBeGreaterThanOrEqual(3);
  });

  it('each comparison has a model name and task', () => {
    for (const comp of costComparisons) {
      expect(comp.model).toBeTruthy();
      expect(comp.task).toBeTruthy();
    }
  });

  it('each comparison has at least 2 provider options', () => {
    for (const comp of costComparisons) {
      expect(comp.providers.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('each provider has cost, speed, and quality', () => {
    for (const comp of costComparisons) {
      for (const provider of comp.providers) {
        expect(provider.name).toBeTruthy();
        expect(typeof provider.cost).toBe('number');
        expect(provider.cost).toBeGreaterThan(0);
        expect(provider.speed).toBeTruthy();
        expect(typeof provider.quality).toBe('number');
        expect(provider.quality).toBeGreaterThanOrEqual(0);
        expect(provider.quality).toBeLessThanOrEqual(100);
      }
    }
  });

  it('quality scores are in 0-100 range', () => {
    for (const comp of costComparisons) {
      for (const provider of comp.providers) {
        expect(provider.quality).toBeGreaterThanOrEqual(0);
        expect(provider.quality).toBeLessThanOrEqual(100);
      }
    }
  });
});
