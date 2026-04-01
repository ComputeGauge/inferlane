'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSSE } from '@/hooks/useSSE';

interface TriageResult {
  importance: string;
  urgency: string;
  complexityTier: string;
  confidence: number;
  estimatedCost: number;
  savingsAvailable: number;
  recommendedPlatform: string;
  recommendedProvider: string;
  recommendedModel: string;
  executionMode: string;
  reason: string;
}

interface DispatchResult {
  taskId: string;
  status: string;
  content: string | null;
  cost?: number;
  latencyMs?: number;
}

interface RecentDispatch {
  id: string;
  prompt: string;
  status: string;
  model?: string;
  cost?: number;
  timestamp: Date;
}

const tierColors: Record<string, string> = {
  TRIVIAL: 'bg-green-500/20 text-green-400 border-green-500/30',
  STANDARD: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  COMPLEX: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  REASONING: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const statusColors: Record<string, string> = {
  executing: 'bg-amber-500/20 text-amber-400',
  queued: 'bg-blue-500/20 text-blue-400',
  completed: 'bg-green-500/20 text-green-400',
  failed: 'bg-red-500/20 text-red-400',
  sent: 'bg-green-500/20 text-green-400',
  triaged: 'bg-blue-500/20 text-blue-400',
};

const tooltips: Record<string, string> = {
  routing: 'Auto: balanced cost/speed. Cheapest: minimize cost. Fastest: minimize latency. Quality: best model. Decentralized: local/P2P only.',
  priority: 'Realtime: immediate execution. Standard: queued, balanced. Batch: lowest priority, cheapest rate.',
  costSensitivity: 'Minimum: aggressively cheapest. Balanced: cost vs quality tradeoff. Quality First: best model regardless of cost.',
};

export default function DispatchPage() {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('');
  const [routing, setRouting] = useState('auto');
  const [priority, setPriority] = useState('standard');
  const [costSensitivity, setCostSensitivity] = useState('balanced');
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [dispatchResult, setDispatchResult] = useState<DispatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentDispatches, setRecentDispatches] = useState<RecentDispatch[]>([]);
  const [triageVisible, setTriageVisible] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const estimatedTokens = Math.ceil(prompt.length / 4);

  // SSE: auto-update recent dispatches when dispatch_status events arrive
  const { lastEvent: dispatchEvent } = useSSE(['dispatch_status']);

  useEffect(() => {
    if (!dispatchEvent) return;
    const data = dispatchEvent.data;
    const sseDispatch: RecentDispatch = {
      id: (data.taskId as string) ?? `sse-${Date.now()}`,
      prompt: `[via SSE] ${(data.model as string) ?? 'unknown'}`,
      status: (data.status as string) ?? 'completed',
      model: (data.model as string) ?? undefined,
      cost: (data.costUsd as number) ?? undefined,
      timestamp: new Date(dispatchEvent.timestamp),
    };
    setRecentDispatches((prev) => [sseDispatch, ...prev].slice(0, 10));
  }, [dispatchEvent]);

  // Keyboard shortcut: Cmd+Enter to send
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (prompt.trim() && !loading) {
        handleSubmit(true);
      }
    }
    // Shift+Enter is default newline behavior in textarea — no override needed
  }, [prompt, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animate triage result visibility
  useEffect(() => {
    if (triageResult) {
      const timer = setTimeout(() => setTriageVisible(true), 50);
      return () => clearTimeout(timer);
    }
    setTriageVisible(false);
  }, [triageResult]);

  async function handleSubmit(autoExecute: boolean) {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    if (autoExecute) {
      setDispatchResult(null);
    } else {
      setTriageResult(null);
      setDispatchResult(null);
    }
    try {
      const res = await fetch('/api/dispatch/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: model || undefined,
          strategy: routing,
          priority,
          costSensitivity,
          autoExecute,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      // Track in recent dispatches
      const recent: RecentDispatch = {
        id: json.taskId ?? `triage-${Date.now()}`,
        prompt: prompt.slice(0, 80) + (prompt.length > 80 ? '...' : ''),
        status: autoExecute ? 'sent' : 'triaged',
        model: json.recommendedModel ?? model ?? undefined,
        cost: json.estimatedCost ?? json.cost ?? undefined,
        timestamp: new Date(),
      };
      setRecentDispatches((prev) => [recent, ...prev].slice(0, 5));

      if (autoExecute) {
        setDispatchResult(json);
      } else {
        setTriageResult(json);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleExecuteRecommendation() {
    if (!prompt.trim()) return;
    await handleSubmit(true);
  }

  function relativeTime(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ago`;
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <header>
        <h1 className="text-2xl font-bold text-white">Dispatch</h1>
        <p className="text-gray-500 mt-1">
          Triage and dispatch prompts to the optimal provider and model.
        </p>
      </header>

      {/* Prompt Area */}
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6 space-y-4">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your prompt..."
            rows={6}
            className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/50 focus:shadow-[0_0_0_1px_rgba(245,158,11,0.15)] resize-y transition-all duration-200"
          />
          {/* Character / Token counter */}
          <div className="flex items-center justify-between mt-1.5 px-1">
            <span className="text-[11px] text-gray-600">
              {prompt.length > 0 ? (
                <>
                  {prompt.length.toLocaleString()} chars &middot; ~{estimatedTokens.toLocaleString()} tokens
                </>
              ) : (
                <span className="opacity-0">-</span>
              )}
            </span>
            <span className="text-[11px] text-gray-600">
              {navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}+Enter to send
            </span>
          </div>
        </div>

        {/* Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Model</label>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="auto (let InferLane choose)"
              className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>
          <div className="group relative">
            <label className="block text-xs text-gray-500 mb-1">
              Routing
              <span className="ml-1 inline-block w-3 h-3 rounded-full bg-[#1e1e2e] text-[9px] text-gray-500 text-center leading-3 cursor-help" title={tooltips.routing}>?</span>
            </label>
            <select
              value={routing}
              onChange={(e) => setRouting(e.target.value)}
              className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
            >
              <option value="auto">Auto</option>
              <option value="cheapest">Cheapest</option>
              <option value="fastest">Fastest</option>
              <option value="quality">Quality</option>
              <option value="decentralized_only">Decentralized Only</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Priority
              <span className="ml-1 inline-block w-3 h-3 rounded-full bg-[#1e1e2e] text-[9px] text-gray-500 text-center leading-3 cursor-help" title={tooltips.priority}>?</span>
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
            >
              <option value="realtime">Realtime</option>
              <option value="standard">Standard</option>
              <option value="batch">Batch</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Cost Sensitivity
              <span className="ml-1 inline-block w-3 h-3 rounded-full bg-[#1e1e2e] text-[9px] text-gray-500 text-center leading-3 cursor-help" title={tooltips.costSensitivity}>?</span>
            </label>
            <select
              value={costSensitivity}
              onChange={(e) => setCostSensitivity(e.target.value)}
              className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
            >
              <option value="minimum">Minimum</option>
              <option value="balanced">Balanced</option>
              <option value="quality_first">Quality First</option>
            </select>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSubmit(false)}
            disabled={loading || !prompt.trim()}
            className="px-5 py-2.5 border border-amber-500 text-amber-500 rounded-lg text-sm font-medium hover:bg-amber-500/10 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'Triage'}
          </button>
          <button
            onClick={() => handleSubmit(true)}
            disabled={loading || !prompt.trim()}
            className="px-5 py-2.5 bg-amber-500 text-black rounded-lg text-sm font-medium hover:bg-amber-400 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Sending...
              </span>
            ) : 'Send'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 flex items-start gap-3 animate-fade-in-up">
          <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div className="flex-1">
            <p className="text-red-400 text-sm font-medium">Dispatch failed</p>
            <p className="text-red-400/70 text-sm mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => handleSubmit(true)}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Triage Result */}
      {triageResult && (
        <div
          className={`bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6 space-y-4 transition-all duration-400 ${
            triageVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}
        >
          <h3 className="text-lg font-semibold text-white">Triage Result</h3>

          {/* Badge Row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`animate-badgePop stagger-1 px-3 py-1 rounded-full text-xs font-semibold border ${tierColors[triageResult.complexityTier] ?? 'bg-[#1e1e2e] text-gray-300 border-[#2a2a3a]'}`}>
              {triageResult.complexityTier}
            </span>
            <span className="animate-badgePop stagger-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20">
              {triageResult.importance}
            </span>
            <span className="animate-badgePop stagger-3 px-3 py-1 rounded-full text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/20">
              {triageResult.urgency}
            </span>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Confidence</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full animate-expandWidth"
                    style={{ width: `${triageResult.confidence * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 font-mono w-10 text-right">
                  {(triageResult.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Estimated Cost</p>
              <p className="text-sm text-white font-mono">${triageResult.estimatedCost.toFixed(6)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Potential Savings</p>
              <p className="text-sm text-green-400 font-mono">${triageResult.savingsAvailable.toFixed(6)}</p>
            </div>
          </div>

          {/* Recommended */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-[#1e1e2e]">
            <div>
              <p className="text-xs text-gray-500 mb-1">Platform</p>
              <p className="text-sm text-white">{triageResult.recommendedPlatform}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Provider</p>
              <p className="text-sm text-white">{triageResult.recommendedProvider}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Model</p>
              <p className="text-sm text-white font-mono">{triageResult.recommendedModel}</p>
            </div>
          </div>

          {/* Execution mode */}
          <div className="pt-3 border-t border-[#1e1e2e]">
            <p className="text-xs text-gray-500 mb-1">Execution Mode</p>
            <p className="text-sm text-white">{triageResult.executionMode}</p>
          </div>

          {/* Reason */}
          <div className="pt-3 border-t border-[#1e1e2e]">
            <p className="text-xs text-gray-500 mb-1">Reason</p>
            <p className="text-sm text-gray-400 italic">{triageResult.reason}</p>
          </div>

          {/* Execute Button */}
          <button
            onClick={handleExecuteRecommendation}
            disabled={loading}
            className="px-5 py-2.5 bg-amber-500 text-black rounded-lg text-sm font-medium hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Execute this recommendation
          </button>
        </div>
      )}

      {/* Dispatch Result */}
      {dispatchResult && (
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6 space-y-4 animate-fade-in-up">
          <h3 className="text-lg font-semibold text-white">Dispatch Result</h3>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Task ID</p>
              <p className="text-sm text-white font-mono">{dispatchResult.taskId}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Status</p>
              <span className={`px-2 py-1 rounded-md text-xs font-medium ${statusColors[dispatchResult.status] ?? 'bg-[#1e1e2e] text-gray-300'}`}>
                {dispatchResult.status}
              </span>
            </div>
            {dispatchResult.cost != null && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Cost</p>
                <p className="text-sm text-white font-mono">${dispatchResult.cost.toFixed(6)}</p>
              </div>
            )}
            {dispatchResult.latencyMs != null && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Latency</p>
                <p className="text-sm text-white font-mono">{dispatchResult.latencyMs}ms</p>
              </div>
            )}
          </div>
          {dispatchResult.content && (
            <div className="bg-[#0a0a0f] rounded-xl p-4 border border-[#1e1e2e]">
              <pre className="text-sm text-gray-300 whitespace-pre-wrap break-words">
                {dispatchResult.content}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Recent Dispatches */}
      {recentDispatches.length > 0 && (
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] overflow-hidden animate-fade-in-up">
          <div className="p-4 border-b border-[#1e1e2e]">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Recent Dispatches
            </h3>
          </div>
          <div className="divide-y divide-[#1e1e2e]">
            {recentDispatches.map((d) => (
              <div key={d.id} className="px-4 py-3 flex items-center gap-3 hover:bg-[#1e1e2e]/30 transition-colors">
                <span className={`flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-medium ${statusColors[d.status] ?? 'bg-[#1e1e2e] text-gray-400'}`}>
                  {d.status}
                </span>
                <span className="text-sm text-gray-300 truncate flex-1 min-w-0">
                  {d.prompt}
                </span>
                {d.model && (
                  <span className="text-[11px] text-gray-500 font-mono flex-shrink-0 hidden sm:inline">
                    {d.model}
                  </span>
                )}
                {d.cost != null && (
                  <span className="text-[11px] text-gray-500 font-mono flex-shrink-0">
                    ${d.cost.toFixed(4)}
                  </span>
                )}
                <span className="text-[11px] text-gray-600 flex-shrink-0">
                  {relativeTime(d.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
