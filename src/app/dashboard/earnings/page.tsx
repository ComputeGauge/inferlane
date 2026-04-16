'use client';

import AffiliateEarningsPanel from '@/components/AffiliateEarningsPanel';

export default function EarningsPage() {
  return (
    <div className="space-y-6">
      <AffiliateEarningsPanel />

      {/* How it works */}
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
        <h3 className="text-lg font-semibold text-white mb-4">How You Earn</h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center p-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h4 className="font-semibold text-white mb-1">1. Signup Bonus</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Receive $5-$50 per new user who signs up through your InferLane dashboard.
              Attribution via cookie tracking (30-90 day window).
            </p>
            <p className="text-lg font-bold text-blue-400 font-mono mt-2">$5 - $50</p>
            <p className="text-[10px] text-gray-600">per signup</p>
          </div>
          <div className="text-center p-4">
            <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h4 className="font-semibold text-white mb-1">2. Recurring Commission</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Earn 8-18% of your referral's monthly spend for 12-24 months or lifetime.
              Commission scales with their usage — recurring revenue, not one-time.
            </p>
            <p className="text-lg font-bold text-green-400 font-mono mt-2">8% - 18%</p>
            <p className="text-[10px] text-gray-600">of monthly spend, recurring</p>
          </div>
          <div className="text-center p-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h4 className="font-semibold text-white mb-1">3. Top-Up Commission</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              Every time a referred user tops up credits or renews their plan,
              you earn 5-12% of that top-up. Low fuel = your payday.
            </p>
            <p className="text-lg font-bold text-amber-400 font-mono mt-2">5% - 12%</p>
            <p className="text-[10px] text-gray-600">on every top-up & renewal</p>
          </div>
        </div>
      </div>

      {/* Revenue projection */}
      <div className="bg-gradient-to-r from-green-500/5 via-[#12121a] to-amber-500/5 rounded-2xl border border-[#1e1e2e] p-6">
        <h3 className="text-lg font-semibold text-white mb-2">Revenue Projection</h3>
        <p className="text-sm text-gray-500 mb-4">Based on current growth rate</p>
        <div className="grid grid-cols-4 gap-4">
          {[
            { period: 'This Month', amount: '$5,814', trend: 'current' },
            { period: '3 Months', amount: '$9,200', trend: 'up' },
            { period: '6 Months', amount: '$18,500', trend: 'up' },
            { period: '12 Months', amount: '$42,000', trend: 'up' },
          ].map((proj) => (
            <div key={proj.period} className="bg-[#0a0a0f] rounded-xl p-4 text-center">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider">{proj.period}</p>
              <p className="text-xl font-bold text-white font-mono mt-1">{proj.amount}</p>
              {proj.trend === 'up' && (
                <div className="flex items-center justify-center gap-1 mt-1">
                  <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-[10px] text-green-400">projected</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
