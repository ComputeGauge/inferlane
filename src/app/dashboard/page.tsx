'use client';

import ComputeGauge from '@/components/ComputeGauge';
import SpendChart from '@/components/SpendChart';
import AlertPanel from '@/components/AlertPanel';
import TopUpBanner from '@/components/TopUpBanner';
import StatsBar from '@/components/StatsBar';
import { useDashboardData } from '@/hooks/useDashboardData';

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const stats = [
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
  ];

  return (
    <>
      <TopUpBanner providers={providers} />
      <StatsBar stats={stats} />

      {/* Fuel Gauges */}
      {providers.length > 0 ? (
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Compute Fuel Gauges</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {providers.map((p) => (
              <ComputeGauge
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

      {/* Chart + Alerts */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SpendChart data={spendHistory} />
        </div>
        <AlertPanel alerts={alerts} />
      </div>
    </>
  );
}
