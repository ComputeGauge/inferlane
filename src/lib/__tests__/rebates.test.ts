// Unit tests for provider rebate lookup + computation.
//
// Pure-function behavior only; no DB, no network. The key properties
// under test:
//   - lookupRebate respects time windows (effectiveFrom / effectiveUntil)
//   - lookupRebate picks the highest-discount applicable config
//   - lookupRebate prefers model-specific configs over wildcards
//   - computeInvoicedAmount respects the volume tier selection
//   - Expired configs never apply

import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerRebate,
  lookupRebate,
  computeInvoicedAmount,
  listDisclosedRebates,
  type ProviderRebateConfig,
} from '@/lib/rebates';

// The registry is module-local in-memory state. We can't clear it
// between tests without a reset helper, so we use unique provider
// names per test suite to avoid cross-contamination.

describe('rebates: lookupRebate', () => {
  beforeEach(() => {
    registerRebate({
      provider: 'test-provider-A',
      model: null,
      kind: 'FLAT_PERCENT',
      discountBps: 1000,
      effectiveFrom: new Date('2020-01-01'),
      effectiveUntil: new Date('2099-01-01'),
      disclosed: true,
    });
    registerRebate({
      provider: 'test-provider-A',
      model: 'premium-model',
      kind: 'FLAT_PERCENT',
      discountBps: 1500,
      effectiveFrom: new Date('2020-01-01'),
      effectiveUntil: new Date('2099-01-01'),
      disclosed: false,
    });
  });

  it('returns the model-specific config when one matches', () => {
    const cfg = lookupRebate('test-provider-A', 'premium-model');
    expect(cfg).not.toBeNull();
    expect(cfg?.discountBps).toBe(1500);
  });

  it('returns the wildcard config for other models', () => {
    const cfg = lookupRebate('test-provider-A', 'other-model');
    expect(cfg).not.toBeNull();
    expect(cfg?.discountBps).toBe(1000);
  });

  it('returns null for unknown providers', () => {
    const cfg = lookupRebate('unknown-provider-xyz', 'any-model');
    expect(cfg).toBeNull();
  });

  it('rejects configs outside their effective window', () => {
    registerRebate({
      provider: 'test-provider-B',
      model: null,
      kind: 'FLAT_PERCENT',
      discountBps: 500,
      effectiveFrom: new Date('2099-01-01'),  // future
      effectiveUntil: new Date('2100-01-01'),
      disclosed: false,
    });
    const cfg = lookupRebate('test-provider-B', 'any');
    expect(cfg).toBeNull();
  });

  it('rejects expired configs', () => {
    registerRebate({
      provider: 'test-provider-C',
      model: null,
      kind: 'FLAT_PERCENT',
      discountBps: 800,
      effectiveFrom: new Date('2000-01-01'),
      effectiveUntil: new Date('2001-01-01'),  // past
      disclosed: false,
    });
    const cfg = lookupRebate('test-provider-C', 'any');
    expect(cfg).toBeNull();
  });
});

describe('rebates: computeInvoicedAmount', () => {
  const flat: ProviderRebateConfig = {
    provider: 'p',
    model: 'm',
    kind: 'FLAT_PERCENT',
    discountBps: 1500,
    effectiveFrom: new Date('2020-01-01'),
    effectiveUntil: null,
    disclosed: false,
  };

  it('applies a flat percent discount', () => {
    const invoiced = computeInvoicedAmount({
      rackRateUsdCents: BigInt(10_000),
      config: flat,
    });
    expect(invoiced).toBe(BigInt(8_500));
  });

  it('returns the rack rate when config is expired', () => {
    const expired: ProviderRebateConfig = {
      ...flat,
      effectiveUntil: new Date('2001-01-01'),
    };
    expect(
      computeInvoicedAmount({
        rackRateUsdCents: BigInt(10_000),
        config: expired,
      }),
    ).toBe(BigInt(10_000));
  });

  it('handles volume-tiered discounts', () => {
    const tiered: ProviderRebateConfig = {
      provider: 'p',
      model: null,
      kind: 'VOLUME_TIERED',
      discountBps: 0,
      volumeTiers: [
        { minTokensPerMonth: BigInt(0), discountBps: 500 },
        { minTokensPerMonth: BigInt(1_000_000), discountBps: 1000 },
        { minTokensPerMonth: BigInt(10_000_000), discountBps: 1500 },
      ],
      effectiveFrom: new Date('2020-01-01'),
      effectiveUntil: null,
      disclosed: false,
    };

    // At 500K tokens → bottom tier, 5% discount
    let invoiced = computeInvoicedAmount({
      rackRateUsdCents: BigInt(10_000),
      config: tiered,
      monthlyTokens: BigInt(500_000),
    });
    expect(invoiced).toBe(BigInt(9_500));

    // At 5M tokens → middle tier, 10%
    invoiced = computeInvoicedAmount({
      rackRateUsdCents: BigInt(10_000),
      config: tiered,
      monthlyTokens: BigInt(5_000_000),
    });
    expect(invoiced).toBe(BigInt(9_000));

    // At 50M tokens → top tier, 15%
    invoiced = computeInvoicedAmount({
      rackRateUsdCents: BigInt(10_000),
      config: tiered,
      monthlyTokens: BigInt(50_000_000),
    });
    expect(invoiced).toBe(BigInt(8_500));
  });

  it('returns zero when discount is >= 100%', () => {
    const fullDiscount: ProviderRebateConfig = {
      ...flat,
      discountBps: 20_000,   // 200% — silly input
    };
    const invoiced = computeInvoicedAmount({
      rackRateUsdCents: BigInt(10_000),
      config: fullDiscount,
    });
    expect(invoiced).toBe(BigInt(0));
  });
});

describe('rebates: listDisclosedRebates', () => {
  it('returns only disclosed configs', () => {
    registerRebate({
      provider: 'test-provider-disclosed',
      model: null,
      kind: 'FLAT_PERCENT',
      discountBps: 1000,
      effectiveFrom: new Date('2020-01-01'),
      effectiveUntil: null,
      disclosed: true,
    });
    registerRebate({
      provider: 'test-provider-undisclosed',
      model: null,
      kind: 'FLAT_PERCENT',
      discountBps: 1000,
      effectiveFrom: new Date('2020-01-01'),
      effectiveUntil: null,
      disclosed: false,
    });

    const disclosed = listDisclosedRebates();
    expect(disclosed.some((c) => c.provider === 'test-provider-disclosed')).toBe(true);
    expect(disclosed.some((c) => c.provider === 'test-provider-undisclosed')).toBe(false);
  });
});
