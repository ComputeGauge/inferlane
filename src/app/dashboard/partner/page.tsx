'use client';

import { useState, useEffect, useCallback } from 'react';

interface PartnerStats {
  partner: {
    name: string;
    slug: string;
    revSharePct: number;
    apiKeyPrefix: string;
  };
  referredUsers: {
    total: number;
    thisMonth: number;
  };
  volume: {
    totalRequests: number;
    totalTokens: number;
    thisMonthRequests: number;
  };
  commission: {
    lifetimeEarned: number;
    pendingPayout: number;
    lastPaidAt: string | null;
  };
}

export default function PartnerDashboard() {
  const [stats, setStats] = useState<PartnerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);

  const fetchStats = useCallback(async (key: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/partners/stats', {
        headers: { 'x-partner-key': key },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        // Save key for session
        sessionStorage.setItem('partnerKey', key);
      } else if (res.status === 401) {
        setError('Invalid partner key. Please check your credentials.');
        setShowKeyInput(true);
      } else {
        setError('Failed to load partner stats.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedKey = sessionStorage.getItem('partnerKey');
    if (savedKey) {
      fetchStats(savedKey);
    } else {
      setLoading(false);
      setShowKeyInput(true);
    }
  }, [fetchStats]);

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  function formatNumber(n: number) {
    return new Intl.NumberFormat('en-US').format(n);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Partner Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track your integration performance, referred users, and earned commissions.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        </div>
      ) : stats ? (
        <>
          {/* Stats Overview */}
          <div className="grid md:grid-cols-4 gap-4">
            {[
              {
                label: 'Referred Users',
                value: formatNumber(stats.referredUsers.total),
                sub: `${formatNumber(stats.referredUsers.thisMonth)} this month`,
                color: 'text-white',
              },
              {
                label: 'Revenue Share',
                value: `${(stats.partner.revSharePct * 100).toFixed(0)}%`,
                sub: 'of subscription revenue',
                color: 'text-amber-400',
              },
              {
                label: 'Commission Earned',
                value: formatCurrency(stats.commission.lifetimeEarned),
                sub: 'Lifetime',
                color: 'text-emerald-400',
              },
              {
                label: 'Pending Payout',
                value: formatCurrency(stats.commission.pendingPayout),
                sub: stats.commission.lastPaidAt
                  ? `Last paid ${new Date(stats.commission.lastPaidAt).toLocaleDateString()}`
                  : 'Next month',
                color: 'text-white',
              },
            ].map((stat) => (
              <div key={stat.label} className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-5">
                <p className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</p>
                <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-gray-600 mt-1">{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* Volume Stats */}
          <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Integration Volume</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Total Requests</p>
                <p className="text-xl font-bold text-white mt-1">{formatNumber(stats.volume.totalRequests)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Total Tokens Processed</p>
                <p className="text-xl font-bold text-white mt-1">{formatNumber(stats.volume.totalTokens)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">This Month</p>
                <p className="text-xl font-bold text-white mt-1">{formatNumber(stats.volume.thisMonthRequests)} requests</p>
              </div>
            </div>
          </div>

          {/* Integration Guide */}
          <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Quick Integration</h3>
            <p className="text-sm text-gray-500 mb-4">
              Your API key prefix: <code className="text-amber-400 bg-[#0a0a0f] px-2 py-0.5 rounded">{stats.partner.apiKeyPrefix}...</code>
            </p>
            <div className="bg-[#0a0a0f] rounded-xl p-4 font-mono text-sm text-gray-300">
              <p className="text-gray-500 mb-2"># Send usage data to InferLane</p>
              <p>curl -X POST https://inferlane.dev/api/integrations/ingest \</p>
              <p className="pl-4">-H &quot;Authorization: Bearer {stats.partner.apiKeyPrefix}...&quot; \</p>
              <p className="pl-4">-H &quot;Content-Type: application/json&quot; \</p>
              <p className="pl-4">{'-d \'{"records": [{"userRef": "user@email.com", "provider": "openai", "model": "gpt-4o", "inputTokens": 1500, "outputTokens": 800}]}\''}</p>
            </div>
          </div>

          {/* Disconnect */}
          <div className="flex justify-end">
            <button
              onClick={() => {
                sessionStorage.removeItem('partnerKey');
                setStats(null);
                setShowKeyInput(true);
                setApiKey('');
              }}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Disconnect partner key
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Auth / Onboarding */}
          {showKeyInput && (
            <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Connect Partner Key</h3>
              {error && (
                <p className="text-sm text-red-400 mb-4">{error}</p>
              )}
              <div className="flex gap-3">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="ilp_your_partner_key"
                  className="flex-1 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
                  onKeyDown={(e) => e.key === 'Enter' && apiKey.trim() && fetchStats(apiKey.trim())}
                />
                <button
                  onClick={() => apiKey.trim() && fetchStats(apiKey.trim())}
                  disabled={!apiKey.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold rounded-xl hover:brightness-110 transition-all disabled:opacity-50"
                >
                  Connect
                </button>
              </div>
            </div>
          )}

          {/* Become a Partner */}
          <div className="bg-[#12121a] rounded-2xl border border-amber-500/20 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Become a Partner</h3>
                <p className="text-sm text-gray-400 mt-1">
                  AI gateways and tools that integrate with InferLane earn revenue share on referred users.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mt-6">
              <div className="p-4 rounded-xl border border-[#1a1a2a]">
                <h4 className="text-sm font-medium text-white mb-1">Integration Partners</h4>
                <p className="text-xs text-gray-500">
                  AI gateways (LiteLLM, Portkey, OpenClaw) that send usage data through our rails
                </p>
              </div>
              <div className="p-4 rounded-xl border border-[#1a1a2a]">
                <h4 className="text-sm font-medium text-white mb-1">Revenue Share</h4>
                <p className="text-xs text-gray-500">
                  Earn 10% of subscription revenue from users you refer to InferLane
                </p>
              </div>
              <div className="p-4 rounded-xl border border-[#1a1a2a]">
                <h4 className="text-sm font-medium text-white mb-1">Easy Integration</h4>
                <p className="text-xs text-gray-500">
                  One API endpoint to send usage data. SDK available for TypeScript and Python
                </p>
              </div>
            </div>

            <div className="mt-6">
              <a
                href="mailto:partners@inferlane.dev"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold rounded-xl hover:brightness-110 transition-all"
              >
                Apply to Partner Program
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
