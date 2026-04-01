'use client';

import { useState, useEffect, useCallback } from 'react';

interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  model?: string;
  tokens?: number;
  cost?: number;
}

interface SessionSummary {
  id: string;
  messageCount: number;
  providers: string[];
  totalCost: number;
  lastActive: string;
}

interface SessionDetail {
  id: string;
  messages: SessionMessage[];
  providers: string[];
  models: string[];
  totalTokens: number;
  totalCost: number;
  createdAt: string;
}

const providerColors: Record<string, string> = {
  anthropic: 'bg-amber-500/20 text-amber-400',
  openai: 'bg-green-500/20 text-green-400',
  deepseek: 'bg-blue-500/20 text-blue-400',
  openclaw: 'bg-purple-500/20 text-purple-400',
  google: 'bg-red-500/20 text-red-400',
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sessions?limit=50');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setSessions(json.sessions ?? json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  async function handleSelectSession(sessionId: string) {
    setSelectedId(sessionId);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setSelectedSession(json);
    } catch {
      setSelectedSession(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleCreateSession() {
    try {
      const res = await fetch('/api/sessions', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchSessions();
    } catch {
      // silently fail
    }
  }

  async function handleDeleteSession(sessionId: string) {
    if (!window.confirm('Delete this session? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (selectedId === sessionId) {
        setSelectedSession(null);
        setSelectedId(null);
      }
      await fetchSessions();
    } catch {
      // silently fail
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-white">Sessions</h1>
          <p className="text-gray-500 mt-1">Cross-provider session history and conversation viewer.</p>
        </header>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sessions</h1>
          <p className="text-gray-500 mt-1">
            Cross-provider session history and conversation viewer.
          </p>
        </div>
        <button
          onClick={handleCreateSession}
          className="px-4 py-2 bg-amber-500 text-black rounded-lg text-sm font-medium hover:bg-amber-400 transition-colors"
        >
          New Session
        </button>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Session List (1/3) */}
        <div className="lg:col-span-1">
          <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] overflow-hidden">
            <div className="p-4 border-b border-[#1e1e2e]">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Sessions ({sessions.length})
              </h3>
            </div>
            {sessions.length > 0 ? (
              <div className="divide-y divide-[#1e1e2e] max-h-[700px] overflow-y-auto">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => handleSelectSession(session.id)}
                    className={`p-4 cursor-pointer hover:bg-[#1e1e2e]/50 transition-colors ${
                      selectedId === session.id
                        ? 'border-l-2 border-l-amber-500 bg-[#1e1e2e]/40'
                        : 'border-l-2 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white font-mono">
                        {session.id.slice(0, 8)}&hellip;
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#1e1e2e] text-gray-400">
                        {session.messageCount} msgs
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 mb-2">
                      {session.providers.map((provider) => (
                        <span
                          key={provider}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${providerColors[provider.toLowerCase()] ?? 'bg-[#1e1e2e] text-gray-400'}`}
                        >
                          {provider}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>${session.totalCost.toFixed(4)}</span>
                      <span>{relativeTime(session.lastActive)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-gray-500 text-sm mb-1">No sessions yet</p>
                <p className="text-gray-600 text-xs">Send a dispatch to start one.</p>
              </div>
            )}
          </div>
        </div>

        {/* Session Detail (2/3) */}
        <div className="lg:col-span-2">
          <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] min-h-[400px]">
            {detailLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : selectedSession ? (
              <div className="flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-[#1e1e2e] flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white font-mono">{selectedSession.id}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Used: {(selectedSession.models ?? selectedSession.providers ?? []).join(', ')}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {selectedSession.totalTokens?.toLocaleString() ?? 0} tokens &middot; ${selectedSession.totalCost.toFixed(4)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteSession(selectedSession.id)}
                    className="px-3 py-1.5 text-xs font-medium text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
                  >
                    Delete
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[600px]">
                  {selectedSession.messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          msg.role === 'user'
                            ? 'ml-12 bg-amber-500/10 border border-amber-500/20'
                            : 'mr-12 bg-[#1e1e2e] border border-[#2a2a3a]'
                        }`}
                      >
                        <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {msg.provider && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${providerColors[msg.provider.toLowerCase()] ?? 'bg-[#0a0a0f] text-gray-500'}`}>
                              {msg.provider}{msg.model ? ` / ${msg.model}` : ''}
                            </span>
                          )}
                          {msg.tokens != null && (
                            <span className="text-[10px] text-gray-600">{msg.tokens} tok</span>
                          )}
                          {msg.cost != null && (
                            <span className="text-[10px] text-gray-600">${msg.cost.toFixed(6)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-20">
                <p className="text-gray-500 text-sm">Select a session to view conversation history</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
