'use client';

import { useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Credit Burn Plan — Visualise how credits will be consumed
// ---------------------------------------------------------------------------
// Shows users which credit sources will be consumed and in what order
// for a given estimated workload cost. Includes stacked bar visualization,
// source switch points, and estimated savings vs. face value.
// ---------------------------------------------------------------------------

interface CreditSource {
  type: string;
  available: number;
  expiresAt: string;
  decayFactor: number;
  effectiveCostPerCredit: number;
  priority: number;
  offerId?: string;
}

interface SwitchPoint {
  afterCost: number;
  fromSource: string;
  toSource: string;
}

interface BatchPlan {
  totalEstimatedCost: number;
  sources: CreditSource[];
  switchPoints: SwitchPoint[];
  totalAvailable: number;
  coveragePercent: number;
  estimatedSavings: number;
}

const SOURCE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  MARKETPLACE_PURCHASE: { bg: 'bg-green-600', text: 'text-green-400', label: 'Marketplace Credits' },
  OWN_CREDITS: { bg: 'bg-amber-600', text: 'text-amber-400', label: 'Own Credits' },
  POOL_DELEGATION: { bg: 'bg-blue-600', text: 'text-blue-400', label: 'Pool Delegation' },
  ON_DEMAND: { bg: 'bg-red-600', text: 'text-red-400', label: 'On-Demand (Stripe)' },
};

export default function CreditBurnPlan() {
  const [estimatedCost, setEstimatedCost] = useState('');
  const [plan, setPlan] = useState<BatchPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculatePlan = useCallback(async () => {
    const cost = parseFloat(estimatedCost);
    if (isNaN(cost) || cost <= 0) {
      setError('Enter a valid cost estimate');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/credits/burn-plan?cost=${cost}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to calculate plan');
        return;
      }
      const data = await res.json();
      setPlan(data);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [estimatedCost]);

  return (
    <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-6 space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-white">Credit Burn Planner</h3>
        <p className="text-sm text-gray-500 mt-1">
          Estimate how your credits will be consumed for a workload
        </p>
      </div>

      {/* Cost Input */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Estimated Total Cost ($)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={estimatedCost}
            onChange={(e) => setEstimatedCost(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && calculatePlan()}
            placeholder="e.g., 25.00"
            className="w-full bg-[#0a0a0f] border border-[#2a2a3e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-600"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={calculatePlan}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 text-white font-medium text-sm hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 transition-all"
          >
            {loading ? 'Calculating...' : 'Plan'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Plan Results */}
      {plan && (
        <div className="space-y-4">
          {/* Coverage Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Credit Coverage</span>
              <span className="text-sm font-mono text-white">
                {plan.coveragePercent.toFixed(0)}%
              </span>
            </div>
            <div className="h-6 rounded-full bg-[#0a0a0f] border border-[#2a2a3e] overflow-hidden flex">
              {plan.sources.map((source, i) => {
                const consumption = Math.min(
                  source.available,
                  i === 0 ? plan.totalEstimatedCost : 0, // simplified for display
                );
                const widthPct = (consumption / plan.totalEstimatedCost) * 100;
                if (widthPct <= 0) return null;

                const colors = SOURCE_COLORS[source.type] || SOURCE_COLORS.ON_DEMAND;
                return (
                  <div
                    key={`${source.type}-${i}`}
                    className={`${colors.bg} h-full transition-all`}
                    style={{ width: `${Math.min(widthPct, 100)}%` }}
                    title={`${colors.label}: $${consumption.toFixed(2)}`}
                  />
                );
              })}
              {plan.coveragePercent < 100 && (
                <div
                  className="bg-red-900/50 h-full"
                  style={{ width: `${100 - plan.coveragePercent}%` }}
                  title={`Uncovered: $${(plan.totalEstimatedCost - plan.totalAvailable).toFixed(2)}`}
                />
              )}
            </div>
          </div>

          {/* Source Breakdown */}
          <div className="space-y-2">
            {plan.sources.filter((s) => s.available > 0).map((source, i) => {
              const colors = SOURCE_COLORS[source.type] || SOURCE_COLORS.ON_DEMAND;
              const daysRemaining = Math.max(
                0,
                (new Date(source.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
              );

              return (
                <div
                  key={`${source.type}-${i}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-[#0a0a0f] border border-[#1e1e2e]"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${colors.bg}`} />
                    <div>
                      <span className={`text-sm font-medium ${colors.text}`}>
                        {colors.label}
                      </span>
                      <p className="text-xs text-gray-600">
                        {daysRemaining.toFixed(0)} days remaining
                        {source.type === 'MARKETPLACE_PURCHASE' && (
                          <> &middot; Paid ${source.effectiveCostPerCredit.toFixed(2)}/credit</>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-mono text-white">
                      ${source.available.toFixed(2)}
                    </span>
                    <p className="text-xs text-gray-600">available</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Switch Points */}
          {plan.switchPoints.length > 0 && (
            <div className="border-t border-[#1e1e2e] pt-3">
              <h4 className="text-xs text-gray-500 mb-2">Source Transitions</h4>
              {plan.switchPoints.map((sp, i) => {
                const fromColors = SOURCE_COLORS[sp.fromSource] || SOURCE_COLORS.ON_DEMAND;
                const toColors = SOURCE_COLORS[sp.toSource] || SOURCE_COLORS.ON_DEMAND;
                return (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-400 py-1">
                    <span className="font-mono">${sp.afterCost.toFixed(2)}</span>
                    <span>→</span>
                    <span className={fromColors.text}>{fromColors.label}</span>
                    <span>→</span>
                    <span className={toColors.text}>{toColors.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Savings Summary */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="bg-[#0a0a0f] rounded-lg p-3 text-center">
              <span className="text-xs text-gray-500">Total Available</span>
              <p className="text-lg font-mono text-white">${plan.totalAvailable.toFixed(2)}</p>
            </div>
            <div className="bg-[#0a0a0f] rounded-lg p-3 text-center">
              <span className="text-xs text-gray-500">Estimated Cost</span>
              <p className="text-lg font-mono text-white">${plan.totalEstimatedCost.toFixed(2)}</p>
            </div>
            <div className="bg-[#0a0a0f] rounded-lg p-3 text-center">
              <span className="text-xs text-gray-500">Savings</span>
              <p className={`text-lg font-mono ${plan.estimatedSavings > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                ${plan.estimatedSavings.toFixed(2)}
              </p>
            </div>
          </div>

          {plan.coveragePercent < 100 && (
            <div className="p-3 bg-amber-900/20 border border-amber-700/30 rounded-lg text-amber-300 text-sm">
              Credits cover {plan.coveragePercent.toFixed(0)}% of estimated cost.
              The remaining ${(plan.totalEstimatedCost * (1 - plan.coveragePercent / 100)).toFixed(2)} will
              be charged to your payment method.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
