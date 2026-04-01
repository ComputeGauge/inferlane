'use client';

import { useState } from 'react';

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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Dispatch</h1>
        <p className="text-gray-500 mt-1">
          Triage and dispatch prompts to the optimal provider and model.
        </p>
      </header>

      {/* Prompt Area */}
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6 space-y-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt..."
          rows={6}
          className="w-full bg-[#12121a] border border-[#1e1e2e] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/50 resize-y"
        />

        {/* Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Model</label>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="auto (let InferLane choose)"
              className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Routing</label>
            <select
              value={routing}
              onChange={(e) => setRouting(e.target.value)}
              className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
            >
              <option value="auto">Auto</option>
              <option value="cheapest">Cheapest</option>
              <option value="fastest">Fastest</option>
              <option value="quality">Quality</option>
              <option value="decentralized_only">Decentralized Only</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
            >
              <option value="realtime">Realtime</option>
              <option value="standard">Standard</option>
              <option value="batch">Batch</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Cost Sensitivity</label>
            <select
              value={costSensitivity}
              onChange={(e) => setCostSensitivity(e.target.value)}
              className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
            >
              <option value="minimum">Minimum</option>
              <option value="balanced">Balanced</option>
              <option value="quality_first">Quality First</option>
            </select>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => handleSubmit(false)}
            disabled={loading || !prompt.trim()}
            className="px-5 py-2.5 border border-amber-500 text-amber-500 rounded-lg text-sm font-medium hover:bg-amber-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'Triage'}
          </button>
          <button
            onClick={() => handleSubmit(true)}
            disabled={loading || !prompt.trim()}
            className="px-5 py-2.5 bg-amber-500 text-black rounded-lg text-sm font-medium hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Triage Result */}
      {triageResult && (
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Triage Result</h3>

          {/* Badge Row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${tierColors[triageResult.complexityTier] ?? 'bg-[#1e1e2e] text-gray-300 border-[#2a2a3a]'}`}>
              {triageResult.complexityTier}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20">
              {triageResult.importance}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/20">
              {triageResult.urgency}
            </span>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Confidence</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all"
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
            className="px-5 py-2.5 bg-amber-500 text-black rounded-lg text-sm font-medium hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Execute this recommendation
          </button>
        </div>
      )}

      {/* Dispatch Result */}
      {dispatchResult && (
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6 space-y-4">
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
    </div>
  );
}
