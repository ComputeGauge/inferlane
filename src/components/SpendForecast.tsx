'use client';

import { useEffect, useState } from 'react';

interface ForecastResult {
  currentSpend: number;
  projectedMonthEnd: number;
  burnRate: number;
  daysRemaining: number;
  confidenceLow: number;
  confidenceHigh: number;
  trendDirection: 'up' | 'down' | 'flat';
  percentChange: number;
}

interface ProviderForecast extends ForecastResult {
  provider: string;
  providerConnectionId: string;
}

interface FullForecast {
  overall: ForecastResult;
  byProvider: ProviderForecast[];
}

function formatCurrency(amount: number): string {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}k`;
  }
  return `$${amount.toFixed(2)}`;
}

function TrendArrow({ direction, percentChange }: { direction: string; percentChange: number }) {
  if (direction === 'up') {
    return (
      <span className="inline-flex items-center gap-1 text-red-400 text-sm font-medium">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
        +{Math.abs(percentChange).toFixed(1)}%
      </span>
    );
  }
  if (direction === 'down') {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-400 text-sm font-medium">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        -{Math.abs(percentChange).toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-gray-400 text-sm font-medium">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
      </svg>
      Flat
    </span>
  );
}

export default function SpendForecast() {
  const [forecast, setForecast] = useState<FullForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchForecast() {
      try {
        const res = await fetch('/api/forecast');
        if (!res.ok) throw new Error('Failed to load forecast');
        const data = await res.json();
        setForecast(data);
      } catch (err) {
        setError('Unable to load forecast data');
      } finally {
        setLoading(false);
      }
    }
    fetchForecast();
  }, []);

  if (loading) {
    return (
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-48 bg-[#1e1e2e] rounded" />
          <div className="h-8 w-64 bg-[#1e1e2e] rounded" />
          <div className="h-4 w-full bg-[#1e1e2e] rounded" />
          <div className="h-4 w-32 bg-[#1e1e2e] rounded" />
        </div>
      </div>
    );
  }

  if (error || !forecast) {
    return null; // Silently hide on error — dashboard still works
  }

  const { overall, byProvider } = forecast;
  const topProviders = byProvider.slice(0, 3);

  // Bar calculations
  const maxVal = Math.max(overall.confidenceHigh, overall.projectedMonthEnd, 1);
  const currentPct = (overall.currentSpend / maxVal) * 100;
  const projectedPct = (overall.projectedMonthEnd / maxVal) * 100;
  const confLowPct = (overall.confidenceLow / maxVal) * 100;
  const confHighPct = (overall.confidenceHigh / maxVal) * 100;

  return (
    <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Spend Forecast</h3>
        <TrendArrow
          direction={overall.trendDirection}
          percentChange={overall.percentChange}
        />
      </div>

      {/* Headline */}
      <p className="text-gray-400 text-sm mb-1">At this pace, you'll spend</p>
      <p className="text-3xl font-bold text-white mb-1">
        {formatCurrency(overall.projectedMonthEnd)}
        <span className="text-base font-normal text-gray-500 ml-2">by end of month</span>
      </p>
      <p className="text-xs text-gray-500 mb-5">
        Confidence range: {formatCurrency(overall.confidenceLow)} &ndash;{' '}
        {formatCurrency(overall.confidenceHigh)}
      </p>

      {/* Visual bar */}
      <div className="relative mb-6">
        {/* Confidence band (lighter) */}
        <div className="w-full h-3 bg-[#1a1a2e] rounded-full overflow-hidden relative">
          {/* Confidence range background */}
          <div
            className="absolute top-0 h-full bg-amber-500/10 rounded-full"
            style={{ left: `${confLowPct}%`, width: `${confHighPct - confLowPct}%` }}
          />
          {/* Projected fill */}
          <div
            className="absolute top-0 h-full bg-amber-500/30 rounded-full"
            style={{ width: `${projectedPct}%` }}
          />
          {/* Current spend fill */}
          <div
            className="absolute top-0 h-full bg-amber-500 rounded-full transition-all duration-500"
            style={{ width: `${currentPct}%` }}
          />
        </div>
        {/* Labels below bar */}
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-amber-400 font-medium">
            {formatCurrency(overall.currentSpend)} spent
          </span>
          <span className="text-xs text-gray-500">
            {formatCurrency(overall.projectedMonthEnd)} projected
          </span>
        </div>
      </div>

      {/* Burn rate */}
      <div className="flex items-center justify-between py-3 border-t border-[#1e1e2e]">
        <span className="text-sm text-gray-400">Daily burn rate</span>
        <span className="text-sm text-white font-medium">
          {formatCurrency(overall.burnRate)}/day
        </span>
      </div>

      <div className="flex items-center justify-between py-3 border-t border-[#1e1e2e]">
        <span className="text-sm text-gray-400">Days remaining</span>
        <span className="text-sm text-white font-medium">{overall.daysRemaining}</span>
      </div>

      <div className="flex items-center justify-between py-3 border-t border-[#1e1e2e]">
        <span className="text-sm text-gray-400">vs. last month</span>
        <TrendArrow
          direction={overall.trendDirection}
          percentChange={overall.percentChange}
        />
      </div>

      {/* Per-provider mini forecasts */}
      {topProviders.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[#1e1e2e]">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
            Top providers
          </p>
          <div className="space-y-3">
            {topProviders.map((pf) => {
              const pPct =
                maxVal > 0
                  ? Math.min((pf.projectedMonthEnd / maxVal) * 100, 100)
                  : 0;

              return (
                <div key={pf.providerConnectionId}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-300">{pf.provider}</span>
                    <span className="text-sm text-white font-medium">
                      {formatCurrency(pf.projectedMonthEnd)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500/60 rounded-full transition-all duration-500"
                      style={{ width: `${pPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs text-gray-600">
                      {formatCurrency(pf.burnRate)}/day
                    </span>
                    <TrendArrow
                      direction={pf.trendDirection}
                      percentChange={pf.percentChange}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
