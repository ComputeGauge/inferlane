'use client';

import { ProviderConfig } from '@/lib/types';

interface TopUpBannerProps {
  providers: ProviderConfig[];
}

export default function TopUpBanner({ providers }: TopUpBannerProps) {
  if (!providers.length) return null;

  // Find the provider closest to running out
  const critical = providers
    .map(p => ({
      ...p,
      remaining: p.monthlyBudget > 0 ? ((p.monthlyBudget - p.currentSpend) / p.monthlyBudget) * 100 : 100,
    }))
    .sort((a, b) => a.remaining - b.remaining)[0];

  if (critical.remaining > 30) return null;

  const dailyRate = critical.currentSpend / Math.max(new Date().getDate(), 1);
  const daysLeft = dailyRate > 0
    ? Math.floor((critical.monthlyBudget - critical.currentSpend) / dailyRate)
    : 99;

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/10 via-red-500/10 to-purple-500/10 rounded-2xl border border-amber-500/20 p-5">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-red-500/5 pulse-glow" />

      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-white">
              {critical.name} running low — {Math.round(critical.remaining)}% remaining
            </h3>
            <p className="text-sm text-gray-400 mt-0.5">
              ~{daysLeft} days of compute left at current rate. Top up or switch to a cloud provider to save.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={critical.topUpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 transition-all"
          >
            Top Up Direct
          </a>
          <a
            href={critical.partnerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-[#1e1e2e] text-white text-sm font-medium hover:bg-[#2a2a3a] transition-all border border-[#2a2a3a]"
          >
            Try via Cloud
          </a>
        </div>
      </div>
    </div>
  );
}
