'use client';

import { useState, useEffect, useCallback } from 'react';
import ClassificationBadge from '@/components/compute-intel/ClassificationBadge';
import SettlementLaneIndicator from '@/components/compute-intel/SettlementLaneIndicator';

// ---------------------------------------------------------------------------
// Compute Intelligence Dashboard — /dashboard/compute-intel
// ---------------------------------------------------------------------------
// Three sections:
// 1. Classification Browser — table of all classified compute
// 2. Settlement Lanes — lane cards with entity counts and pending USD
// 3. Trust Leaderboard — top entities by trust score
// ---------------------------------------------------------------------------

interface Classification {
  id: string;
  targetType: string;
  targetId: string;
  model: string;
  inferenceType: string;
  qualityTier: string;
  latencyClass: string;
  privacyClass: string;
  availabilityClass: string;
  hardwareClass: string;
  regions: string[];
  verificationScore: number;
  settlementLane: string;
  settlementDelayHours: number;
  lastVerifiedAt: string | null;
  updatedAt: string;
}

interface LaneStats {
  lane: string;
  count: number;
  pendingUsd: number;
  avgSettlementHours: number;
}

export default function ComputeIntelPage() {
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [laneStats, setLaneStats] = useState<LaneStats[]>([
    { lane: 'INSTANT', count: 0, pendingUsd: 0, avgSettlementHours: 0 },
    { lane: 'STANDARD', count: 0, pendingUsd: 0, avgSettlementHours: 24 },
    { lane: 'DEFERRED', count: 0, pendingUsd: 0, avgSettlementHours: 168 },
  ]);

  const fetchClassifications = useCallback(async () => {
    try {
      // Fetch classifications for known providers
      const providers = [
        'OPENAI', 'ANTHROPIC', 'GOOGLE', 'TOGETHER', 'GROQ',
        'FIREWORKS', 'DEEPSEEK', 'MISTRAL', 'COHERE', 'XAI',
      ];

      const results: Classification[] = [];

      for (const provider of providers.slice(0, 5)) {
        try {
          const res = await fetch(`/api/compute-intel/classify?targetId=${provider}`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              results.push(...data);
            }
          }
        } catch {
          // Skip failed providers
        }
      }

      setClassifications(results);
    } catch (err) {
      console.error('Failed to fetch classifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClassifications();
  }, [fetchClassifications]);

  // Compute lane stats from classifications
  useEffect(() => {
    const stats: Record<string, { count: number; hours: number }> = {
      INSTANT: { count: 0, hours: 0 },
      STANDARD: { count: 0, hours: 24 },
      DEFERRED: { count: 0, hours: 168 },
    };

    for (const c of classifications) {
      const lane = c.settlementLane || 'DEFERRED';
      if (stats[lane]) {
        stats[lane].count++;
      }
    }

    setLaneStats([
      { lane: 'INSTANT', count: stats.INSTANT.count, pendingUsd: 0, avgSettlementHours: 0 },
      { lane: 'STANDARD', count: stats.STANDARD.count, pendingUsd: 0, avgSettlementHours: 24 },
      { lane: 'DEFERRED', count: stats.DEFERRED.count, pendingUsd: 0, avgSettlementHours: 168 },
    ]);
  }, [classifications]);

  const filtered = filter === 'all'
    ? classifications
    : classifications.filter((c) => c.qualityTier === filter);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-white">Compute Intelligence</h1>
        <p className="text-gray-500 mt-1">
          Classified compute inventory, settlement lanes, and trust maturity across all providers and nodes.
        </p>
      </header>

      {/* Settlement Lane Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {laneStats.map((lane) => (
          <div
            key={lane.lane}
            className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <SettlementLaneIndicator
                lane={lane.lane}
                settlementDelayHours={lane.avgSettlementHours}
              />
              <span className="text-lg font-bold text-white">{lane.count}</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Entities</span>
                <span className="text-gray-300">{lane.count} classified</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Pending Settlement</span>
                <span className="text-gray-300">${lane.pendingUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Avg Settlement</span>
                <span className="text-gray-300">
                  {lane.avgSettlementHours === 0 ? 'Instant' : `${lane.avgSettlementHours}h`}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Classification Browser */}
      <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[#1e1e2e]">
          <h2 className="text-lg font-semibold text-white">Classification Browser</h2>
          <div className="flex gap-1">
            {['all', 'FRONTIER', 'STANDARD', 'ECONOMY', 'OPEN_WEIGHT'].map((tier) => (
              <button
                key={tier}
                onClick={() => setFilter(tier)}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  filter === tier
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-gray-500 hover:text-gray-300 border border-transparent'
                }`}
              >
                {tier === 'all' ? 'All' : tier.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <div className="animate-spin w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full mx-auto mb-3" />
            Loading classifications...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-lg mb-2">No classifications yet</p>
            <p className="text-sm">
              Classifications are generated when compute sources are first used or manually triggered via the API.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-medium">Provider / Node</th>
                  <th className="text-left px-5 py-3 font-medium">Model</th>
                  <th className="text-left px-5 py-3 font-medium">Classification</th>
                  <th className="text-left px-5 py-3 font-medium">Verification</th>
                  <th className="text-left px-5 py-3 font-medium">Lane</th>
                  <th className="text-left px-5 py-3 font-medium">Last Verified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e2e]">
                {filtered.map((c) => (
                  <tr key={c.id || `${c.targetId}-${c.model}`} className="hover:bg-[#1a1a24] transition-colors">
                    <td className="px-5 py-3">
                      <div className="text-sm text-white font-medium">{c.targetId}</div>
                      <div className="text-xs text-gray-500">{c.targetType}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-sm text-gray-300 font-mono">{c.model}</span>
                    </td>
                    <td className="px-5 py-3">
                      <ClassificationBadge
                        qualityTier={c.qualityTier}
                        latencyClass={c.latencyClass}
                        hardwareClass={c.hardwareClass}
                      />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-[#1e1e2e] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              c.verificationScore >= 65 ? 'bg-emerald-400' :
                              c.verificationScore >= 1 ? 'bg-amber-400' : 'bg-red-400'
                            }`}
                            style={{ width: `${c.verificationScore}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium ${
                          c.verificationScore >= 65 ? 'text-emerald-400' :
                          c.verificationScore >= 1 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {c.verificationScore}/100
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <SettlementLaneIndicator
                        lane={c.settlementLane || 'DEFERRED'}
                        settlementDelayHours={c.settlementDelayHours || 168}
                      />
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500">
                      {c.lastVerifiedAt
                        ? new Date(c.lastVerifiedAt).toLocaleDateString()
                        : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Trust & Maturity Info */}
      <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Trust Maturity Model</h2>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { name: 'Early', threshold: 80, delay: '30d', ttl: '24h', settled: '$0' },
            { name: 'Growing', threshold: 70, delay: '14d', ttl: '48h', settled: '$100K' },
            { name: 'Established', threshold: 60, delay: '7d', ttl: '72h', settled: '$1M' },
            { name: 'Mature', threshold: 50, delay: '3d', ttl: '96h', settled: '$10M' },
          ].map((level, i) => (
            <div
              key={level.name}
              className={`rounded-lg border p-4 ${
                i === 0
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : 'border-[#1e1e2e] bg-[#0a0a0f]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-semibold ${i === 0 ? 'text-amber-400' : 'text-gray-400'}`}>
                  {level.name}
                </span>
                {i === 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold text-amber-400 bg-amber-500/15 rounded border border-amber-500/30">
                    CURRENT
                  </span>
                )}
              </div>
              <div className="space-y-1 text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>Instant threshold</span>
                  <span className="text-gray-300">{level.threshold}</span>
                </div>
                <div className="flex justify-between">
                  <span>Deferred delay</span>
                  <span className="text-gray-300">{level.delay}</span>
                </div>
                <div className="flex justify-between">
                  <span>Verification TTL</span>
                  <span className="text-gray-300">{level.ttl}</span>
                </div>
                <div className="flex justify-between">
                  <span>Required settled</span>
                  <span className="text-gray-300">{level.settled}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
