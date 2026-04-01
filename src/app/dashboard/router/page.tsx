'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSSE } from '@/hooks/useSSE';

type Strategy = 'auto' | 'cheapest' | 'fastest' | 'quality' | 'decentralized' | 'centralized';

interface ClassifyResult {
  tier: string;
  confidence: number;
  agenticScore: number;
  dimensions: Record<string, number>;
  recommendedModel: string;
  estimatedCost: number;
}

interface TriageResult {
  provider: string;
  model: string;
  routing: string;
  estimatedCost: number;
  reason: string;
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

/* --- Inline SVG Icons (24x24) --- */
function BrainIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a5 5 0 0 1 4.5 2.8A4 4 0 0 1 20 9a4 4 0 0 1-1.5 3.1A5.002 5.002 0 0 1 14 17h-4a5.002 5.002 0 0 1-4.5-4.9A4 4 0 0 1 4 9a4 4 0 0 1 3.5-4.2A5 5 0 0 1 12 2z" />
      <path d="M12 2v15M8 6.5a2 2 0 0 0-2 2M16 6.5a2 2 0 0 1 2 2" />
      <path d="M12 17v5" />
    </svg>
  );
}
function DollarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12M9 9.5a2.5 2.5 0 0 1 2.5-2.5h1a2.5 2.5 0 0 1 0 5h-1A2.5 2.5 0 0 0 9 14.5 2.5 2.5 0 0 0 11.5 17h1a2.5 2.5 0 0 0 2.5-2.5" />
    </svg>
  );
}
function LightningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
function ServerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <circle cx="6" cy="6" r="1" fill="currentColor" />
      <circle cx="6" cy="18" r="1" fill="currentColor" />
    </svg>
  );
}

const strategyIcons: Record<Strategy, React.ComponentType<{ className?: string }>> = {
  auto: BrainIcon,
  cheapest: DollarIcon,
  fastest: LightningIcon,
  quality: StarIcon,
  decentralized: GlobeIcon,
  centralized: ServerIcon,
};

const strategies: { value: Strategy; label: string; description: string }[] = [
  { value: 'auto', label: 'Auto', description: 'AI picks the best provider based on health, cost, and quality' },
  { value: 'cheapest', label: 'Cheapest', description: 'Always route to the lowest cost option' },
  { value: 'fastest', label: 'Fastest', description: 'Prioritize lowest latency providers' },
  { value: 'quality', label: 'Quality', description: 'Route to the highest quality model available' },
  { value: 'decentralized', label: 'Decentralized', description: 'Prefer OpenClaw nodes when available' },
  { value: 'centralized', label: 'Centralized', description: 'Only use traditional API providers' },
];

const tierColors: Record<string, string> = {
  TRIVIAL: 'bg-green-500/20 text-green-400',
  STANDARD: 'bg-blue-500/20 text-blue-400',
  COMPLEX: 'bg-amber-500/20 text-amber-400',
  REASONING: 'bg-purple-500/20 text-purple-400',
};

/* --- Animated horizontal bar --- */
function AnimatedBar({ value, color, delay }: { value: number; color: string; delay: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setWidth(value * 100), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return (
    <div className="flex-1 h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </div>
  );
}

/* --- Latency bar chart (inline SVG) --- */
function LatencyChart({ providers }: { providers: ProviderHealth[] }) {
  if (providers.length === 0) return null;
  const maxLatency = Math.max(...providers.map((p) => p.latencyP50), 1);
  const barWidth = Math.max(20, Math.min(60, 400 / providers.length));
  const chartWidth = providers.length * (barWidth + 8) + 16;
  const chartHeight = 120;

  return (
    <div className="overflow-x-auto">
      <svg width={chartWidth} height={chartHeight + 30} viewBox={`0 0 ${chartWidth} ${chartHeight + 30}`}>
        {providers.map((p, i) => {
          const barH = Math.max(4, (p.latencyP50 / maxLatency) * (chartHeight - 20));
          const x = 8 + i * (barWidth + 8);
          const y = chartHeight - barH;
          return (
            <g key={p.id}>
              <rect
                x={x} y={y} width={barWidth} height={barH}
                rx="4" fill={p.healthy ? '#f59e0b' : '#ef4444'}
                opacity="0.8"
              />
              <text
                x={x + barWidth / 2} y={y - 4}
                textAnchor="middle" fill="#9ca3af" fontSize="9" fontFamily="monospace"
              >
                {p.latencyP50}ms
              </text>
              <text
                x={x + barWidth / 2} y={chartHeight + 14}
                textAnchor="middle" fill="#6b7280" fontSize="8"
              >
                {p.name.length > 8 ? p.name.slice(0, 7) + '...' : p.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function RouterPage() {
  const [strategy, setStrategy] = useState<Strategy>('auto');
  const [classifyInput, setClassifyInput] = useState('');
  const [classifyResult, setClassifyResult] = useState<ClassifyResult | null>(null);
  const [classifyLoading, setClassifyLoading] = useState(false);
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Test Route state
  const [testRouteInput, setTestRouteInput] = useState('');
  const [testRouteResult, setTestRouteResult] = useState<TriageResult | null>(null);
  const [testRouteLoading, setTestRouteLoading] = useState(false);

  // SSE: auto-refresh health when health_update events arrive
  const { lastEvent: healthEvent } = useSSE(['health_update']);

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

  // Re-fetch health data when an SSE health_update event arrives
  useEffect(() => {
    if (healthEvent) {
      fetchHealth();
    }
  }, [healthEvent, fetchHealth]);

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

  async function handleTestRoute() {
    if (!testRouteInput.trim()) return;
    setTestRouteLoading(true);
    setTestRouteResult(null);
    try {
      const res = await fetch('/api/dispatch/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: testRouteInput, routing: strategy }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setTestRouteResult(json);
    } catch {
      setTestRouteResult(null);
    } finally {
      setTestRouteLoading(false);
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

  function errorRateColor(rate: number) {
    if (rate > 5) return 'text-red-400';
    if (rate > 1) return 'text-amber-400';
    return 'text-green-400';
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
          {strategies.map((s) => {
            const Icon = strategyIcons[s.value];
            const isActive = strategy === s.value;
            return (
              <button
                key={s.value}
                onClick={() => setStrategy(s.value)}
                className={`relative flex flex-col items-start p-4 rounded-xl border text-left transition-all duration-300 ${
                  isActive
                    ? 'border-amber-500 bg-amber-500/5 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                    : 'border-[#1e1e2e] hover:border-[#3a3a4a]'
                }`}
              >
                {isActive && (
                  <div className="absolute inset-0 rounded-xl border border-amber-500/50 animate-pulse pointer-events-none" />
                )}
                <div className={`mb-2 ${isActive ? 'text-amber-400' : 'text-gray-500'}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <p className={`text-sm font-medium ${isActive ? 'text-white' : 'text-gray-300'}`}>
                  {s.label}
                </p>
                <p className="text-xs text-gray-500 mt-1">{s.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Test Route */}
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Test Route</h3>
        <p className="text-xs text-gray-500 mb-3">Enter a prompt to see which provider would be chosen with the current strategy.</p>
        <div className="flex gap-3">
          <input
            value={testRouteInput}
            onChange={(e) => setTestRouteInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTestRoute()}
            placeholder="Type a prompt to test routing..."
            className="flex-1 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
          />
          <button
            onClick={handleTestRoute}
            disabled={testRouteLoading || !testRouteInput.trim()}
            className="px-5 py-2.5 bg-amber-500 text-black rounded-lg text-sm font-medium hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {testRouteLoading ? 'Routing...' : 'Test Route'}
          </button>
        </div>
        {testRouteResult && (
          <div className="mt-4 pt-4 border-t border-[#1e1e2e] grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Provider</p>
              <p className="text-sm text-white font-medium">{testRouteResult.provider}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Model</p>
              <p className="text-sm text-white font-mono">{testRouteResult.model}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Strategy</p>
              <p className="text-sm text-amber-400">{testRouteResult.routing}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Est. Cost</p>
              <p className="text-sm text-green-400 font-mono">${testRouteResult.estimatedCost?.toFixed(6) ?? '---'}</p>
            </div>
          </div>
        )}
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

            {/* Top dimension scores — animated bars */}
            {topDimensions.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Top Dimensions</p>
                <div className="space-y-2">
                  {topDimensions.map(([dim, score], idx) => (
                    <div key={dim} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-28 truncate capitalize">{dim.replace(/_/g, ' ')}</span>
                      <AnimatedBar value={score} color="#3b82f6" delay={idx * 100} />
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
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {providers.map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-xl border border-[#1e1e2e] hover:border-[#3a3a4a] transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-white">{p.name}</h4>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${statusDot(p)} ${p.healthy && !p.cooldown ? 'animate-pulse' : ''}`} />
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
                      <span className={`text-xs font-mono ${errorRateColor(p.errorRate)}`}>
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

            {/* Latency Comparison Chart */}
            <div className="mt-6 pt-6 border-t border-[#1e1e2e]">
              <h4 className="text-sm font-semibold text-white mb-3">P50 Latency Comparison</h4>
              <LatencyChart providers={providers} />
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">No provider health data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
