'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface SavingsByCategory {
  reason: string;
  count: number;
  totalSaved: number;
  avgSavingPercent: number;
}

interface SavingsData {
  totalSaved: number;
  totalSpent: number;
  savingsPercent: number;
  bestSingleSaving: {
    amount: number;
    reason: string;
    model: string;
    timestamp: string;
  } | null;
  byCategory: SavingsByCategory[];
}

type Period = 'today' | '7d' | '30d' | 'all';

const categoryEmojis: Record<string, string> = {
  promotion: '\u{1F389}',
  cross_platform: '\u{1F310}',
  off_peak: '\u{1F319}',
  decentralized: '\u{1F517}',
  budget_routing: '\u{1F4B0}',
};

export default function SavingsPage() {
  const [period, setPeriod] = useState<Period>('7d');
  const [data, setData] = useState<SavingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSavings = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/savings?period=${p}&leaderboard=true`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch savings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSavings(period);
  }, [period, fetchSavings]);

  const periods: { value: Period; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: 'all', label: 'All Time' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-white">Savings Tracker</h1>
          <p className="text-gray-500 mt-1">Track how much you&apos;re saving through smart routing.</p>
        </header>
        <div className="grid md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
              <div className="h-4 w-24 bg-[#1e1e2e] rounded animate-pulse mb-3" />
              <div className="h-8 w-32 bg-[#1e1e2e] rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
          <div className="h-5 w-48 bg-[#1e1e2e] rounded animate-pulse mb-4" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-[#1e1e2e] rounded animate-pulse mb-2" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-white">Savings Tracker</h1>
        </header>
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
          <p className="text-red-400 font-medium mb-2">Failed to load savings data</p>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => fetchSavings(period)}
            className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isEmpty = !data || (data.totalSaved === 0 && data.totalSpent === 0 && (!data.byCategory || data.byCategory.length === 0));

  if (isEmpty) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-white">Savings Tracker</h1>
          <p className="text-gray-500 mt-1">Track how much you&apos;re saving through smart routing.</p>
        </header>
        <div className="bg-[#12121a] rounded-2xl border border-dashed border-[#2a2a3a] p-16 text-center">
          <p className="text-gray-400 text-lg mb-2">No savings data yet</p>
          <p className="text-sm text-gray-600 mb-6">Start routing requests to track savings.</p>
          <Link
            href="/dashboard/dispatch"
            className="inline-block px-5 py-2.5 bg-amber-500 text-black rounded-lg text-sm font-medium hover:bg-amber-400 transition-colors"
          >
            Go to Dispatch
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Savings Tracker</h1>
        <p className="text-gray-500 mt-1">
          Track how much you&apos;re saving through smart routing, promotions, and off-peak scheduling.
        </p>
      </header>

      {/* Period Selector */}
      <div className="flex gap-2">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              period === p.value
                ? 'bg-amber-500 text-black'
                : 'bg-[#1e1e2e] text-gray-400 hover:text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Hero Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
          <p className="text-sm text-gray-500 mb-1">Total Saved</p>
          <p className="text-3xl font-bold text-green-400">
            ${data?.totalSaved?.toFixed(2) ?? '0.00'}
          </p>
        </div>
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
          <p className="text-sm text-gray-500 mb-1">Total Spent</p>
          <p className="text-3xl font-bold text-white">
            ${data?.totalSpent?.toFixed(2) ?? '0.00'}
          </p>
        </div>
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
          <p className="text-sm text-gray-500 mb-1">Savings Rate</p>
          <p className="text-3xl font-bold text-amber-400">
            {data?.savingsPercent?.toFixed(1) ?? '0.0'}%
          </p>
        </div>
      </div>

      {/* Best Single Saving */}
      {data?.bestSingleSaving && (
        <div className="bg-gradient-to-r from-green-500/10 to-transparent rounded-2xl border border-green-500/20 p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-green-400 text-sm font-semibold uppercase tracking-wider">Best Save</span>
          </div>
          <p className="text-2xl font-bold text-green-400 mb-1">
            ${data.bestSingleSaving.amount.toFixed(4)}
          </p>
          <p className="text-sm text-gray-400">
            {data.bestSingleSaving.reason} &middot;{' '}
            <span className="font-mono">{data.bestSingleSaving.model}</span> &middot;{' '}
            {new Date(data.bestSingleSaving.timestamp).toLocaleDateString()}
          </p>
        </div>
      )}

      {/* Category Breakdown Table */}
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] overflow-hidden">
        <div className="p-6 pb-0">
          <h3 className="text-lg font-semibold text-white mb-4">Category Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e2e]">
                <th className="text-left py-3 px-6 text-gray-500 font-medium">Category</th>
                <th className="text-right py-3 px-6 text-gray-500 font-medium">Requests</th>
                <th className="text-right py-3 px-6 text-gray-500 font-medium">Total Saved</th>
                <th className="text-right py-3 px-6 text-gray-500 font-medium">Avg Saving</th>
              </tr>
            </thead>
            <tbody>
              {data?.byCategory && data.byCategory.length > 0 ? (
                data.byCategory.map((cat, i) => (
                  <tr
                    key={cat.reason}
                    className={`border-b border-[#1e1e2e]/50 hover:bg-[#1e1e2e]/30 transition-colors ${
                      i % 2 === 1 ? 'bg-[#0e0e16]' : ''
                    }`}
                  >
                    <td className="py-3 px-6">
                      <span className="text-gray-300">
                        {categoryEmojis[cat.reason] ?? '\u{2728}'}{' '}
                        {cat.reason.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-right text-gray-300">{cat.count}</td>
                    <td className="py-3 px-6 text-right text-green-400 font-medium">
                      ${cat.totalSaved.toFixed(4)}
                    </td>
                    <td className="py-3 px-6 text-right text-amber-400">
                      {cat.avgSavingPercent.toFixed(1)}%
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500">
                    No savings data for this period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
