'use client';

import { useState, useEffect, useCallback } from 'react';

interface PoolStatus {
  totalPoolSize: number;
  currentCycleRate: number;
  userEstimatedEarnings: number;
}

interface BalanceData {
  available: number;
  inPool: number;
}

export default function PoolDelegation() {
  const [poolStatus, setPoolStatus] = useState<PoolStatus | null>(null);
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [autoDelegate, setAutoDelegate] = useState(false);
  const [autoDelegatePct, setAutoDelegatePct] = useState(50);
  const [manualAmount, setManualAmount] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [poolRes, balanceRes] = await Promise.all([
        fetch('/api/credits/pool/status'),
        fetch('/api/credits/balance'),
      ]);
      if (!poolRes.ok || !balanceRes.ok) throw new Error('Failed to fetch pool data');
      const [poolJson, balanceJson] = await Promise.all([poolRes.json(), balanceRes.json()]);
      setPoolStatus(poolJson);
      setBalance(balanceJson);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pool data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function savePreferences() {
    setSaving(true);
    try {
      const res = await fetch('/api/credits/delegate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'configure', autoDelegate, autoDelegatePct }),
      });
      if (!res.ok) throw new Error('Failed to save preferences');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelegateAction(action: 'delegate' | 'recall') {
    const amount = parseInt(manualAmount, 10);
    if (!amount || amount <= 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/credits/delegate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, amount }),
      });
      if (!res.ok) throw new Error(`Failed to ${action}`);
      setManualAmount('');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${action} failed`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-6 flex items-center justify-center min-h-[300px]">
        <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !poolStatus) {
    return (
      <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-6">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-6 space-y-6">
      <h3 className="text-white font-semibold text-lg">Pool Delegation</h3>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {/* Pool stats */}
      {poolStatus && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] px-3 py-3 text-center">
            <p className="text-gray-500 text-xs mb-1">Pool Size</p>
            <p className="text-white font-semibold text-sm">{poolStatus.totalPoolSize.toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] px-3 py-3 text-center">
            <p className="text-gray-500 text-xs mb-1">Cycle Rate</p>
            <p className="text-white font-semibold text-sm">{(poolStatus.currentCycleRate * 100).toFixed(1)}%</p>
          </div>
          <div className="rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] px-3 py-3 text-center">
            <p className="text-gray-500 text-xs mb-1">Est. Earnings</p>
            <p className="text-white font-semibold text-sm">{poolStatus.userEstimatedEarnings.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Auto-delegate toggle */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">Auto-delegate to shared pool</span>
          <button
            onClick={() => setAutoDelegate(!autoDelegate)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              autoDelegate ? 'bg-amber-500' : 'bg-[#1e1e2e]'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                autoDelegate ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>

        {autoDelegate && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Percentage</span>
              <span className="text-white font-medium">{autoDelegatePct}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={10}
              value={autoDelegatePct}
              onChange={(e) => setAutoDelegatePct(parseInt(e.target.value, 10))}
              className="w-full accent-amber-500"
            />
          </div>
        )}

        <button
          onClick={savePreferences}
          disabled={saving}
          className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold text-sm disabled:opacity-50 transition-opacity"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>

      {/* Manual delegate/recall */}
      <div className="border-t border-[#1e1e2e] pt-4 space-y-3">
        <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Manual Delegation</p>
        {balance && (
          <p className="text-gray-500 text-xs">
            Available: {balance.available.toLocaleString()} | In Pool: {balance.inPool.toLocaleString()}
          </p>
        )}
        <input
          type="number"
          placeholder="Amount"
          value={manualAmount}
          onChange={(e) => setManualAmount(e.target.value)}
          className="w-full rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] px-4 py-2.5 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-amber-500/50"
        />
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleDelegateAction('delegate')}
            disabled={saving || !manualAmount}
            className="py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold text-sm disabled:opacity-50 transition-opacity"
          >
            Delegate Now
          </button>
          <button
            onClick={() => handleDelegateAction('recall')}
            disabled={saving || !manualAmount}
            className="py-2 rounded-xl border border-amber-500/30 text-amber-400 font-semibold text-sm hover:bg-amber-500/10 disabled:opacity-50 transition-all"
          >
            Recall
          </button>
        </div>
      </div>
    </div>
  );
}
