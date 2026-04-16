'use client';

import { useState, useEffect } from 'react';

interface BalanceData {
  available: number;
  totalAllocated: number;
  delegatedToPool: number;
  listedOnMarket: number;
  earned: number;
  periodStart: string;
  periodEnd: string;
  subscriptionTier: string | null;
}

export default function CreditBalanceCard() {
  const [data, setData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBalance() {
      try {
        const res = await fetch('/api/credits/balance');
        if (!res.ok) throw new Error('Failed to fetch balance');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load balance');
      } finally {
        setLoading(false);
      }
    }
    fetchBalance();
  }, []);

  function daysUntilReset(periodEnd: string): number {
    const end = new Date(periodEnd);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  function expiryColor(days: number): string {
    if (days <= 3) return 'text-red-400 bg-red-500/10 border-red-500/20';
    if (days <= 7) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-gray-500 bg-[#1e1e2e] border-transparent';
  }

  function periodProgress(start: string, end: string): number {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const n = Date.now();
    if (e <= s) return 100;
    return Math.min(100, Math.max(0, Math.round(((n - s) / (e - s)) * 100)));
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-4 md:p-6 flex items-center justify-center min-h-[180px]">
        <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-6">
        <p className="text-red-400 text-sm">{error || 'No balance data available'}</p>
      </div>
    );
  }

  const usageRatio = data.totalAllocated > 0 ? data.available / data.totalAllocated : 0;
  const usagePct = Math.round(usageRatio * 100);
  const daysLeft = data.periodEnd ? daysUntilReset(data.periodEnd) : 0;
  const periodPct = data.periodStart && data.periodEnd ? periodProgress(data.periodStart, data.periodEnd) : 0;

  return (
    <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium mb-1">Available Credits</p>
          <p className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
            ${data.available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            of ${data.totalAllocated.toLocaleString(undefined, { minimumFractionDigits: 2 })} allocated
            {data.subscriptionTier && <span className="ml-2 text-amber-500/60">{data.subscriptionTier}</span>}
          </p>
        </div>
        <span className={`text-xs rounded-full px-3 py-1 border ${expiryColor(daysLeft)}`}>
          {daysLeft === 0 ? 'Expiring today' : daysLeft === 1 ? 'Expires tomorrow' : `Expires in ${daysLeft} days`}
        </span>
      </div>

      {/* Credit allocation bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-gray-500">
          <span>{usagePct}% available</span>
          <span>${data.totalAllocated.toLocaleString(undefined, { minimumFractionDigits: 2 })} total</span>
        </div>
        <div className="w-full h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500"
            style={{ width: `${usagePct}%` }}
          />
        </div>
      </div>

      {/* Period timeline */}
      {data.periodStart && data.periodEnd && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-600">
            <span>{new Date(data.periodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            <span className="text-gray-500">{periodPct}% through period</span>
            <span>{new Date(data.periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </div>
          <div className="w-full h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                daysLeft <= 3 ? 'bg-red-500' : daysLeft <= 7 ? 'bg-amber-500' : 'bg-gray-600'
              }`}
              style={{ width: `${periodPct}%` }}
            />
          </div>
          {daysLeft <= 7 && data.available > 0 && (
            <p className="text-xs text-amber-400">
              {daysLeft <= 3
                ? `Unused credits expire in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Delegate to the pool or list on the marketplace to earn before expiry.`
                : `Credits expire in ${daysLeft} days. Consider delegating unused credits to the pool or listing on the marketplace.`}
            </p>
          )}
        </div>
      )}

      {/* Stat pills */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        {[
          { label: 'In Pool', value: data.delegatedToPool },
          { label: 'Listed', value: data.listedOnMarket },
          { label: 'Earned', value: data.earned },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] px-2 md:px-4 py-3 text-center"
          >
            <p className="text-gray-500 text-xs mb-1">{stat.label}</p>
            <p className="text-white font-semibold">${stat.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
