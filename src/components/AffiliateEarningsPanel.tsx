'use client';

import {
  affiliateEarnings,
  getTotalAffiliateRevenue,
  getTotalRecurringRevenue,
  getTotalTopUpRevenue,
  getTotalPendingPayout,
} from '@/lib/marketplace-data';

export default function AffiliateEarningsPanel() {
  const totalRevenue = getTotalAffiliateRevenue();
  const recurringRevenue = getTotalRecurringRevenue();
  const topUpRevenue = getTotalTopUpRevenue();
  const pendingPayout = getTotalPendingPayout();
  const totalSignups = affiliateEarnings.reduce((s, e) => s + e.signups, 0);
  const totalLifetime = affiliateEarnings.reduce((s, e) => s + e.lifetimeEarnings, 0);

  return (
    <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Affiliate Earnings</h3>
          <p className="text-sm text-gray-500 mt-0.5">Your commission from referrals, recurring & top-ups</p>
        </div>
        <button className="text-xs font-medium px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-all">
          Request Payout
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'This Month', value: `$${totalRevenue.toLocaleString()}`, color: 'text-white' },
          { label: 'Recurring MRR', value: `$${recurringRevenue.toLocaleString()}`, color: 'text-green-400' },
          { label: 'Top-Up Commission', value: `$${topUpRevenue.toLocaleString()}`, color: 'text-amber-400' },
          { label: 'Pending Payout', value: `$${pendingPayout.toLocaleString()}`, color: 'text-purple-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#0a0a0f] rounded-xl p-3">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider">{stat.label}</p>
            <p className={`text-xl font-bold font-mono mt-0.5 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Extra stats row */}
      <div className="flex items-center gap-6 mb-6 text-xs text-gray-500">
        <span>Total Signups: <span className="text-white font-medium">{totalSignups}</span></span>
        <span>Lifetime Earnings: <span className="text-green-400 font-medium">${totalLifetime.toLocaleString()}</span></span>
        <span>Active Recurring: <span className="text-white font-medium">{affiliateEarnings.reduce((s, e) => s + e.recurringUsers, 0)}</span> users</span>
      </div>

      {/* Per-provider breakdown */}
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-2 px-3 py-1.5 text-[10px] text-gray-600 uppercase tracking-wider">
          <span className="col-span-2">Provider</span>
          <span className="text-right">Signups</span>
          <span className="text-right">Signup $</span>
          <span className="text-right">Recurring</span>
          <span className="text-right">Top-ups</span>
          <span className="text-right">Total</span>
        </div>
        {affiliateEarnings
          .sort((a, b) => b.totalRevenue - a.totalRevenue)
          .map((earning) => (
          <div
            key={earning.providerId}
            className="grid grid-cols-7 gap-2 items-center px-3 py-2.5 rounded-xl bg-[#0a0a0f] border border-[#1a1a2a] hover:border-[#2a2a3a] transition-all"
          >
            <span className="col-span-2 text-sm font-medium text-white">{earning.providerName}</span>
            <span className="text-right text-xs text-gray-400 font-mono">{earning.signups}</span>
            <span className="text-right text-xs text-gray-300 font-mono">${earning.signupRevenue}</span>
            <span className="text-right text-xs text-green-400 font-mono">${earning.recurringRevenue}</span>
            <span className="text-right text-xs text-amber-400 font-mono">${earning.topUpRevenue}</span>
            <span className="text-right text-xs text-white font-bold font-mono">${earning.totalRevenue.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* Revenue breakdown visual */}
      <div className="mt-6 pt-4 border-t border-[#1a1a2a]">
        <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-3">Revenue Mix</p>
        <div className="flex rounded-full overflow-hidden h-3">
          <div
            className="bg-blue-500 transition-all"
            style={{ width: `${(affiliateEarnings.reduce((s, e) => s + e.signupRevenue, 0) / totalRevenue) * 100}%` }}
            title="Signup bonuses"
          />
          <div
            className="bg-green-500 transition-all"
            style={{ width: `${(recurringRevenue / totalRevenue) * 100}%` }}
            title="Recurring"
          />
          <div
            className="bg-amber-500 transition-all"
            style={{ width: `${(topUpRevenue / totalRevenue) * 100}%` }}
            title="Top-ups"
          />
        </div>
        <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Signup bonuses ({Math.round((affiliateEarnings.reduce((s, e) => s + e.signupRevenue, 0) / totalRevenue) * 100)}%)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Recurring ({Math.round((recurringRevenue / totalRevenue) * 100)}%)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Top-up commissions ({Math.round((topUpRevenue / totalRevenue) * 100)}%)
          </span>
        </div>
      </div>
    </div>
  );
}
