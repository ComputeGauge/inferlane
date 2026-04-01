'use client';

import { useState, useEffect, useCallback } from 'react';

type Strategy = 'auto' | 'cheapest' | 'fastest' | 'quality' | 'decentralized' | 'centralized';

interface ClassifyResult {
  tier: string;
  confidence: number;
  agenticScore: number;
  dimensions: Record<string, number>;
  recommendedModel: string;
  estimatedCost: number;
}

interface ProviderHealth {
  id: string;
  name: string;
  healthy: boolean;
  cooldown: boolean;
  latencyP50: number;
  latencyP95: number;
  errorRate: number;
  samples: number;
}

const strategies: { value: Strategy; emoji: string; label: string; description: string }[] = [
  { value: 'auto', emoji: '\u{1F916}', label: 'Auto', description: 'AI picks the best provider based on health, cost, and quality' },
  { value: 'cheapest', emoji: '\u{1F4B2}', label: 'Cheapest', description: 'Always route to the lowest cost option' },
  { value: 'fastest', emoji: '\u{26A1}', label: 'Fastest', description: 'Prioritize lowest latency providers' },
  { value: 'quality', emoji: '\u{1F3AF}', label: 'Quality', description: 'Route to the highest quality model available' },
  { value: 'decentralized', emoji: '\u{1F517}', label: 'Decentralized', description: 'Prefer OpenClaw nodes when available' },
  { value: 'centralized', emoji: '\u{1F3E2}', label: 'Centralized', description: 'Only use traditional API providers' },
];

const tierColors: Record<string, string> = {
  TRIVIAL: 'bg-green-500/20 text-green-400',
  STANDARD: 'bg-blue-500/20 text-blue-400',
  COMPLEX: 'bg-amber-500/20 text-amber-400',
  REASONING: 'bg-purple-500/20 text-purple-400',
};

export default function RouterPage() {
  const [strategy, setStrategy] = useState<Strategy>('auto');
  const [classifyInput, setClassifyInput] = useState('');
  const [classifyResult, setClassifyResult] = useState<ClassifyResult | null>(null);
  const [classifyLoading, setClassifyLoading] = useState(false);
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const res = await fetch('/api/proxy/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setProviders(json.providers ?? json);
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : 'Failed to load provider health');
      setProviders([]);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  async function handleClassify() {
    if (!classifyInput.trim()) return;
    setClassifyLoading(true);
    setClassifyResult(null);
    try {
      const res = await fetch('/api/dispatch/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: classifyInput }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setClassifyResult(json);
    } catch {
      setClassifyResult(null);
    } finally {
      setClassifyLoading(false);
    }
  }

  function statusDot(p: ProviderHealth) {
    if (p.cooldown) return 'bg-red-400';
    if (p.errorRate > 0.1) return 'bg-amber-400';
    if (p.healthy) return 'bg-green-400';
    return 'bg-red-400';
  }

  function statusLabel(p: ProviderHealth) {
    if (p.cooldown) return 'Cooldown';
    if (p.errorRate > 0.1) return 'Degraded';
    if (p.healthy) return 'Healthy';
    return 'Unhealthy';
  }

  // Get top 5 scoring dimensions
  const topDimensions = classifyResult?.dimensions
    ? Object.entries(classifyResult.dimensions)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
    : [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Smart Router</h1>
        <p className="text-gray-500 mt-1">
          Configure routing strategy, classify prompts, and monitor provider health.
        </p>
      </header>

      {/* Strategy Selector */}
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Routing Strategy</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {strategies.map((s) => (
            <button
              key={s.value}
              onClick={() => setStrategy(s.value)}
              className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
                strategy === s.value
                  ? 'border-amber-500 bg-amber-500/5'
                  : 'border-[#1e1e2e] hover:border-[#3a3a4a]'
              }`}
            >
              <span className="text-2xl mb-2">{s.emoji}</span>
              <p className={`text-sm font-medium ${strategy === s.value ? 'text-white' : 'text-gray-300'}`}>
                {s.label}
              </p>
              <p className="text-xs text-gray-500 mt-1">{s.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Classifier Demo */}
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Prompt Classifier</h3>
        <div className="flex gap-3">
          <textarea
            value={classifyInput}
            onChange={(e) => setClassifyInput(e.target.value)}
            placeholder="Paste a prompt to classify..."
            rows={3}
            className="flex-1 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/50 resize-y"
          />
        </div>
        <button
          onClick={handleClassify}
          disabled={classifyLoading || !classifyInput.trim()}
          className="mt-3 px-5 py-2.5 bg-amber-500 text-black rounded-lg text-sm font-medium hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {classifyLoading ? 'Classifying...' : 'Classify'}
        </button>

        {classifyResult && (
          <div className="mt-4 pt-4 border-t border-[#1e1e2e] space-y-4">
            {/* Tier + Confidence + Agentic */}
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Tier</p>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${tierColors[classifyResult.tier] ?? 'bg-[#1e1e2e] text-gray-300'}`}>
                  {classifyResult.tier}
                </span>
              </div>
              <div className="flex-1 min-w-[120px]">
                <p className="text-xs text-gray-500 mb-1">Confidence</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: `${classifyResult.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 font-mono">{(classifyResult.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div className="min-w-[120px]">
                <p className="text-xs text-gray-500 mb-1">Agentic Score</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all"
                      style={{ width: `${classifyResult.agenticScore * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 font-mono">{classifyResult.agenticScore.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Top dimension scores */}
            {topDimensions.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Top Dimensions</p>
                <div className="space-y-2">
                  {topDimensions.map(([dim, score]) => (
                    <div key={dim} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-28 truncate capitalize">{dim.replace(/_/g, ' ')}</span>
                      <div className="flex-1 h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${score * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono w-8 text-right">{(score * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended model + cost */}
            <div className="flex flex-wrap gap-4 pt-3 border-t border-[#1e1e2e]">
              <div>
                <p className="text-xs text-gray-500 mb-1">Recommended Model</p>
                <p className="text-sm text-white font-mono">{classifyResult.recommendedModel}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Estimated Cost</p>
                <p className="text-sm text-white font-mono">${classifyResult.estimatedCost.toFixed(6)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Provider Health Grid */}
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Provider Health</h3>
          <button
            onClick={fetchHealth}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            Refresh
          </button>
        </div>

        {healthLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : healthError ? (
          <div className="text-center py-8">
            <p className="text-red-400 text-sm mb-2">{healthError}</p>
            <button
              onClick={fetchHealth}
              className="px-3 py-1.5 text-xs text-gray-400 border border-[#1e1e2e] rounded-lg hover:text-white hover:border-[#3a3a4a] transition-colors"
            >
              Retry
            </button>
          </div>
        ) : providers.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {providers.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-xl border border-[#1e1e2e] hover:border-[#3a3a4a] transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-white">{p.name}</h4>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${statusDot(p)}`} />
                    <span className="text-[10px] text-gray-500">{statusLabel(p)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Latency</span>
                    <span className="text-xs font-mono">
                      <span className="text-gray-200 font-semibold">{p.latencyP50}ms</span>
                      <span className="text-gray-500"> / {p.latencyP95}ms</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Error Rate</span>
                    <span className={`text-xs font-mono ${p.errorRate > 5 ? 'text-red-400' : p.errorRate > 1 ? 'text-amber-400' : 'text-green-400'}`}>
                      {p.errorRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Samples</span>
                    <span className="text-xs text-gray-400 font-mono">{p.samples?.toLocaleString() ?? '0'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">No provider health data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
