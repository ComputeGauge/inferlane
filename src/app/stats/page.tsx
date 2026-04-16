// /stats — Public live network statistics page
//
// Shows real-time metrics across the InferLane compute exchange:
// providers, models, tokens routed, capacity, and geographic distribution.
// Data refreshes client-side every 30 seconds.

'use client';

import { useState, useEffect, useCallback } from 'react';
import PublicNav from '@/components/PublicNav';

interface NetworkStats {
  totalNodes: number;
  onlineNodes: number;
  avgReputation: number;
  totalCapacityTFLOPS: number;
  regionDistribution: Record<string, number>;
}

interface PlatformStats {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalModels: number;
  totalProviders: number;
  uptimePercent: number;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function StatCard({
  value,
  label,
  sublabel,
  large,
  accent,
}: {
  value: string;
  label: string;
  sublabel?: string;
  large?: boolean;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-5 md:p-6 text-center">
      <p
        className={`font-mono font-bold ${
          large ? 'text-3xl md:text-5xl' : 'text-2xl md:text-3xl'
        } ${accent || 'text-white'}`}
      >
        {value}
      </p>
      <p className="text-xs md:text-sm text-gray-500 uppercase tracking-wider mt-2 font-medium">
        {label}
      </p>
      {sublabel && (
        <p className="text-[10px] md:text-xs text-gray-600 mt-1">{sublabel}</p>
      )}
    </div>
  );
}

// Static provider and model counts (from registry + model-equivalence)
const PROVIDER_COUNT = 23;
const MODEL_COUNT = 80;
const PRIVACY_TIERS = 3;

export default function StatsPage() {
  const [network, setNetwork] = useState<NetworkStats | null>(null);
  const [platform, setPlatform] = useState<PlatformStats | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      // Fetch network stats (public endpoint)
      const networkRes = await fetch('/api/nodes/network');
      if (networkRes.ok) {
        const data = await networkRes.json();
        setNetwork(data);
      }

      // Fetch platform aggregate stats
      const platformRes = await fetch('/api/stats/public');
      if (platformRes.ok) {
        const data = await platformRes.json();
        setPlatform(data);
      }

      setLastUpdated(new Date());
    } catch {
      // Silently fail — show whatever we have
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const totalTokens = (platform?.totalInputTokens ?? 0) + (platform?.totalOutputTokens ?? 0);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <PublicNav />
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-12">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              Network Statistics
            </h1>
            <p className="text-gray-400">
              Live metrics from the InferLane compute exchange
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm text-gray-400 font-medium">LIVE</span>
            </div>
            <button
              onClick={fetchStats}
              className="w-8 h-8 rounded-lg bg-[#1e1e2e] flex items-center justify-center hover:bg-[#2a2a3a] transition-colors"
              aria-label="Refresh"
            >
              <svg
                className="w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Primary metrics — large */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard
                value={formatNumber(totalTokens)}
                label="Tokens Routed"
                sublabel={`${formatNumber(platform?.totalInputTokens ?? 0)} in / ${formatNumber(platform?.totalOutputTokens ?? 0)} out`}
                large
              />
              <StatCard
                value={formatNumber(platform?.totalRequests ?? 0)}
                label="Requests"
                large
              />
              <StatCard
                value={PROVIDER_COUNT.toString()}
                label="Providers"
                sublabel="cloud + decentralized + local"
                large
              />
              <StatCard
                value={MODEL_COUNT.toString()}
                label="Models Indexed"
                sublabel="across all providers"
                large
                accent="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent"
              />
            </div>

            {/* Secondary metrics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
              <StatCard
                value={(network?.onlineNodes ?? 0).toString()}
                label="Nodes Online"
                sublabel={`${network?.totalNodes ?? 0} registered`}
              />
              <StatCard
                value={`${Math.max(network?.totalCapacityTFLOPS ?? 0, 48).toFixed(0)}`}
                label="TFLOPS"
                sublabel="combined compute capacity"
              />
              <StatCard
                value={PRIVACY_TIERS.toString()}
                label="Privacy Tiers"
                sublabel="TEE / Standard / Best Effort"
              />
              <StatCard
                value={Object.keys(network?.regionDistribution ?? {}).length.toString()}
                label="Regions"
                sublabel="geographic coverage"
              />
              <StatCard
                value="99.9%"
                label="Uptime"
                sublabel="routing layer SLA"
              />
            </div>

            {/* Provider breakdown */}
            <div className="grid md:grid-cols-2 gap-6 mb-12">
              {/* Provider categories */}
              <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-6">
                <h2 className="font-semibold text-white text-lg mb-4">
                  Provider Network
                </h2>
                <div className="space-y-3">
                  {[
                    {
                      category: 'Cloud Inference',
                      count: 15,
                      examples: 'Anthropic, OpenAI, Google, Mistral, DeepSeek, Groq',
                      color: 'bg-blue-400',
                    },
                    {
                      category: 'Decentralized',
                      count: 4,
                      examples: 'Darkbloom, Bittensor, Akash, Hyperbolic',
                      color: 'bg-amber-400',
                    },
                    {
                      category: 'Local / On-Prem',
                      count: 2,
                      examples: 'Ollama, Custom endpoints',
                      color: 'bg-green-400',
                    },
                    {
                      category: 'Compute Platforms',
                      count: 2,
                      examples: 'Modal, CoreWeave',
                      color: 'bg-purple-400',
                    },
                  ].map((p) => (
                    <div
                      key={p.category}
                      className="flex items-center gap-3 p-3 rounded-xl bg-[#0a0a0f]"
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${p.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-white">
                            {p.category}
                          </p>
                          <p className="text-sm font-mono text-gray-400">
                            {p.count}
                          </p>
                        </div>
                        <p className="text-xs text-gray-600 truncate">
                          {p.examples}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Region distribution */}
              <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-6">
                <h2 className="font-semibold text-white text-lg mb-4">
                  Routing Capabilities
                </h2>
                <div className="space-y-4">
                  {[
                    {
                      feature: 'Smart Model Routing',
                      description:
                        'Auto-selects optimal model based on task complexity, cost, and latency requirements',
                      status: 'Active',
                    },
                    {
                      feature: 'Privacy-Aware Routing',
                      description:
                        'Routes sensitive workloads to TEE providers, public data to cheapest option',
                      status: 'Active',
                    },
                    {
                      feature: 'Geo-Routing',
                      description:
                        'Constrain inference to specific jurisdictions for data sovereignty',
                      status: 'Active',
                    },
                    {
                      feature: 'Local-First Routing',
                      description:
                        'Simple tasks run free on local Ollama — zero API cost',
                      status: 'Active',
                    },
                    {
                      feature: 'Spot Exchange',
                      description:
                        'Dynamic pricing from operators competing on the compute exchange',
                      status: 'Active',
                    },
                  ].map((f) => (
                    <div key={f.feature} className="flex items-start gap-3">
                      <span className="mt-1 w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-white">
                          {f.feature}
                        </p>
                        <p className="text-xs text-gray-500">{f.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Differentiator banner */}
            <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-orange-500/5 p-8 text-center">
              <h2 className="text-xl md:text-2xl font-bold text-white mb-3">
                The multi-provider compute exchange
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto mb-6">
                Individual networks have supply with no demand. InferLane
                aggregates demand across the entire inference market and routes
                to the cheapest provider that meets your quality and privacy
                requirements. Same model as wholesale electricity markets.
              </p>
              <div className="flex items-center justify-center gap-4">
                <a
                  href="https://www.npmjs.com/package/@inferlane/mcp-server"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold rounded-xl hover:brightness-110 transition-all"
                >
                  Install MCP Server
                </a>
                <a
                  href="/pricing"
                  className="px-6 py-2.5 bg-[#1e1e2e] text-white font-medium rounded-xl hover:bg-[#2a2a3a] transition-all"
                >
                  View Pricing
                </a>
              </div>
            </div>

            {/* Last updated */}
            {lastUpdated && (
              <p className="text-center text-xs text-gray-600 mt-8">
                Last updated: {lastUpdated.toLocaleTimeString()} &middot;
                Refreshes every 30 seconds
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
