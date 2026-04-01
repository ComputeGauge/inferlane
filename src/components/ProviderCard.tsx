'use client';

import { memo } from 'react';
import { ProviderConfig } from '@/lib/types';

interface ProviderCardProps {
  provider: ProviderConfig;
}

export default memo(function ProviderCard({ provider }: ProviderCardProps) {
  const percentUsed = (provider.currentSpend / provider.monthlyBudget) * 100;
  const remaining = provider.monthlyBudget - provider.currentSpend;

  // Project end-of-month spend
  const today = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const dailyRate = provider.currentSpend / today;
  const projected = dailyRate * daysInMonth;
  const willExceed = projected > provider.monthlyBudget;

  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toString();
  };

  return (
    <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-5 hover:border-[#2a2a3a] transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
            style={{ backgroundColor: `${provider.color}15`, color: provider.color }}
          >
            {provider.name[0]}
          </div>
          <div>
            <h4 className="font-semibold text-white text-sm">{provider.name}</h4>
            <p className="text-xs text-gray-500">{provider.models.length} models active</p>
          </div>
        </div>
        <a
          href={provider.topUpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:brightness-110"
          style={{
            backgroundColor: `${provider.color}15`,
            color: provider.color,
          }}
        >
          Top Up
        </a>
      </div>

      {/* Spend bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-gray-400">
            ${provider.currentSpend.toFixed(2)} spent
          </span>
          <span className="text-gray-500">
            ${remaining.toFixed(2)} left
          </span>
        </div>
        <div className="w-full bg-[#1e1e2e] rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all duration-1000"
            style={{
              width: `${Math.min(percentUsed, 100)}%`,
              background: `linear-gradient(90deg, ${provider.gradientFrom}, ${provider.gradientTo})`,
            }}
          />
        </div>
        {willExceed && (
          <p className="text-xs text-amber-400 mt-1.5 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92z" clipRule="evenodd" />
            </svg>
            Projected ${projected.toFixed(0)} by month end
          </p>
        )}
      </div>

      {/* Model breakdown */}
      <div className="space-y-2">
        {provider.models.map((model) => (
          <div key={model.name} className="flex items-center justify-between py-1.5 border-t border-[#1a1a2a]">
            <div>
              <p className="text-xs font-medium text-gray-300">{model.name}</p>
              <p className="text-[10px] text-gray-600">
                {formatTokens(model.inputTokens)} in / {formatTokens(model.outputTokens)} out
              </p>
            </div>
            <span className="text-xs font-mono text-gray-400">${model.cost.toFixed(2)}</span>
          </div>
        ))}
      </div>

      {/* Cloud alternatives */}
      {provider.cloudAlternatives.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#1a1a2a]">
          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">
            Cloud Alternatives
          </p>
          {provider.cloudAlternatives.map((alt) => (
            <a
              key={alt.provider}
              href={alt.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between py-1 hover:bg-[#1a1a2a] rounded-lg px-2 -mx-2 transition-all"
            >
              <span className="text-xs text-gray-400 flex items-center gap-1.5">
                {alt.logo} {alt.name}
              </span>
              {alt.savingsPercent > 0 ? (
                <span className="text-[10px] text-green-400">
                  Save {alt.savingsPercent}%
                </span>
              ) : (
                <span className="text-[10px] text-gray-600">Same price</span>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
});
