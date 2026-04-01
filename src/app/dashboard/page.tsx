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
import { useSSE } from '@/hooks/useSSE';
import Link from 'next/link';

// Lazy-load SpendChart (recharts is ~200KB — only load when dashboard renders)
const SpendChart = lazy(() => import('@/components/SpendChart'));

const quickActions = [
  {
    label: 'New Dispatch',
    href: '/dashboard/dispatch',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    color: 'amber',
  },
  {
    label: 'Connect Provider',
    href: '/dashboard/onboarding',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.04a4.5 4.5 0 00-1.242-7.244l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
      </svg>
    ),
    color: 'blue',
  },
  {
    label: 'View Savings',
    href: '/dashboard/savings',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
    color: 'green',
  },
  {
    label: 'Configure Router',
    href: '/dashboard/router',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.646.87.074.04.147.083.22.127.325.196.72.257 1.076.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.431.992a7.723 7.723 0 010 .255c-.007.378.138.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.333.183-.582.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.212-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    color: 'purple',
  },
];

const colorMap: Record<string, { border: string; text: string; bg: string; hoverBorder: string }> = {
  amber:  { border: 'border-amber-500/20', text: 'text-amber-400', bg: 'bg-amber-500/10', hoverBorder: 'hover:border-amber-500/40' },
  blue:   { border: 'border-blue-500/20', text: 'text-blue-400', bg: 'bg-blue-500/10', hoverBorder: 'hover:border-blue-500/40' },
  green:  { border: 'border-green-500/20', text: 'text-green-400', bg: 'bg-green-500/10', hoverBorder: 'hover:border-green-500/40' },
  purple: { border: 'border-purple-500/20', text: 'text-purple-400', bg: 'bg-purple-500/10', hoverBorder: 'hover:border-purple-500/40' },
};

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

  const { events: sseEvents, connected: sseConnected } = useSSE(['proxy_request']);

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
    <div className="animate-fadeIn">
      {/* SSE Connection Status */}
      <div className="flex items-center justify-end mb-2 gap-2">
        <div className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
        <span className="text-[11px] text-gray-500">
          {sseConnected ? 'Live' : 'Disconnected'}
        </span>
      </div>

      {/* Quick-glance summary widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/dashboard/dispatch"
          className="animate-fade-in-up stagger-1 bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-4 hover:border-amber-500/30 hover:shadow-[0_0_20px_rgba(245,158,11,0.06)] transition-all duration-300 group"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">&#9889;</span>
            <span className="text-xs text-gray-500 uppercase tracking-wider">Active Dispatches</span>
          </div>
          <p className="text-2xl font-bold text-amber-400">0</p>
          <p className="text-xs text-gray-500 mt-1 group-hover:text-amber-400/70 transition-colors">0 active &rarr;</p>
        </Link>

        <Link
          href="/dashboard/sessions"
          className="animate-fade-in-up stagger-2 bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-4 hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.06)] transition-all duration-300 group"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">&#128172;</span>
            <span className="text-xs text-gray-500 uppercase tracking-wider">Sessions</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">0</p>
          <p className="text-xs text-gray-500 mt-1 group-hover:text-blue-400/70 transition-colors">0 sessions &rarr;</p>
        </Link>

        <Link
          href="/dashboard/savings"
          className="animate-fade-in-up stagger-3 bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-4 hover:border-green-500/30 hover:shadow-[0_0_20px_rgba(34,197,94,0.06)] transition-all duration-300 group"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">&#128200;</span>
            <span className="text-xs text-gray-500 uppercase tracking-wider">Savings</span>
          </div>
          <p className="text-2xl font-bold text-green-400">$0.00</p>
          <p className="text-xs text-gray-500 mt-1 group-hover:text-green-400/70 transition-colors">Saved this week &rarr;</p>
        </Link>

        <Link
          href="/dashboard/nodes"
          className="animate-fade-in-up stagger-4 bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-4 hover:border-purple-500/30 hover:shadow-[0_0_20px_rgba(139,92,246,0.06)] transition-all duration-300 group"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">&#127760;</span>
            <span className="text-xs text-gray-500 uppercase tracking-wider">Network</span>
          </div>
          <p className="text-2xl font-bold text-purple-400">0</p>
          <p className="text-xs text-gray-500 mt-1 group-hover:text-purple-400/70 transition-colors">0 nodes online &rarr;</p>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="animate-fade-in-up stagger-5 grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        {quickActions.map((action) => {
          const c = colorMap[action.color] ?? colorMap.amber;
          return (
            <Link
              key={action.label}
              href={action.href}
              className={`flex items-center gap-3 bg-[#12121a] rounded-xl border ${c.border} ${c.hoverBorder} p-3.5 transition-all duration-300 group hover:shadow-sm`}
            >
              <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center ${c.text} group-hover:scale-110 transition-transform duration-200`}>
                {action.icon}
              </div>
              <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                {action.label}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 space-y-6">
        <TopUpBanner providers={providers} />
        <UpgradeBanner providerCount={providers.length} />
        <StatsBar stats={stats} />

        {/* Fuel Gauges */}
        {providers.length > 0 ? (
          <div className="animate-fade-in-up stagger-6 bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Compute Fuel Gauges</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#1e1e2e] flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <p className="text-gray-400 mb-1 font-medium">No providers connected yet</p>
            <p className="text-sm text-gray-600 mb-4">
              Connect your first AI provider to start tracking spend.
            </p>
            <Link
              href="/dashboard/onboarding"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/10 transition-colors"
            >
              Connect a Provider
              <span>&rarr;</span>
            </Link>
          </div>
        )}

        {/* Savings Recommendations */}
        <SavingsRecommendations />

        {/* Spend Forecast */}
        <SpendForecast />

        {/* Decode Cost Breakdown */}
        <DecodeCostBreakdown />

        {/* Chart + Alerts */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Suspense fallback={
              <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6 h-[380px] flex flex-col gap-4">
                <div className="h-4 w-40 rounded shimmer-placeholder" />
                <div className="flex-1 rounded-xl shimmer-placeholder" />
                <div className="flex gap-4">
                  <div className="h-3 w-20 rounded shimmer-placeholder" />
                  <div className="h-3 w-20 rounded shimmer-placeholder" />
                  <div className="h-3 w-20 rounded shimmer-placeholder" />
                </div>
              </div>
            }>
              <SpendChart data={spendHistory} />
            </Suspense>
          </div>
          <AlertPanel alerts={alerts} />
        </div>

        {/* Live Activity Feed (SSE) */}
        {sseEvents.length > 0 && (
          <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] overflow-hidden">
            <div className="p-4 border-b border-[#1e1e2e] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Live Activity
              </h3>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] text-gray-500">{sseEvents.length} events</span>
              </div>
            </div>
            <div className="divide-y divide-[#1e1e2e] max-h-64 overflow-y-auto">
              {[...sseEvents].reverse().slice(0, 20).map((evt, i) => (
                <div key={`${evt.timestamp}-${i}`} className="px-4 py-2.5 flex items-center gap-3 text-xs hover:bg-[#1e1e2e]/30 transition-colors">
                  <span className="text-gray-600 font-mono w-16 flex-shrink-0">
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="text-gray-400 w-20 flex-shrink-0 truncate">
                    {(evt.data.provider as string) ?? '—'}
                  </span>
                  <span className="text-gray-300 flex-1 truncate font-mono">
                    {(evt.data.model as string) ?? '—'}
                  </span>
                  <span className="text-green-400 font-mono w-16 text-right flex-shrink-0">
                    ${((evt.data.costUsd as number) ?? 0).toFixed(4)}
                  </span>
                  <span className="text-gray-500 font-mono w-14 text-right flex-shrink-0">
                    {(evt.data.latencyMs as number) ?? 0}ms
                  </span>
                  <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    evt.data.status === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {(evt.data.status as string) ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
