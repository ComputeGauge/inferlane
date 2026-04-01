'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTrack, EVENTS } from '@/hooks/useTrack';
import ReferralSection from '@/components/ReferralSection';
import ExitSurvey from '@/components/ExitSurvey';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: Record<string, boolean>;
  lastUsedAt: string | null;
  isActive: boolean;
  createdAt: string;
}

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

  // Routing & Triage preferences (local state — UI-only for now)
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
      // Demo mode or not authenticated — use empty state
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

  const handleConfirmCancel = useCallback(async (reason: string, feedback: string) => {
    setCancelLoading(true);
    try {
      const feedbackMessage = feedback
        ? `[CANCELLATION] Reason: ${reason}. ${feedback}`
        : `[CANCELLATION] Reason: ${reason}.`;

      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'other', message: feedbackMessage }),
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
  }, []);

  const isPaidPlan = user?.plan && user.plan !== 'free';

  return (
    <div className="space-y-8">
      {/* Account Info */}
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Account</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">Name</label>
            <p className="text-sm text-white mt-1">{user?.name || 'Demo User'}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">Email</label>
            <p className="text-sm text-white mt-1">{user?.email || 'demo@inferlane.ai'}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">Plan</label>
            <p className="text-sm text-white mt-1 capitalize">{user?.plan || 'Free'}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">Auth Provider</label>
            <p className="text-sm text-white mt-1 capitalize">{user?.provider || 'Demo'}</p>
          </div>
        </div>
      </div>

      {/* Subscription */}
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
        <h3 className="text-lg font-semibold text-white mb-1">Subscription</h3>
        <p className="text-sm text-gray-500 mb-4">
          Manage your billing and subscription preferences.
        </p>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-white capitalize">{user?.plan || 'Free'} Plan</p>
            <p className="text-xs text-gray-500">
              {isPaidPlan ? 'Your subscription is active' : 'You are on the free tier'}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
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
      </div>

      {/* API Keys */}
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">API Keys</h3>
            <p className="text-sm text-gray-500 mt-1">
              Manage your InferLane API keys for MCP server authentication.
            </p>
          </div>
        </div>

        {/* New key created alert */}
        {newKeyValue && (
          <div className="mb-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
            <p className="text-sm text-green-400 font-medium mb-2">
              New API key created. Copy it now — it will not be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm text-white bg-[#0a0a0f] px-3 py-2 rounded-lg font-mono break-all">
                {newKeyValue}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(newKeyValue);
                }}
                className="px-3 py-2 bg-[#1e1e2e] text-gray-300 text-xs rounded-lg hover:bg-[#2a2a3a] transition-all"
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
        <div className="flex items-center gap-3 mb-6">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g. Production MCP)"
            className="flex-1 px-4 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
            onKeyDown={(e) => e.key === 'Enter' && createKey()}
          />
          <button
            onClick={createKey}
            disabled={loading || !newKeyName.trim()}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold rounded-xl hover:brightness-110 transition-all disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Key'}
          </button>
        </div>

        {/* Keys list */}
        <div className="space-y-2">
          {apiKeys.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-8">
              No API keys yet. Create one to authenticate your MCP server.
            </p>
          ) : (
            apiKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-3 rounded-xl border border-[#1a1a2a]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{key.name}</p>
                    <p className="text-xs text-gray-500 font-mono">
                      {key.keyPrefix}...
                      {key.lastUsedAt && (
                        <span className="ml-2">
                          Last used {new Date(key.lastUsedAt).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {key.isActive ? (
                    <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-lg">Active</span>
                  ) : (
                    <span className="text-xs text-gray-500 bg-gray-500/10 px-2 py-0.5 rounded-lg">Revoked</span>
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
      </div>

      {/* Referral / Invite */}
      <ReferralSection
        userId={user?.id || 'demo'}
        userPlan={user?.plan || 'free'}
      />

      {/* Routing & Triage Preferences */}
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
        <h3 className="text-lg font-semibold text-white mb-1">Routing &amp; Triage Preferences</h3>
        <p className="text-sm text-gray-500 mb-6">
          Control how InferLane routes, schedules, and prioritizes your AI workloads.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Default routing strategy */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1.5">Default Routing Strategy</label>
            <select
              value={routingStrategy}
              onChange={(e) => setRoutingStrategy(e.target.value)}
              className="w-full px-4 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50 appearance-none"
            >
              <option value="auto">Auto (recommended)</option>
              <option value="cheapest">Cheapest</option>
              <option value="fastest">Fastest</option>
              <option value="quality">Quality</option>
              <option value="decentralized_only">Decentralized only</option>
            </select>
          </div>

          {/* Cost sensitivity */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1.5">Cost Sensitivity</label>
            <select
              value={costSensitivity}
              onChange={(e) => setCostSensitivity(e.target.value)}
              className="w-full px-4 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50 appearance-none"
            >
              <option value="minimum">Minimum cost</option>
              <option value="balanced">Balanced</option>
              <option value="quality_first">Quality first</option>
            </select>
          </div>

          {/* Prefer decentralized */}
          <div className="flex items-center justify-between md:col-span-2 p-3 rounded-xl border border-[#1a1a2a]">
            <div>
              <p className="text-sm font-medium text-white">Prefer decentralized</p>
              <p className="text-xs text-gray-500 mt-0.5">Route to OpenClaw network nodes when available</p>
            </div>
            <button
              onClick={() => setPreferDecentralized(!preferDecentralized)}
              className={`relative w-11 h-6 rounded-full transition-colors ${preferDecentralized ? 'bg-amber-500' : 'bg-[#1e1e2e]'}`}
              aria-label="Toggle prefer decentralized"
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${preferDecentralized ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>

          {/* Allow batch deferral */}
          <div className="flex items-center justify-between md:col-span-2 p-3 rounded-xl border border-[#1a1a2a]">
            <div>
              <p className="text-sm font-medium text-white">Allow batch deferral</p>
              <p className="text-xs text-gray-500 mt-0.5">Allow InferLane to defer non-urgent work to cheaper time windows</p>
            </div>
            <button
              onClick={() => setAllowBatchDeferral(!allowBatchDeferral)}
              className={`relative w-11 h-6 rounded-full transition-colors ${allowBatchDeferral ? 'bg-amber-500' : 'bg-[#1e1e2e]'}`}
              aria-label="Toggle allow batch deferral"
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${allowBatchDeferral ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>

          {/* Quiet hours */}
          <div className="md:col-span-2">
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1.5">Quiet Hours</label>
            <p className="text-xs text-gray-600 mb-3">Batch non-urgent prompts during these hours</p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Start</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={quietHoursStart}
                  onChange={(e) => setQuietHoursStart(Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-16 px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white text-center focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <span className="text-gray-600">-</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">End</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={quietHoursEnd}
                  onChange={(e) => setQuietHoursEnd(Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-16 px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white text-center focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <span className="text-xs text-gray-500 ml-2">(24h format)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-[#12121a] rounded-2xl border border-red-500/20 p-6">
        <h3 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h3>
        <p className="text-sm text-gray-500 mb-4">
          These actions are irreversible. Please be certain before proceeding.
        </p>
        <div className="flex gap-3">
          <button className="px-4 py-2 text-sm text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/10 transition-all">
            Delete All Data
          </button>
          <button className="px-4 py-2 text-sm text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/10 transition-all">
            Delete Account
          </button>
        </div>
      </div>

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
