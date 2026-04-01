import { describe, it, expect } from 'vitest';

/**
 * Dashboard Logic Tests
 *
 * Tests the computation logic used in the dashboard page
 * (stats calculation, projections, budget tracking).
 */

describe('Dashboard Stats Computation', () => {

  // ─── Budget Projections ──────────────────────────────────────

  describe('Monthly spend projection', () => {
    it('projects spend based on current daily rate', () => {
      const totalSpend = 100; // $100 spent so far
      const dayOfMonth = 10;
      const daysInMonth = 30;

      const dailyRate = totalSpend / dayOfMonth;
      const projected = dailyRate * daysInMonth;

      expect(dailyRate).toBe(10);
      expect(projected).toBe(300);
    });

    it('detects when projection exceeds budget', () => {
      const totalBudget = 260;
      const projectedMonthly = 357;

      const willExceed = projectedMonthly > totalBudget;
      const overBy = projectedMonthly - totalBudget;

      expect(willExceed).toBe(true);
      expect(overBy).toBe(97);
    });

    it('returns zero projection when day is zero', () => {
      const totalSpend = 50;
      const today = 0;
      const daysInMonth = 30;

      const projected = today > 0 ? (totalSpend / today) * daysInMonth : 0;
      expect(projected).toBe(0);
    });
  });

  // ─── Budget Utilization ──────────────────────────────────────

  describe('Provider budget utilization', () => {
    it('calculates percentage used correctly', () => {
      const currentSpend = 67.42;
      const monthlyBudget = 100;

      const percentUsed = (currentSpend / monthlyBudget) * 100;
      expect(percentUsed).toBeCloseTo(67.42, 2);
    });

    it('calculates remaining budget', () => {
      const currentSpend = 67.42;
      const monthlyBudget = 100;

      const remaining = monthlyBudget - currentSpend;
      expect(remaining).toBeCloseTo(32.58, 2);
    });

    it('caps display at 100% even when overbudget', () => {
      const currentSpend = 120;
      const monthlyBudget = 100;

      const percentUsed = (currentSpend / monthlyBudget) * 100;
      const displayPercent = Math.min(percentUsed, 100);

      expect(percentUsed).toBe(120);
      expect(displayPercent).toBe(100);
    });
  });

  // ─── Active Model Count ──────────────────────────────────────

  describe('Active model counting', () => {
    it('sums models across all providers', () => {
      const providers = [
        { models: [{ name: 'claude-3.5' }, { name: 'claude-3-opus' }] },
        { models: [{ name: 'gpt-4' }, { name: 'gpt-3.5' }, { name: 'o1' }] },
        { models: [{ name: 'gemini-pro' }] },
      ];

      const totalModels = providers.reduce((sum, p) => sum + p.models.length, 0);
      expect(totalModels).toBe(6);
    });

    it('handles empty providers list', () => {
      const providers: Array<{ models: unknown[] }> = [];
      const totalModels = providers.reduce((sum, p) => sum + p.models.length, 0);
      expect(totalModels).toBe(0);
    });

    it('counts provider count correctly', () => {
      const providers = [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }];
      expect(providers.length).toBe(4);
    });
  });

  // ─── Budget Aggregation ──────────────────────────────────────

  describe('Total budget aggregation', () => {
    it('sums budgets across all providers', () => {
      const providers = [
        { monthlyBudget: 100 },
        { monthlyBudget: 80 },
        { monthlyBudget: 50 },
        { monthlyBudget: 30 },
      ];

      const totalBudget = providers.reduce((sum, p) => sum + p.monthlyBudget, 0);
      expect(totalBudget).toBe(260);
    });
  });

  // ─── Token Formatting ────────────────────────────────────────

  describe('Token count formatting', () => {
    const formatTokens = (n: number) => {
      if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
      if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
      return n.toString();
    };

    it('formats millions correctly', () => {
      expect(formatTokens(1_500_000)).toBe('1.5M');
      expect(formatTokens(10_000_000)).toBe('10.0M');
    });

    it('formats thousands correctly', () => {
      expect(formatTokens(1_000)).toBe('1K');
      expect(formatTokens(50_000)).toBe('50K');
      expect(formatTokens(999_999)).toBe('1000K');
    });

    it('formats small numbers as-is', () => {
      expect(formatTokens(500)).toBe('500');
      expect(formatTokens(0)).toBe('0');
      expect(formatTokens(999)).toBe('999');
    });
  });

  // ─── Alert Time Formatting ───────────────────────────────────

  describe('Alert timestamp formatting', () => {
    const timeAgo = (date: Date) => {
      const mins = Math.floor((Date.now() - date.getTime()) / 60000);
      if (mins < 60) return `${mins}m ago`;
      return `${Math.floor(mins / 60)}h ago`;
    };

    it('shows minutes for recent alerts', () => {
      const tenMinAgo = new Date(Date.now() - 10 * 60000);
      expect(timeAgo(tenMinAgo)).toBe('10m ago');
    });

    it('shows hours for older alerts', () => {
      const twoHoursAgo = new Date(Date.now() - 120 * 60000);
      expect(timeAgo(twoHoursAgo)).toBe('2h ago');
    });

    it('shows 0m ago for just-now alerts', () => {
      const now = new Date();
      expect(timeAgo(now)).toBe('0m ago');
    });
  });
});
