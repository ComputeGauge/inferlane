'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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
  anthropic:  'bg-amber-500/20 text-amber-400 border-amber-500/30',
  openai:     'bg-green-500/20 text-green-400 border-green-500/30',
  google:     'bg-blue-500/20 text-blue-400 border-blue-500/30',
  deepseek:   'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  xai:        'bg-purple-500/20 text-purple-400 border-purple-500/30',
  groq:       'bg-pink-500/20 text-pink-400 border-pink-500/30',
  cerebras:   'bg-orange-500/20 text-orange-400 border-orange-500/30',
  openclaw:   'bg-violet-500/20 text-violet-400 border-violet-500/30',
};

function getProviderPillClass(provider: string): string {
  return providerColors[provider.toLowerCase()] ?? 'bg-[#1e1e2e] text-gray-400 border-[#2a2a3a]';
}

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

function useRelativeTimeUpdater(sessions: SessionSummary[]) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (sessions.length === 0) return;
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, [sessions.length]);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150 px-2 py-1 text-[10px] font-medium text-gray-500 hover:text-gray-300 border border-[#2a2a3a] hover:border-[#3a3a4a] rounded-md bg-[#12121a]"
      title="Copy to clipboard"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useRelativeTimeUpdater(sessions);

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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (selectedSession?.messages) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedSession?.messages]);

  async function handleSelectSession(sessionId: string) {
    setSelectedId(sessionId);
    setDetailLoading(true);
    setMobileShowDetail(true);
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
        setMobileShowDetail(false);
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
    <div className="space-y-6 animate-fadeIn">
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

      {/* Mobile: session dropdown selector */}
      <div className="lg:hidden">
        {mobileShowDetail && selectedSession ? (
          <button
            onClick={() => setMobileShowDetail(false)}
            className="flex items-center gap-1.5 text-sm text-amber-400 mb-3 hover:text-amber-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back to sessions
          </button>
        ) : (
          <select
            value={selectedId ?? ''}
            onChange={(e) => {
              if (e.target.value) handleSelectSession(e.target.value);
            }}
            className="w-full bg-[#12121a] border border-[#1e1e2e] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500/50 mb-4"
          >
            <option value="">Select a session...</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id.slice(0, 8)}... - {s.messageCount} msgs - ${s.totalCost.toFixed(4)}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Session List (1/3) — hidden on mobile when detail is shown */}
        <div className={`lg:col-span-1 ${mobileShowDetail ? 'hidden lg:block' : ''}`}>
          <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] overflow-hidden">
            <div className="p-4 border-b border-[#1e1e2e]">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Sessions ({sessions.length})
              </h3>
            </div>
            {sessions.length > 0 ? (
              <div className="divide-y divide-[#1e1e2e] max-h-[700px] overflow-y-auto">
                {sessions.map((session) => {
                  const isActive = selectedId === session.id;
                  return (
                    <div
                      key={session.id}
                      onClick={() => handleSelectSession(session.id)}
                      className={`p-4 cursor-pointer transition-all duration-200 ${
                        isActive
                          ? 'border-l-2 border-l-amber-500 bg-amber-500/5 shadow-[inset_0_0_20px_rgba(245,158,11,0.03)]'
                          : 'border-l-2 border-l-transparent hover:bg-[#1e1e2e]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-mono ${isActive ? 'text-amber-400' : 'text-white'}`}>
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
                            className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${getProviderPillClass(provider)}`}
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
                  );
                })}
              </div>
            ) : (
              <div className="p-10 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#1e1e2e] flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                  </svg>
                </div>
                <p className="text-gray-400 text-sm font-medium mb-1">No sessions yet</p>
                <p className="text-gray-600 text-xs">Send a dispatch to start one.</p>
              </div>
            )}
          </div>
        </div>

        {/* Session Detail (2/3) */}
        <div className={`lg:col-span-2 ${!mobileShowDetail && selectedId ? 'hidden lg:block' : ''}`}>
          <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] min-h-[400px]">
            {detailLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : selectedSession ? (
              <div className="flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-[#1e1e2e] flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-sm font-semibold text-white font-mono truncate">{selectedSession.id}</h3>
                      <span className="flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                        ${selectedSession.totalCost.toFixed(4)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Models: {(selectedSession.models ?? selectedSession.providers ?? []).join(', ') || 'None'}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {selectedSession.totalTokens?.toLocaleString() ?? 0} tokens &middot; {selectedSession.messages.length} messages
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteSession(selectedSession.id)}
                    className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
                  >
                    Delete
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[600px] smooth-scroll">
                  {selectedSession.messages.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                      <p className="text-gray-500 text-sm">No messages in this session.</p>
                    </div>
                  ) : (
                    selectedSession.messages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group/msg`}
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
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${getProviderPillClass(msg.provider)}`}>
                                {msg.provider}{msg.model ? ` / ${msg.model}` : ''}
                              </span>
                            )}
                            {msg.tokens != null && (
                              <span className="text-[10px] text-gray-600">{msg.tokens} tok</span>
                            )}
                            {msg.cost != null && (
                              <span className="text-[10px] text-gray-600">${msg.cost.toFixed(6)}</span>
                            )}
                            {msg.role === 'assistant' && (
                              <CopyButton text={msg.content} />
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 px-6">
                <div className="w-16 h-16 mb-4 rounded-2xl bg-[#1e1e2e] flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                </div>
                <p className="text-gray-400 text-sm font-medium mb-1">No session selected</p>
                <p className="text-gray-600 text-xs text-center">
                  Select a session from the list to view its conversation history.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
