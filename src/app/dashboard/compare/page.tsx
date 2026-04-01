'use client';

import { useState } from 'react';

// Provider → model options mapping
const PROVIDER_MODELS: Record<string, string[]> = {
  ANTHROPIC: ['claude-4-sonnet', 'claude-4-haiku', 'claude-3.5-sonnet'],
  OPENAI: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  GOOGLE: ['gemini-2.0-flash', 'gemini-1.5-pro'],
  TOGETHER: ['meta-llama/Llama-3-70b-chat-hf', 'meta-llama/Llama-3-8b-chat-hf'],
  GROQ: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant'],
  DEEPSEEK: ['deepseek-chat', 'deepseek-reasoner'],
  XAI: ['grok-2'],
  PERPLEXITY: ['sonar-pro', 'sonar'],
  CEREBRAS: ['llama3.1-8b', 'llama3.1-70b'],
  SAMBANOVA: ['Meta-Llama-3.1-8B-Instruct', 'Meta-Llama-3.1-70B-Instruct'],
  MISTRAL: ['mistral-large-latest', 'mistral-small-latest'],
  COHERE: ['command-r-plus', 'command-r'],
  FIREWORKS: ['accounts/fireworks/models/llama-v3p1-70b-instruct', 'accounts/fireworks/models/llama-v3p1-8b-instruct'],
  REPLICATE: ['meta/llama-3-70b-instruct', 'meta/llama-3-8b-instruct'],
};

const PROVIDERS = Object.keys(PROVIDER_MODELS);

interface CompareResult {
  provider: string;
  model: string;
  response: string;
  tokens: { input: number; output: number; total: number };
  cost: number;
  latencyMs: number;
  error?: string;
}

interface CompareResponse {
  a: CompareResult;
  b: CompareResult;
  savings: { amount: number; percent: number; winner: string };
}

function ProviderSelector({
  label,
  provider,
  model,
  onProviderChange,
  onModelChange,
}: {
  label: string;
  provider: string;
  model: string;
  onProviderChange: (p: string) => void;
  onModelChange: (m: string) => void;
}) {
  const models = PROVIDER_MODELS[provider] || [];

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-400">{label}</label>
      <select
        value={provider}
        onChange={(e) => {
          onProviderChange(e.target.value);
          const newModels = PROVIDER_MODELS[e.target.value] || [];
          if (newModels.length > 0) onModelChange(newModels[0]);
        }}
        className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none"
      >
        {PROVIDERS.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <select
        value={model}
        onChange={(e) => onModelChange(e.target.value)}
        className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none"
      >
        {models.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
    </div>
  );
}

function LatencyBar({ latencyMs, maxLatency }: { latencyMs: number; maxLatency: number }) {
  const pct = maxLatency > 0 ? Math.min((latencyMs / maxLatency) * 100, 100) : 0;
  return (
    <div className="w-full bg-[#1e1e2e] rounded-full h-2">
      <div
        className="bg-amber-500 h-2 rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ResultCard({
  label,
  result,
  isWinner,
  maxLatency,
}: {
  label: string;
  result: CompareResult;
  isWinner: boolean;
  maxLatency: number;
}) {
  return (
    <div className={`bg-[#12121a] rounded-2xl border ${isWinner ? 'border-amber-500' : 'border-[#1e1e2e]'} p-6 flex flex-col`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold">{label}</h3>
          <p className="text-sm text-gray-500">{result.provider} / {result.model}</p>
        </div>
        {isWinner && (
          <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs font-semibold rounded-full">
            WINNER
          </span>
        )}
      </div>

      {result.error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
          <p className="text-red-400 text-sm">{result.error}</p>
        </div>
      ) : (
        <div className="bg-[#0a0a0f] rounded-lg p-4 mb-4 flex-1 max-h-64 overflow-y-auto">
          <p className="text-gray-300 text-sm whitespace-pre-wrap">{result.response}</p>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Latency</span>
            <span>{result.latencyMs.toLocaleString()}ms</span>
          </div>
          <LatencyBar latencyMs={result.latencyMs} maxLatency={maxLatency} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#0a0a0f] rounded-lg p-3">
            <p className="text-xs text-gray-500">Cost</p>
            <p className="text-white font-mono text-sm">${result.cost.toFixed(6)}</p>
          </div>
          <div className="bg-[#0a0a0f] rounded-lg p-3">
            <p className="text-xs text-gray-500">Tokens</p>
            <p className="text-white font-mono text-sm">{result.tokens.total.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ComparePage() {
  const [prompt, setPrompt] = useState('');
  const [providerA, setProviderA] = useState('ANTHROPIC');
  const [modelA, setModelA] = useState('claude-4-sonnet');
  const [providerB, setProviderB] = useState('OPENAI');
  const [modelB, setModelB] = useState('gpt-4o');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [error, setError] = useState('');

  async function handleCompare() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          providerA: { provider: providerA, model: modelA },
          providerB: { provider: providerB, model: modelB },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || `Request failed (${res.status})`);
        return;
      }

      const data: CompareResponse = await res.json();
      setResult(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  const maxLatency = result ? Math.max(result.a.latencyMs, result.b.latencyMs, 1) : 1;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Model A/B Comparison</h1>
        <p className="text-gray-500 mt-1">
          Send the same prompt to two models and compare response quality, speed, and cost.
        </p>
      </div>

      {/* Input Form */}
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6 space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-400 mb-2 block">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="Enter a prompt to send to both models..."
            className="w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3 text-white text-sm placeholder-gray-600 focus:border-amber-500 focus:outline-none resize-y"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <ProviderSelector
            label="Provider A"
            provider={providerA}
            model={modelA}
            onProviderChange={setProviderA}
            onModelChange={setModelA}
          />
          <ProviderSelector
            label="Provider B"
            provider={providerB}
            model={modelB}
            onProviderChange={setProviderB}
            onModelChange={setModelB}
          />
        </div>

        <button
          onClick={handleCompare}
          disabled={loading || !prompt.trim()}
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold py-3 rounded-lg hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              Comparing...
            </>
          ) : (
            'Compare'
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Savings Banner */}
          {result.savings.amount > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-amber-400 font-semibold">
                  Model {result.savings.winner} saves ${result.savings.amount.toFixed(6)} ({result.savings.percent.toFixed(1)}%)
                </p>
                <p className="text-amber-400/70 text-sm mt-0.5">
                  per request compared to Model {result.savings.winner === 'A' ? 'B' : 'A'}
                </p>
              </div>
              <div className="text-3xl font-bold text-amber-400">
                {result.savings.percent.toFixed(0)}%
              </div>
            </div>
          )}

          {/* Side-by-side Results */}
          <div className="grid md:grid-cols-2 gap-6">
            <ResultCard
              label="Model A"
              result={result.a}
              isWinner={result.savings.winner === 'A'}
              maxLatency={maxLatency}
            />
            <ResultCard
              label="Model B"
              result={result.b}
              isWinner={result.savings.winner === 'B'}
              maxLatency={maxLatency}
            />
          </div>
        </>
      )}
    </div>
  );
}
