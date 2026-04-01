'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface ConnectedProvider {
  provider: string;
  displayName?: string;
  createdAt?: string;
  lastUsed?: string;
  apiKeyPrefix?: string;
  apiKeySuffix?: string;
  requests?: number;
  totalCost?: number;
}

const providerMeta: Record<string, { color: string; emoji: string }> = {
  ANTHROPIC: { color: '#d4a27f', emoji: 'A' },
  OPENAI: { color: '#10a37f', emoji: 'O' },
  GOOGLE: { color: '#4285f4', emoji: 'G' },
  TOGETHER: { color: '#ff6b35', emoji: 'T' },
  AWS_BEDROCK: { color: '#ff9900', emoji: 'B' },
  AZURE_OPENAI: { color: '#0078d4', emoji: 'Az' },
  REPLICATE: { color: '#e44dba', emoji: 'R' },
  FIREWORKS: { color: '#ff4500', emoji: 'F' },
  GROQ: { color: '#f55036', emoji: 'Gr' },
  DEEPSEEK: { color: '#4a6cf7', emoji: 'D' },
  XAI: { color: '#1d9bf0', emoji: 'X' },
  PERPLEXITY: { color: '#20b2aa', emoji: 'P' },
  CEREBRAS: { color: '#ff6b6b', emoji: 'C' },
  SAMBANOVA: { color: '#7c3aed', emoji: 'S' },
  MISTRAL: { color: '#ff7000', emoji: 'M' },
  COHERE: { color: '#39594d', emoji: 'Co' },
  MODAL: { color: '#00c853', emoji: 'Mo' },
  LAMBDA: { color: '#6c3dab', emoji: 'L' },
  COREWEAVE: { color: '#00b4d8', emoji: 'CW' },
};

function maskKey(prefix?: string, suffix?: string): string {
  if (!prefix && !suffix) return '---';
  const p = prefix ?? '****';
  const s = suffix ?? '****';
  return `${p.slice(0, 8)}...${s.slice(-4)}`;
}

function timeAgo(ts?: string): string {
  if (!ts) return 'Never';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<ConnectedProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, 'ok' | 'fail'>>({});

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/providers');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // Normalize: API may return array of objects or wrapped
      const list = Array.isArray(json) ? json : json.providers ?? [];
      setProviders(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  async function handleDisconnect(providerId: string) {
    setDisconnecting(providerId);
    try {
      const res = await fetch(`/api/providers?provider=${providerId}`, { method: 'DELETE' });
      if (res.ok) {
        setProviders((prev) => prev.filter((p) => p.provider !== providerId));
      }
    } catch {
      // silently fail
    } finally {
      setDisconnecting(null);
      setConfirmDisconnect(null);
    }
  }

  async function handleTest(providerId: string) {
    setTesting(providerId);
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[providerId];
      return next;
    });
    try {
      const res = await fetch(`/api/providers/verify?provider=${providerId}`);
      setTestResults((prev) => ({ ...prev, [providerId]: res.ok ? 'ok' : 'fail' }));
    } catch {
      setTestResults((prev) => ({ ...prev, [providerId]: 'fail' }));
    } finally {
      setTesting(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Connected Providers</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your AI provider connections and monitor usage.</p>
          </div>
        </header>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#1e1e2e] animate-pulse" />
                <div>
                  <div className="h-4 w-24 bg-[#1e1e2e] rounded animate-pulse mb-1" />
                  <div className="h-3 w-16 bg-[#1e1e2e] rounded animate-pulse" />
                </div>
              </div>
              <div className="h-3 w-full bg-[#1e1e2e] rounded animate-pulse mb-2" />
              <div className="h-3 w-2/3 bg-[#1e1e2e] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-white">Connected Providers</h1>
        </header>
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
          <p className="text-red-400 font-medium mb-2">Failed to load providers</p>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button
            onClick={fetchProviders}
            className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Connected Providers</h1>
            {providers.length > 0 && (
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-500/15 text-amber-400 rounded-full">
                {providers.length}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Manage your AI provider connections and monitor usage across all platforms.
          </p>
        </div>
        <Link
          href="/dashboard/onboarding"
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-black rounded-xl text-sm font-medium hover:bg-amber-400 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Connect New
        </Link>
      </header>

      {/* Provider Grid */}
      {providers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((p) => {
            const meta = providerMeta[p.provider] ?? { color: '#6b7280', emoji: '?' };
            const isConfirming = confirmDisconnect === p.provider;
            const testStatus = testResults[p.provider];

            return (
              <div
                key={p.provider}
                className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-5 hover:border-[#2a2a3a] transition-all"
              >
                {/* Provider header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                      style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
                    >
                      {meta.emoji}
                    </div>
                    <div>
                      <h4 className="font-semibold text-white text-sm">
                        {p.displayName ?? p.provider}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        <span className="text-[10px] text-gray-500">Connected</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Key info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">API Key</span>
                    <span className="text-xs text-gray-400 font-mono">
                      {maskKey(p.apiKeyPrefix, p.apiKeySuffix)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">Last Used</span>
                    <span className="text-xs text-gray-400">{timeAgo(p.lastUsed)}</span>
                  </div>
                  {(p.requests !== undefined || p.totalCost !== undefined) && (
                    <>
                      {p.requests !== undefined && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Requests</span>
                          <span className="text-xs text-gray-400 font-mono">{p.requests.toLocaleString()}</span>
                        </div>
                      )}
                      {p.totalCost !== undefined && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Total Cost</span>
                          <span className="text-xs text-green-400 font-mono">${p.totalCost.toFixed(2)}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-[#1e1e2e]">
                  <button
                    onClick={() => handleTest(p.provider)}
                    disabled={testing === p.provider}
                    className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                      testStatus === 'ok'
                        ? 'border-green-500/30 text-green-400 bg-green-500/10'
                        : testStatus === 'fail'
                        ? 'border-red-500/30 text-red-400 bg-red-500/10'
                        : 'border-[#1e1e2e] text-gray-400 hover:text-white hover:border-[#3a3a4a]'
                    } disabled:opacity-50`}
                  >
                    {testing === p.provider
                      ? 'Testing...'
                      : testStatus === 'ok'
                      ? 'Connected'
                      : testStatus === 'fail'
                      ? 'Failed'
                      : 'Test Connection'}
                  </button>

                  {isConfirming ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDisconnect(p.provider)}
                        disabled={disconnecting === p.provider}
                        className="px-3 py-2 text-xs font-medium rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                      >
                        {disconnecting === p.provider ? '...' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setConfirmDisconnect(null)}
                        className="px-3 py-2 text-xs text-gray-500 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDisconnect(p.provider)}
                      className="px-3 py-2 text-xs font-medium rounded-lg border border-[#1e1e2e] text-red-400/70 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-all"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-[#12121a] rounded-2xl border border-dashed border-[#2a2a3a] p-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1e1e2e] flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <p className="text-gray-400 text-lg mb-2">No providers connected yet</p>
          <p className="text-sm text-gray-600 mb-6">
            Connect your first AI provider to start monitoring usage and spend.
          </p>
          <Link
            href="/dashboard/onboarding"
            className="inline-block px-5 py-2.5 bg-amber-500 text-black rounded-lg text-sm font-medium hover:bg-amber-400 transition-colors"
          >
            Connect Your First Provider
          </Link>
        </div>
      )}
    </div>
  );
}
