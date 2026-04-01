'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Node Operator Dashboard — /dashboard/nodes
// ---------------------------------------------------------------------------
// For supply-side users running compute nodes on the decentralised network.
// Shows: registration, earnings, reputation, payouts, online status.
// ---------------------------------------------------------------------------

interface MemoryProfile {
  memoryTechnology: string;
  vramCapacityGB: number;
  memoryBandwidthGBs: number;
  interconnectType: string;
  decodeThroughputTps: number;
  prefillThroughputTps: number;
  maxKvCacheTokens: number;
  kvCacheGBUsed: number;
  kvCacheGBAvailable: number;
  nodeRole: string;
  kvSharingEnabled: boolean;
  kvShareBandwidthGBs: number;
  lastBenchmarkAt: string | null;
}

interface NodeProfile {
  id: string;
  displayName: string | null;
  isOnline: boolean;
  reputationScore: number;
  totalRequests: number;
  failedRequests: number;
  avgLatencyMs: number;
  pendingBalance: number;
  lifetimeEarned: number;
  regions: string[];
  capabilities: Record<string, unknown>;
  privacyTier: string;
  teeAttested: boolean;
  payoutEnabled: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  memoryProfile: MemoryProfile | null;
}

interface NodeStats {
  earnings: {
    pending: number;
    lifetime: number;
    daily: number;
    weekly: number;
  };
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    createdAt: string;
  }>;
  payouts: Array<{
    id: string;
    amount: number;
    status: string;
    periodStart: string;
    periodEnd: string;
    createdAt: string;
  }>;
}

export default function NodesPage() {
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<NodeProfile | null>(null);
  const [stats, setStats] = useState<NodeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [regForm, setRegForm] = useState({
    displayName: '',
    apiEndpoint: '',
    regions: '',
    capabilities: { textGeneration: true, code: false, vision: false, embedding: false },
    privacyTier: 'STANDARD',
  });
  const [error, setError] = useState<string | null>(null);

  // Referral state
  interface ReferralInfo {
    referralCount: number;
    totalBonusEarned: number;
    referrals: Array<{
      id: string;
      displayName: string | null;
      createdAt: string;
      totalRequests: number;
      isOnline: boolean;
      bonusEarned: number;
      isActive: boolean;
      windowEndsAt: string;
    }>;
  }
  const [referralStats, setReferralStats] = useState<ReferralInfo | null>(null);
  const [refEmail, setRefEmail] = useState('');
  const [refSending, setRefSending] = useState(false);
  const [refCopied, setRefCopied] = useState(false);
  const [refStatus, setRefStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Decode leaderboard state
  interface LeaderboardEntry {
    nodeId: string;
    displayName: string;
    reputationScore: number;
    decode: {
      tokensPerSecond: number;
      memoryTechnology: string;
      memoryBandwidthGBs: number;
      nodeRole: string | null;
      hourlyValue: number;
    };
    valueScore: number;
  }
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Capture ref param from URL (for registration)
  const refParam = searchParams.get('ref');

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/nodes/onboard');
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch {
      // Not registered yet
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/nodes/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // Stats unavailable
    }
  }, []);

  const fetchReferralStats = useCallback(async () => {
    try {
      const res = await fetch('/api/nodes/referral/stats');
      if (res.ok) {
        const data = await res.json();
        setReferralStats(data);
      }
    } catch {
      // Referral stats unavailable
    }
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/nodes/decode-leaderboard');
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch {
      // Leaderboard unavailable
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchProfile(), fetchStats(), fetchReferralStats(), fetchLeaderboard()]).finally(() => setLoading(false));
  }, [fetchProfile, fetchStats, fetchReferralStats, fetchLeaderboard]);

  async function handleRegister() {
    setRegistering(true);
    setError(null);
    try {
      const res = await fetch('/api/nodes/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: regForm.displayName || undefined,
          apiEndpoint: regForm.apiEndpoint || undefined,
          regions: regForm.regions ? regForm.regions.split(',').map((r) => r.trim()).filter(Boolean) : undefined,
          capabilities: regForm.capabilities,
          privacyTier: regForm.privacyTier,
          ref: refParam || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Registration failed');
        return;
      }
      const data = await res.json();
      setProfile(data);
      await fetchStats();
    } catch {
      setError('Registration failed');
    } finally {
      setRegistering(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Registration flow
  if (!profile) {
    return (
      <div className="space-y-8">
        <header>
          <h1 className="text-2xl font-bold text-white">Node Operator</h1>
          <p className="text-gray-500 mt-1">
            Register your compute node to earn from inference requests routed through the InferLane network.
          </p>
        </header>

        <div className="max-w-lg rounded-xl border border-[#1e1e2e] bg-[#12121a] p-6 space-y-5">
          <h2 className="text-lg font-semibold text-white">Register as Node Operator</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Display Name</label>
              <input
                type="text"
                value={regForm.displayName}
                onChange={(e) => setRegForm({ ...regForm, displayName: e.target.value })}
                placeholder="My GPU Node"
                className="w-full rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">API Endpoint</label>
              <input
                type="text"
                value={regForm.apiEndpoint}
                onChange={(e) => setRegForm({ ...regForm, apiEndpoint: e.target.value })}
                placeholder="https://my-node.example.com/v1"
                className="w-full rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Regions (comma-separated ISO codes)</label>
              <input
                type="text"
                value={regForm.regions}
                onChange={(e) => setRegForm({ ...regForm, regions: e.target.value })}
                placeholder="US, DE, SG"
                className="w-full rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Capabilities</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: 'textGeneration', label: 'Text Generation' },
                  { key: 'code', label: 'Code' },
                  { key: 'vision', label: 'Vision' },
                  { key: 'embedding', label: 'Embedding' },
                ] as const).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 p-2 rounded-lg bg-[#0a0a0f] border border-[#1e1e2e] cursor-pointer hover:border-[#2a2a3a] transition-colors">
                    <input
                      type="checkbox"
                      checked={regForm.capabilities[key]}
                      onChange={(e) => setRegForm({
                        ...regForm,
                        capabilities: { ...regForm.capabilities, [key]: e.target.checked },
                      })}
                      className="w-3.5 h-3.5 accent-amber-500"
                    />
                    <span className="text-sm text-gray-300">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Privacy Tier</label>
              <select
                value={regForm.privacyTier}
                onChange={(e) => setRegForm({ ...regForm, privacyTier: e.target.value })}
                className="w-full rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
              >
                <option value="STANDARD">Standard</option>
                <option value="CONFIDENTIAL">Confidential (encrypted in transit)</option>
                <option value="TEE_REQUIRED">TEE Required (hardware enclave)</option>
              </select>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            onClick={handleRegister}
            disabled={registering}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold text-sm hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50"
          >
            {registering ? 'Registering...' : 'Register Node'}
          </button>

          <div className="pt-3 border-t border-[#1e1e2e]">
            <h3 className="text-sm font-medium text-gray-400 mb-2">How it works</h3>
            <ul className="space-y-1.5 text-xs text-gray-500">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">1.</span>
                Register your node with your API endpoint
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">2.</span>
                Keep your node online — send heartbeats to /api/nodes/heartbeat
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">3.</span>
                Earn per request routed to your node (20% platform fee)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">4.</span>
                Receive batch payouts via Stripe Connect
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Main dashboard
  const successRate = profile.totalRequests > 0
    ? ((profile.totalRequests - profile.failedRequests) / profile.totalRequests * 100).toFixed(1)
    : '100.0';

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Node Operator</h1>
          <p className="text-gray-500 mt-1">
            {profile.displayName || 'Your compute node'} — manage earnings, reputation, and payouts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${profile.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
          <span className={`text-sm font-medium ${profile.isOnline ? 'text-emerald-400' : 'text-gray-500'}`}>
            {profile.isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-4 gap-4">
        {[
          {
            label: 'Pending Balance',
            value: `$${(stats?.earnings.pending ?? profile.pendingBalance).toFixed(4)}`,
            sub: 'Awaiting payout',
            color: 'text-amber-400',
          },
          {
            label: 'Lifetime Earned',
            value: `$${(stats?.earnings.lifetime ?? profile.lifetimeEarned).toFixed(2)}`,
            sub: `${profile.totalRequests.toLocaleString()} requests served`,
            color: 'text-emerald-400',
          },
          {
            label: 'Reputation',
            value: `${profile.reputationScore}/100`,
            sub: `${successRate}% success rate`,
            color: profile.reputationScore >= 80 ? 'text-emerald-400' : profile.reputationScore >= 50 ? 'text-amber-400' : 'text-red-400',
          },
          {
            label: 'Avg Latency',
            value: `${profile.avgLatencyMs}ms`,
            sub: profile.teeAttested ? 'TEE Attested' : 'Standard',
            color: profile.avgLatencyMs <= 500 ? 'text-emerald-400' : profile.avgLatencyMs <= 2000 ? 'text-amber-400' : 'text-red-400',
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Earnings Chart Placeholder + Node Info */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Daily/Weekly Earnings */}
        <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Earnings Summary</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0a0a0f]">
              <span className="text-sm text-gray-400">Today</span>
              <span className="text-sm font-semibold text-white">${(stats?.earnings.daily ?? 0).toFixed(4)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0a0a0f]">
              <span className="text-sm text-gray-400">This Week</span>
              <span className="text-sm font-semibold text-white">${(stats?.earnings.weekly ?? 0).toFixed(4)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0a0a0f]">
              <span className="text-sm text-gray-400">Pending Payout</span>
              <span className="text-sm font-semibold text-amber-400">${(stats?.earnings.pending ?? 0).toFixed(4)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0a0a0f]">
              <span className="text-sm text-gray-400">Lifetime</span>
              <span className="text-sm font-semibold text-emerald-400">${(stats?.earnings.lifetime ?? 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Node Configuration */}
        <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Node Configuration</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0a0a0f]">
              <span className="text-sm text-gray-400">Privacy Tier</span>
              <span className="text-xs font-medium text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                {profile.privacyTier.replace('_', ' ')}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0a0a0f]">
              <span className="text-sm text-gray-400">TEE Attestation</span>
              <span className={`text-sm font-medium ${profile.teeAttested ? 'text-emerald-400' : 'text-gray-500'}`}>
                {profile.teeAttested ? 'Verified' : 'Not attested'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0a0a0f]">
              <span className="text-sm text-gray-400">Regions</span>
              <div className="flex gap-1">
                {profile.regions.length > 0 ? profile.regions.map((r) => (
                  <span key={r} className="text-xs text-gray-300 bg-[#1e1e2e] px-1.5 py-0.5 rounded">
                    {r}
                  </span>
                )) : (
                  <span className="text-xs text-gray-500">Global</span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0a0a0f]">
              <span className="text-sm text-gray-400">Stripe Payouts</span>
              <span className={`text-sm font-medium ${profile.payoutEnabled ? 'text-emerald-400' : 'text-amber-400'}`}>
                {profile.payoutEnabled ? 'Enabled' : 'Setup required'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0a0a0f]">
              <span className="text-sm text-gray-400">Last Seen</span>
              <span className="text-sm text-gray-300">
                {profile.lastSeenAt ? new Date(profile.lastSeenAt).toLocaleString() : 'Never'}
              </span>
            </div>
          </div>

          {/* Heartbeat Config */}
          <div className="mt-4 p-3 rounded-lg bg-[#0a0a0f] border border-dashed border-[#1e1e2e]">
            <p className="text-xs font-medium text-gray-400 mb-1">Heartbeat Endpoint</p>
            <code className="text-xs text-amber-400 font-mono break-all">
              POST /api/nodes/heartbeat
            </code>
            <p className="text-xs text-gray-600 mt-1">
              Send every 30 seconds to stay online. Include <code className="text-gray-400">nodeId</code> in the request body.
            </p>
          </div>
        </div>
      </div>

      {/* Memory & Decode Profile */}
      <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Memory & Decode Profile</h2>
          {profile.memoryProfile?.lastBenchmarkAt && (
            <span className="text-xs text-gray-500">
              Last benchmarked: {new Date(profile.memoryProfile.lastBenchmarkAt).toLocaleDateString()}
            </span>
          )}
        </div>

        {!profile.memoryProfile ? (
          <div className="p-6 text-center rounded-lg bg-[#0a0a0f] border border-dashed border-[#1e1e2e]">
            <p className="text-gray-500 text-sm mb-2">No memory profile configured.</p>
            <p className="text-xs text-gray-600">
              Submit your GPU memory benchmarks via POST /api/nodes/onboard/memory to enable
              decode-optimised routing and earn more from memory-intensive workloads.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Hardware Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {
                  label: 'VRAM',
                  value: `${profile.memoryProfile.vramCapacityGB} GB`,
                  sub: profile.memoryProfile.memoryTechnology.replace('_', ''),
                  color: 'text-violet-400',
                },
                {
                  label: 'Bandwidth',
                  value: `${profile.memoryProfile.memoryBandwidthGBs} GB/s`,
                  sub: profile.memoryProfile.interconnectType.replace('_', ' '),
                  color: 'text-cyan-400',
                },
                {
                  label: 'Decode',
                  value: `${profile.memoryProfile.decodeThroughputTps} tok/s`,
                  sub: 'Autoregressive',
                  color: 'text-amber-400',
                },
                {
                  label: 'Prefill',
                  value: `${profile.memoryProfile.prefillThroughputTps} tok/s`,
                  sub: 'Prompt processing',
                  color: 'text-emerald-400',
                },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-[#0a0a0f] p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">{s.label}</p>
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-600">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Role & KV Cache */}
            <div className="grid md:grid-cols-2 gap-3">
              <div className="rounded-lg bg-[#0a0a0f] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Node Role</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    profile.memoryProfile.nodeRole === 'DECODE_OPTIMISED' ? 'text-amber-400 bg-amber-500/15 border border-amber-500/30' :
                    profile.memoryProfile.nodeRole === 'PREFILL_OPTIMISED' ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30' :
                    profile.memoryProfile.nodeRole === 'KV_CACHE_SERVER' ? 'text-violet-400 bg-violet-500/15 border border-violet-500/30' :
                    'text-gray-400 bg-gray-500/15 border border-gray-500/30'
                  }`}>
                    {profile.memoryProfile.nodeRole.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Max KV Cache</span>
                  <span className="text-sm text-white font-mono">
                    {profile.memoryProfile.maxKvCacheTokens > 0
                      ? `${(profile.memoryProfile.maxKvCacheTokens / 1000).toFixed(0)}K tokens`
                      : 'Not set'}
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-[#0a0a0f] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">KV Cache Sharing</span>
                  <span className={`text-xs font-medium ${profile.memoryProfile.kvSharingEnabled ? 'text-emerald-400' : 'text-gray-500'}`}>
                    {profile.memoryProfile.kvSharingEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                {profile.memoryProfile.kvSharingEnabled && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Cache Used</span>
                      <span className="text-sm text-white font-mono">
                        {profile.memoryProfile.kvCacheGBUsed} / {profile.memoryProfile.kvCacheGBAvailable} GB
                      </span>
                    </div>
                    {profile.memoryProfile.kvCacheGBAvailable > 0 && (
                      <div className="w-full bg-[#1e1e2e] rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500"
                          style={{
                            width: `${Math.min(100, (profile.memoryProfile.kvCacheGBUsed / profile.memoryProfile.kvCacheGBAvailable) * 100)}%`,
                          }}
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Share Bandwidth</span>
                      <span className="text-sm text-white font-mono">{profile.memoryProfile.kvShareBandwidthGBs} GB/s</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] overflow-hidden">
        <div className="p-5 border-b border-[#1e1e2e]">
          <h2 className="text-lg font-semibold text-white">Recent Transactions</h2>
        </div>
        {(stats?.transactions?.length ?? 0) === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No transactions yet. Transactions will appear once requests are routed to your node.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-medium">Type</th>
                  <th className="text-left px-5 py-3 font-medium">Amount</th>
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e2e]">
                {stats?.transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#1a1a24] transition-colors">
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        tx.type === 'NODE_EARNING' ? 'text-emerald-400 bg-emerald-500/15' :
                        tx.type === 'NODE_PAYOUT' ? 'text-blue-400 bg-blue-500/15' :
                        tx.type === 'NODE_PENALTY' ? 'text-red-400 bg-red-500/15' :
                        'text-amber-400 bg-amber-500/15'
                      }`}>
                        {tx.type.replace('NODE_', '')}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-sm font-mono ${tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {tx.amount >= 0 ? '+' : ''}${tx.amount.toFixed(6)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payouts */}
      <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] overflow-hidden">
        <div className="p-5 border-b border-[#1e1e2e]">
          <h2 className="text-lg font-semibold text-white">Payout History</h2>
        </div>
        {(stats?.payouts?.length ?? 0) === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No payouts yet. Payouts are processed daily (or weekly for new operators).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-medium">Amount</th>
                  <th className="text-left px-5 py-3 font-medium">Period</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e2e]">
                {stats?.payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-[#1a1a24] transition-colors">
                    <td className="px-5 py-3 text-sm font-mono text-white">${p.amount.toFixed(2)}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">
                      {new Date(p.periodStart).toLocaleDateString()} — {new Date(p.periodEnd).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        p.status === 'COMPLETED' ? 'text-emerald-400 bg-emerald-500/15' :
                        p.status === 'PROCESSING' ? 'text-blue-400 bg-blue-500/15' :
                        p.status === 'FAILED' ? 'text-red-400 bg-red-500/15' :
                        'text-amber-400 bg-amber-500/15'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500">
                      {new Date(p.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Decode Leaderboard ──────────────────────────────────────── */}
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Decode Leaderboard</h3>
          <p className="text-sm text-gray-500 mt-1">
            Top nodes ranked by decode value — tokens/sec per $/hr
          </p>
        </div>
        {leaderboard.length === 0 ? (
          <p className="text-gray-600 text-sm py-4 text-center">No nodes with decode profiles online</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-[#1e1e2e]">
                  <th className="pb-3 text-left w-10">#</th>
                  <th className="pb-3 text-left">Node</th>
                  <th className="pb-3 text-right">Decode TPS</th>
                  <th className="pb-3 text-right">Memory</th>
                  <th className="pb-3 text-right">$/hr</th>
                  <th className="pb-3 text-right">Value Score</th>
                  <th className="pb-3 text-right">Rep</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e2e]">
                {leaderboard.map((entry, i) => (
                  <tr key={entry.nodeId} className={i < 3 ? 'bg-emerald-500/5' : ''}>
                    <td className={`py-3 font-mono font-bold ${i < 3 ? 'text-emerald-400' : 'text-gray-500'}`}>
                      {i + 1}
                    </td>
                    <td className="py-3 text-white font-medium">
                      {entry.displayName}
                      {entry.decode.nodeRole && (
                        <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                          entry.decode.nodeRole === 'DECODE_OPTIMISED' ? 'text-amber-400 bg-amber-500/15' :
                          entry.decode.nodeRole === 'PREFILL_OPTIMISED' ? 'text-emerald-400 bg-emerald-500/15' :
                          'text-blue-400 bg-blue-500/15'
                        }`}>
                          {entry.decode.nodeRole === 'DECODE_OPTIMISED' ? 'Decode' :
                           entry.decode.nodeRole === 'PREFILL_OPTIMISED' ? 'Prefill' : 'Hybrid'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right text-amber-400 font-mono">
                      {entry.decode.tokensPerSecond.toLocaleString()}
                    </td>
                    <td className="py-3 text-right">
                      <span className="text-xs text-purple-400 bg-purple-500/15 px-1.5 py-0.5 rounded">
                        {entry.decode.memoryTechnology}
                      </span>
                    </td>
                    <td className="py-3 text-right text-gray-400 font-mono">
                      ${entry.decode.hourlyValue.toFixed(4)}
                    </td>
                    <td className="py-3 text-right text-emerald-400 font-bold font-mono">
                      {entry.valueScore.toFixed(1)}
                    </td>
                    <td className="py-3 text-right text-gray-400">
                      {entry.reputationScore}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Referrals ──────────────────────────────────────────────── */}
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Refer Node Operators</h3>
          <p className="text-sm text-gray-500 mt-1">
            Earn 5% of referred operators&apos; earnings for 6 months (up to $500 per referral)
          </p>
        </div>

        {/* Referral link */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider">Your Referral Link</label>
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 text-sm text-white bg-[#0a0a0f] px-4 py-2 rounded-xl font-mono border border-[#1e1e2e] truncate">
              /dashboard/nodes?ref={profile?.id}
            </code>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `${window.location.origin}/dashboard/nodes?ref=${profile?.id}`
                  );
                  setRefCopied(true);
                  setTimeout(() => setRefCopied(false), 2000);
                } catch { /* fallback */ }
              }}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold rounded-xl hover:brightness-110 transition-all whitespace-nowrap"
            >
              {refCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Email invite */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider">Invite by Email</label>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="email"
              value={refEmail}
              onChange={(e) => setRefEmail(e.target.value)}
              placeholder="operator@example.com"
              className="flex-1 px-4 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  sendReferralInvite();
                }
              }}
            />
            <button
              onClick={sendReferralInvite}
              disabled={refSending || !refEmail.trim()}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold rounded-xl hover:brightness-110 transition-all disabled:opacity-50 whitespace-nowrap"
            >
              {refSending ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </div>

        {/* Status message */}
        {refStatus && (
          <div className={`p-3 rounded-xl border ${
            refStatus.type === 'success'
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            <p className="text-sm">{refStatus.message}</p>
          </div>
        )}

        {/* Referral stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#0a0a0f] rounded-xl border border-[#1e1e2e] p-4 text-center">
            <p className="text-2xl font-bold text-white">{referralStats?.referralCount ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Operators Referred</p>
          </div>
          <div className="bg-[#0a0a0f] rounded-xl border border-[#1e1e2e] p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">
              ${referralStats?.totalBonusEarned?.toFixed(2) ?? '0.00'}
            </p>
            <p className="text-xs text-gray-500 mt-1">Total Bonus Earned</p>
          </div>
        </div>

        {/* Referred operators table */}
        {referralStats && referralStats.referrals.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-[#1e1e2e]">
            <table className="w-full text-sm text-gray-400">
              <thead className="bg-[#0a0a0f] border-b border-[#1e1e2e]">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Operator</th>
                  <th className="text-left px-5 py-3 font-medium">Joined</th>
                  <th className="text-left px-5 py-3 font-medium">Requests</th>
                  <th className="text-left px-5 py-3 font-medium">Bonus Earned</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e2e]">
                {referralStats.referrals.map((r) => (
                  <tr key={r.id} className="hover:bg-[#1a1a24] transition-colors">
                    <td className="px-5 py-3 text-white font-medium">
                      {r.displayName ?? 'Unnamed'}
                      {r.isOnline && (
                        <span className="ml-2 inline-block w-2 h-2 rounded-full bg-emerald-400" />
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 font-mono">{r.totalRequests.toLocaleString()}</td>
                    <td className="px-5 py-3 font-mono text-emerald-400">
                      ${r.bonusEarned.toFixed(2)}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        r.isActive
                          ? 'text-emerald-400 bg-emerald-500/15'
                          : 'text-gray-500 bg-gray-500/15'
                      }`}>
                        {r.isActive ? 'Active' : 'Expired'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  async function sendReferralInvite() {
    if (!refEmail.trim()) return;
    setRefSending(true);
    setRefStatus(null);
    try {
      const res = await fetch('/api/nodes/referral/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: refEmail }),
      });
      if (res.ok) {
        setRefStatus({ type: 'success', message: `Invite sent to ${refEmail}` });
        setRefEmail('');
        fetchReferralStats();
      } else {
        const data = await res.json();
        setRefStatus({ type: 'error', message: data.error || 'Failed to send invite' });
      }
    } catch {
      setRefStatus({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setRefSending(false);
    }
  }
}
