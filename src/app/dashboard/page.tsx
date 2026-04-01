'use client';

import { useMemo, lazy, Suspense } from 'react';
import InferLane from '@/components/InferLane';
import AlertPanel from '@/components/AlertPanel';
import TopUpBanner from '@/components/TopUpBanner';
import UpgradeBanner from '@/components/UpgradeBanner';
import StatsBar from '@/components/StatsBar';
import SavingsRecommendations from '@/components/SavingsRecommendations';
import SpendForecast from '@/components/SpendForecast';
import DecodeCostBreakdown from '@/components/decode/DecodeCostBreakdown';
import { useDashboardData } from '@/hooks/useDashboardData';
import Link from 'next/link';

// Lazy-load SpendChart (recharts is ~200KB — only load when dashboard renders)
const SpendChart = lazy(() => import('@/components/SpendChart'));

export default function DashboardPage() {
  const {
    providers,
    spendHistory,
    alerts,
    totalSpend,
    totalBudget,
    projectedMonthly,
    loading,
  } = useDashboardData();

  // Memoize stats array — only recompute when source values change
  const stats = useMemo(() => [
    {
      label: 'Total Spend (MTD)',
      value: `$${totalSpend.toFixed(2)}`,
      subValue: `of $${totalBudget.toFixed(0)} budget`,
      trend: 'up' as const,
      trendValue: '12% vs last month',
    },
    {
      label: 'Projected Monthly',
      value: `$${projectedMonthly.toFixed(0)}`,
      subValue: projectedMonthly > totalBudget ? `$${(projectedMonthly - totalBudget).toFixed(0)} over budget` : 'Within budget',
      trend: projectedMonthly > totalBudget ? ('up' as const) : ('down' as const),
      trendValue: projectedMonthly > totalBudget ? 'Over budget' : 'On track',
    },
    {
      label: 'Active Models',
      value: `${providers.reduce((s, p) => s + p.models.length, 0)}`,
      subValue: `Across ${providers.length} providers`,
    },
    {
      label: 'Potential Savings',
      value: '$18/mo',
      subValue: 'Switch to cloud providers',
      trend: 'down' as const,
      trendValue: '~7% reduction',
    },
  ], [totalSpend, totalBudget, projectedMonthly, providers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Quick-glance summary widgets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/dashboard/dispatch" className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-4 hover:border-amber-500/30 transition-all group">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">&#9889;</span>
            <span className="text-xs text-gray-500 uppercase tracking-wider">Active Dispatches</span>
          </div>
          <p className="text-2xl font-bold text-amber-400">0</p>
          <p className="text-xs text-gray-500 mt-1 group-hover:text-amber-400/70 transition-colors">0 active &rarr;</p>
        </Link>

        <Link href="/dashboard/sessions" className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-4 hover:border-blue-500/30 transition-all group">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">&#128172;</span>
            <span className="text-xs text-gray-500 uppercase tracking-wider">Sessions</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">0</p>
          <p className="text-xs text-gray-500 mt-1 group-hover:text-blue-400/70 transition-colors">0 sessions &rarr;</p>
        </Link>

        <Link href="/dashboard/savings" className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-4 hover:border-green-500/30 transition-all group">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">&#128200;</span>
            <span className="text-xs text-gray-500 uppercase tracking-wider">Savings</span>
          </div>
          <p className="text-2xl font-bold text-green-400">$0.00</p>
          <p className="text-xs text-gray-500 mt-1 group-hover:text-green-400/70 transition-colors">Saved this week &rarr;</p>
        </Link>

        <Link href="/dashboard/nodes" className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-4 hover:border-purple-500/30 transition-all group">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">&#127760;</span>
            <span className="text-xs text-gray-500 uppercase tracking-wider">Network</span>
          </div>
          <p className="text-2xl font-bold text-purple-400">0</p>
          <p className="text-xs text-gray-500 mt-1 group-hover:text-purple-400/70 transition-colors">0 nodes online &rarr;</p>
        </Link>
      </div>

      <TopUpBanner providers={providers} />
      <UpgradeBanner providerCount={providers.length} />
      <StatsBar stats={stats} />

      {/* Fuel Gauges */}
      {providers.length > 0 ? (
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Compute Fuel Gauges</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {providers.map((p) => (
              <InferLane
                key={p.id}
                value={(p.currentSpend / p.monthlyBudget) * 100}
                label={p.name}
                spent={p.currentSpend.toFixed(2)}
                budget={p.monthlyBudget.toFixed(0)}
                color={p.color}
                gradientFrom={p.gradientFrom}
                gradientTo={p.gradientTo}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-[#12121a] rounded-2xl border border-dashed border-[#2a2a3a] p-10 text-center">
          <p className="text-gray-400 mb-2">No providers connected yet</p>
          <p className="text-sm text-gray-600">
            Connect your first AI provider to start tracking spend.
          </p>
        </div>
      )}

      {/* Savings Recommendations */}
      <SavingsRecommendations />

      {/* Spend Forecast */}
      <SpendForecast />

      {/* Decode Cost Breakdown — prefill vs decode vs KV cache */}
      <DecodeCostBreakdown />

      {/* Chart + Alerts */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Suspense fallback={
            <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6 h-[380px] flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          }>
            <SpendChart data={spendHistory} />
          </Suspense>
        </div>
        <AlertPanel alerts={alerts} />
      </div>
    </>
  );
}
