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

/* --- Inline Sparkline (7-point polyline in a 100x30 SVG) --- */
function SavingsSparkline({ data }: { data: SavingsData | null }) {
  // Generate 7 points from category data or fallback
  const points: number[] = [];
  if (data?.byCategory && data.byCategory.length > 0) {
    // Use category totals as data points, pad/truncate to 7
    const vals = data.byCategory.map((c) => c.totalSaved);
    for (let i = 0; i < 7; i++) {
      points.push(vals[i % vals.length] ?? 0);
    }
  } else {
    for (let i = 0; i < 7; i++) points.push(0);
  }

  const max = Math.max(...points, 0.01);
  const coords = points
    .map((v, i) => {
      const x = (i / 6) * 96 + 2;
      const y = 28 - (v / max) * 24;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width="100" height="30" viewBox="0 0 100 30" className="inline-block ml-2 opacity-70">
      <polyline
        points={coords}
        fill="none"
        stroke="#22c55e"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dot on last point */}
      {points.length > 0 && (
        <circle
          cx={(6 / 6) * 96 + 2}
          cy={28 - (points[6] / max) * 24}
          r="2.5"
          fill="#22c55e"
        />
      )}
    </svg>
  );
}

/* --- CSS Donut / Arc Chart for savings rate --- */
function SavingsDonut({ percent }: { percent: number }) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  const circumference = 2 * Math.PI * 36; // r=36
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg width="96" height="96" viewBox="0 0 96 96" className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx="48" cy="48" r="36"
          fill="none"
          stroke="#1e1e2e"
          strokeWidth="8"
        />
        {/* Progress arc */}
        <circle
          cx="48" cy="48" r="36"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-amber-400">{clamped.toFixed(0)}%</span>
      </div>
    </div>
  );
}

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
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-400 text-lg mb-2">No savings data yet</p>
          <p className="text-sm text-gray-600 mb-6">Start routing requests to track savings</p>
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

  const maxCategorySaved = Math.max(...(data?.byCategory?.map((c) => c.totalSaved) ?? [0]), 0.01);

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
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              period === p.value
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                : 'bg-[#1e1e2e] text-gray-400 hover:text-white hover:bg-[#2a2a3a]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Hero Stats + Donut */}
      <div className="grid md:grid-cols-4 gap-4">
        {/* Total Saved */}
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6 hover:border-green-500/30 transition-all duration-300 group">
          <p className="text-sm text-gray-500 mb-1 flex items-center">
            Total Saved
            <SavingsSparkline data={data} />
          </p>
          <p className="text-4xl font-bold text-green-400">
            <span className="text-green-500/70 text-2xl mr-0.5">$</span>
            {data?.totalSaved?.toFixed(2) ?? '0.00'}
          </p>
        </div>
        {/* Total Spent */}
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6 hover:border-[#3a3a4a] transition-all duration-300">
          <p className="text-sm text-gray-500 mb-1">Total Spent</p>
          <p className="text-3xl font-bold text-white">
            ${data?.totalSpent?.toFixed(2) ?? '0.00'}
          </p>
        </div>
        {/* Savings Rate (text) */}
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6 hover:border-amber-500/30 transition-all duration-300">
          <p className="text-sm text-gray-500 mb-1">Savings Rate</p>
          <p className="text-3xl font-bold text-amber-400">
            {data?.savingsPercent?.toFixed(1) ?? '0.0'}%
          </p>
        </div>
        {/* Savings Rate Donut */}
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-4 flex items-center justify-center hover:border-amber-500/30 transition-all duration-300">
          <SavingsDonut percent={data?.savingsPercent ?? 0} />
        </div>
      </div>

      {/* Best Single Saving */}
      {data?.bestSingleSaving && (
        <div className="relative bg-gradient-to-r from-green-500/10 to-transparent rounded-2xl border border-green-500/20 p-6 overflow-hidden">
          {/* Subtle glow */}
          <div className="absolute -top-12 -left-12 w-40 h-40 bg-green-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-green-400 text-sm font-semibold uppercase tracking-wider">Best Save</span>
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
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
                <th className="text-left py-3 px-6 text-gray-500 font-medium min-w-[160px]">Proportion</th>
                <th className="text-right py-3 px-6 text-gray-500 font-medium">Total Saved</th>
                <th className="text-right py-3 px-6 text-gray-500 font-medium">Avg Saving</th>
              </tr>
            </thead>
            <tbody>
              {data?.byCategory && data.byCategory.length > 0 ? (
                data.byCategory.map((cat, i) => {
                  const proportion = (cat.totalSaved / maxCategorySaved) * 100;
                  return (
                    <tr
                      key={cat.reason}
                      className={`border-b border-[#1e1e2e]/50 hover:bg-[#1e1e2e]/40 transition-colors duration-150 cursor-default ${
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
                      <td className="py-3 px-6">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500/60 rounded-full transition-all duration-700"
                              style={{ width: `${proportion}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-500 font-mono w-8 text-right">
                            {proportion.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-6 text-right text-green-400 font-medium">
                        ${cat.totalSaved.toFixed(4)}
                      </td>
                      <td className="py-3 px-6 text-right text-amber-400">
                        {cat.avgSavingPercent.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
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
