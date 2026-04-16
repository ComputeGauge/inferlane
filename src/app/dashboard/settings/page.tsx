'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTrack, EVENTS } from '@/hooks/useTrack';
import ReferralSection from '@/components/ReferralSection';
import ExitSurvey from '@/components/ExitSurvey';
import NotificationSettings from '@/components/NotificationSettings';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: Record<string, boolean>;
  lastUsedAt: string | null;
  isActive: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Reusable toggle component (iOS-style)
// ---------------------------------------------------------------------------

function Toggle({
  enabled,
  onToggle,
  label,
}: {
  enabled: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
        enabled ? 'bg-amber-500' : 'bg-[#1e1e2e]'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ${
          enabled ? 'translate-x-5' : 'translate-x-0.5'
        } mt-0.5`}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function SettingsSection({
  title,
  description,
  children,
  danger,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={`bg-[#12121a] rounded-2xl border p-4 md:p-6 ${
        danger
          ? 'border-red-500/30 ring-1 ring-red-500/10'
          : 'border-[#1e1e2e]'
      }`}
    >
      <h3
        className={`text-base md:text-lg font-semibold mb-1 ${
          danger ? 'text-red-400' : 'text-white'
        }`}
      >
        {title}
      </h3>
      {description && (
        <p className="text-xs md:text-sm text-gray-500 mb-4 md:mb-6">
          {description}
        </p>
      )}
      {!description && <div className="mb-4 md:mb-6" />}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connected Providers card
// ---------------------------------------------------------------------------

const KNOWN_PROVIDERS = [
  { key: 'ANTHROPIC', name: 'Anthropic', color: '#d4a27f' },
  { key: 'OPENAI', name: 'OpenAI', color: '#10a37f' },
  { key: 'GOOGLE', name: 'Google', color: '#4285f4' },
  { key: 'GROQ', name: 'Groq', color: '#f55036' },
  { key: 'TOGETHER', name: 'Together AI', color: '#6366f1' },
  { key: 'DEEPSEEK', name: 'DeepSeek', color: '#0ea5e9' },
  { key: 'FIREWORKS', name: 'Fireworks', color: '#ef4444' },
  { key: 'MISTRAL', name: 'Mistral', color: '#ff7000' },
];

function ConnectedProviders() {
  const [connected, setConnected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProviders() {
      try {
        const res = await fetch('/api/providers');
        if (res.ok) {
          const data = await res.json();
          // data is an array of { provider: string, ... } or similar
          const names = Array.isArray(data)
            ? data.map((p: { provider?: string; id?: string }) => p.provider || p.id || '')
            : [];
          setConnected(names.filter(Boolean));
        }
      } catch {
        // Silent — display empty state
      } finally {
        setLoading(false);
      }
    }
    fetchProviders();
  }, []);

  const count = connected.length;

  return (
    <SettingsSection
      title="Connected Providers"
      description={
        loading
          ? 'Loading providers...'
          : `${count} provider${count !== 1 ? 's' : ''} connected to your account.`
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="w-5 h-5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        </div>
      ) : count === 0 ? (
        <p className="text-sm text-gray-600 text-center py-4">
          No providers connected yet. Add API keys from the Providers page.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {connected.map((id) => {
            const known = KNOWN_PROVIDERS.find(
              (p) => p.key === id.toUpperCase()
            );
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1e1e2e] bg-[#0a0a0f] text-sm text-white"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: known?.color || '#6b7280',
                  }}
                />
                {known?.name || id}
              </span>
            );
          })}
        </div>
      )}
    </SettingsSection>
  );
}

// ---------------------------------------------------------------------------
// Quiet hours visual bar
// ---------------------------------------------------------------------------

function QuietHoursBar({
  start,
  end,
}: {
  start: number;
  end: number;
}) {
  // Render a 24-segment bar showing which hours are "quiet"
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const isQuiet = (h: number) => {
    if (start <= end) return h >= start && h < end;
    // wraps midnight
    return h >= start || h < end;
  };

  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex gap-px">
        {hours.map((h) => (
          <div
            key={h}
            className={`flex-1 h-3 first:rounded-l-md last:rounded-r-md transition-colors ${
              isQuiet(h)
                ? 'bg-amber-500/40'
                : 'bg-[#1e1e2e]'
            }`}
            title={`${h}:00 ${isQuiet(h) ? '(quiet)' : ''}`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-gray-600">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Settings Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { user } = useAuth();
  const track = useTrack();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showExitSurvey, setShowExitSurvey] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Routing & Triage preferences (local state -- UI-only for now)
  const [routingStrategy, setRoutingStrategy] = useState('auto');
  const [costSensitivity, setCostSensitivity] = useState('balanced');
  const [preferDecentralized, setPreferDecentralized] = useState(false);
  const [allowBatchDeferral, setAllowBatchDeferral] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState(0);
  const [quietHoursEnd, setQuietHoursEnd] = useState(6);

  useEffect(() => {
    fetchKeys();
  }, []);

  async function fetchKeys() {
    try {
      const res = await fetch('/api/api-keys');
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data);
      }
    } catch {
      // Demo mode or not authenticated
    }
  }

  async function createKey() {
    if (!newKeyName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewKeyValue(data.key);
        track(EVENTS.API_KEY_CREATED, { name: newKeyName });
        setNewKeyName('');
        fetchKeys();
      }
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }

  async function revokeKey(id: string) {
    try {
      await fetch('/api/api-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      fetchKeys();
    } catch {
      // handle error
    }
  }

  function copyKeyPrefix(keyPrefix: string, keyId: string) {
    navigator.clipboard.writeText(keyPrefix + '...');
    setCopiedKeyId(keyId);
    setTimeout(() => setCopiedKeyId(null), 1500);
  }

  const handleManageBilling = useCallback(async () => {
    track(EVENTS.CHECKOUT_START, { source: 'settings' });
    setBillingLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setBillingLoading(false);
    }
  }, [track]);

  const handleConfirmCancel = useCallback(
    async (reason: string, feedback: string) => {
      setCancelLoading(true);
      try {
        const feedbackMessage = feedback
          ? `[CANCELLATION] Reason: ${reason}. ${feedback}`
          : `[CANCELLATION] Reason: ${reason}.`;

        await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'other',
            message: feedbackMessage,
          }),
        });

        const res = await fetch('/api/stripe/portal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        }
      } catch {
        setCancelLoading(false);
      }
    },
    []
  );

  const isPaidPlan = user?.plan && user.plan !== 'free';

  return (
    <div className="space-y-6 md:space-y-8">
      {/* ================================================================ */}
      {/* Page header                                                      */}
      {/* ================================================================ */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">
          Settings
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your account, API keys, routing preferences, and billing.
        </p>
      </div>

      {/* ================================================================ */}
      {/* Account                                                          */}
      {/* ================================================================ */}
      <SettingsSection title="Account" description="Your profile and plan details.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">
              Name
            </label>
            <p className="text-sm text-white mt-1">
              {user?.name || 'Demo User'}
            </p>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">
              Email
            </label>
            <p className="text-sm text-white mt-1">
              {user?.email || 'demo@inferlane.dev'}
            </p>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">
              Plan
            </label>
            <p className="text-sm text-white mt-1 capitalize">
              {user?.plan || 'Free'}
            </p>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">
              Auth Provider
            </label>
            <p className="text-sm text-white mt-1 capitalize">
              {user?.provider || 'Demo'}
            </p>
          </div>
        </div>
      </SettingsSection>

      {/* ================================================================ */}
      {/* Subscription                                                     */}
      {/* ================================================================ */}
      <SettingsSection
        title="Subscription"
        description="Manage your billing and subscription preferences."
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-white capitalize">
              {user?.plan || 'Free'} Plan
            </p>
            <p className="text-xs text-gray-500">
              {isPaidPlan
                ? 'Your subscription is active'
                : 'You are on the free tier'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {isPaidPlan && (
            <button
              onClick={handleManageBilling}
              disabled={billingLoading}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold rounded-xl hover:brightness-110 transition-all disabled:opacity-50"
            >
              {billingLoading ? 'Redirecting...' : 'Manage Billing'}
            </button>
          )}
          {isPaidPlan && (
            <button
              onClick={() => setShowExitSurvey(true)}
              className="px-4 py-2 text-sm text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/10 transition-all"
            >
              Cancel Plan
            </button>
          )}
          {!isPaidPlan && (
            <p className="text-sm text-gray-500">
              Upgrade from the dashboard to unlock more features.
            </p>
          )}
        </div>
      </SettingsSection>

      {/* ================================================================ */}
      {/* Connected Providers                                              */}
      {/* ================================================================ */}
      <ConnectedProviders />

      {/* ================================================================ */}
      {/* API Keys                                                         */}
      {/* ================================================================ */}
      <SettingsSection
        title="API Keys"
        description="Manage your InferLane API keys for MCP server authentication."
      >
        {/* New key alert */}
        {newKeyValue && (
          <div className="mb-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
            <p className="text-sm text-green-400 font-medium mb-2">
              New API key created. Copy it now &mdash; it will not be
              shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs md:text-sm text-white bg-[#0a0a0f] px-3 py-2 rounded-lg font-mono break-all">
                {newKeyValue}
              </code>
              <button
                onClick={() =>
                  navigator.clipboard.writeText(newKeyValue)
                }
                className="px-3 py-2 bg-[#1e1e2e] text-gray-300 text-xs rounded-lg hover:bg-[#2a2a3a] transition-all shrink-0"
              >
                Copy
              </button>
            </div>
            <button
              onClick={() => setNewKeyValue(null)}
              className="mt-2 text-xs text-gray-500 hover:text-gray-300"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Create new key */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g. Production MCP)"
            className="flex-1 px-4 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
            onKeyDown={(e) => e.key === 'Enter' && createKey()}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
          />
          <button
            onClick={createKey}
            disabled={loading || !newKeyName.trim()}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold rounded-xl hover:brightness-110 transition-all disabled:opacity-50 shrink-0"
          >
            {loading ? 'Creating...' : 'Create Key'}
          </button>
        </div>

        {/* Keys list */}
        <div className="space-y-2">
          {apiKeys.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-8">
              No API keys yet. Create one to authenticate your MCP
              server.
            </p>
          ) : (
            apiKeys.map((key) => (
              <div
                key={key.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-[#1a1a2a]"
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                    <svg
                      className="w-4 h-4 text-amber-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">
                      {key.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500 font-mono">
                      <button
                        onClick={() =>
                          copyKeyPrefix(key.keyPrefix, key.id)
                        }
                        className="hover:text-amber-400 transition-colors"
                        title="Copy key prefix"
                      >
                        {copiedKeyId === key.id
                          ? 'Copied!'
                          : `${key.keyPrefix}...`}
                      </button>
                      <span className="text-gray-700">|</span>
                      <span>
                        Created{' '}
                        {new Date(
                          key.createdAt
                        ).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      {key.lastUsedAt && (
                        <>
                          <span className="text-gray-700">|</span>
                          <span>
                            Last used{' '}
                            {new Date(
                              key.lastUsedAt
                            ).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  {key.isActive ? (
                    <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-lg">
                      Active
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500 bg-gray-500/10 px-2 py-0.5 rounded-lg">
                      Revoked
                    </span>
                  )}
                  {key.isActive && (
                    <button
                      onClick={() => revokeKey(key.id)}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-all"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </SettingsSection>

      {/* ================================================================ */}
      {/* Notification Channels                                            */}
      {/* ================================================================ */}
      <NotificationSettings />

      {/* ================================================================ */}
      {/* Referral / Invite                                                */}
      {/* ================================================================ */}
      <ReferralSection
        userId={user?.id || 'demo'}
        userPlan={user?.plan || 'free'}
      />

      {/* ================================================================ */}
      {/* Routing & Triage Preferences                                     */}
      {/* ================================================================ */}
      <SettingsSection
        title="Routing & Triage Preferences"
        description="Control how InferLane routes, schedules, and prioritizes your AI workloads."
      >
        <div className="space-y-6">
          {/* Dropdowns row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1.5">
                Default Routing Strategy
              </label>
              <select
                value={routingStrategy}
                onChange={(e) => setRoutingStrategy(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50 appearance-none"
              >
                <option value="auto">Auto (recommended)</option>
                <option value="cheapest">Cheapest</option>
                <option value="fastest">Fastest</option>
                <option value="quality">Quality</option>
                <option value="decentralized_only">
                  Decentralized only
                </option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1.5">
                Cost Sensitivity
              </label>
              <select
                value={costSensitivity}
                onChange={(e) => setCostSensitivity(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50 appearance-none"
              >
                <option value="minimum">Minimum cost</option>
                <option value="balanced">Balanced</option>
                <option value="quality_first">Quality first</option>
              </select>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#1e1e2e]" />

          {/* Toggle rows */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl border border-[#1a1a2a]">
              <div className="mr-4">
                <p className="text-sm font-medium text-white">
                  Prefer decentralized
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Route to OpenClaw network nodes when available
                </p>
              </div>
              <Toggle
                enabled={preferDecentralized}
                onToggle={() =>
                  setPreferDecentralized(!preferDecentralized)
                }
                label="Toggle prefer decentralized"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-[#1a1a2a]">
              <div className="mr-4">
                <p className="text-sm font-medium text-white">
                  Allow batch deferral
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Allow InferLane to defer non-urgent work to cheaper
                  time windows
                </p>
              </div>
              <Toggle
                enabled={allowBatchDeferral}
                onToggle={() =>
                  setAllowBatchDeferral(!allowBatchDeferral)
                }
                label="Toggle allow batch deferral"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#1e1e2e]" />

          {/* Quiet hours */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1.5">
              Quiet Hours
            </label>
            <p className="text-xs text-gray-600 mb-3">
              Batch non-urgent prompts during these hours.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Start</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={quietHoursStart}
                  onChange={(e) =>
                    setQuietHoursStart(
                      Math.min(
                        23,
                        Math.max(0, parseInt(e.target.value) || 0)
                      )
                    )
                  }
                  className="w-16 px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white text-center focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <span className="text-gray-600">&ndash;</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">End</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={quietHoursEnd}
                  onChange={(e) =>
                    setQuietHoursEnd(
                      Math.min(
                        23,
                        Math.max(0, parseInt(e.target.value) || 0)
                      )
                    )
                  }
                  className="w-16 px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white text-center focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <span className="text-xs text-gray-500">(24h format)</span>
            </div>
            <QuietHoursBar start={quietHoursStart} end={quietHoursEnd} />
          </div>
        </div>
      </SettingsSection>

      {/* ================================================================ */}
      {/* Danger Zone                                                      */}
      {/* ================================================================ */}
      <SettingsSection
        title="Danger Zone"
        description="These actions are irreversible. Please be certain before proceeding."
        danger
      >
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 text-sm text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/10 transition-all">
            Delete All Data
          </button>
          <button className="px-4 py-2 text-sm text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/10 transition-all">
            Delete Account
          </button>
        </div>
      </SettingsSection>

      {/* Exit Survey Modal */}
      <ExitSurvey
        open={showExitSurvey}
        onClose={() => setShowExitSurvey(false)}
        onConfirmCancel={handleConfirmCancel}
        loading={cancelLoading}
      />
    </div>
  );
}
