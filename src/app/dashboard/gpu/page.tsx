'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface GpuClusterSummary {
  id: string;
  name: string;
  gpuCount: number;
  gpuModel: string | null;
  totalVramGb: number | null;
  location: string | null;
  isOnline: boolean;
  lastHeartbeat: string | null;
  avgUtilization: number | null;
  costPerToken: number | null;
  createdAt: string;
}

interface RegisterForm {
  name: string;
  gpuCount: number;
  gpuModel: string;
  totalVramGb: number | string;
  electricityCostPerKwh: number | string;
  hardwareCostUsd: number | string;
  amortizationMonths: number;
  location: string;
}

const defaultForm: RegisterForm = {
  name: '',
  gpuCount: 1,
  gpuModel: '',
  totalVramGb: '',
  electricityCostPerKwh: '',
  hardwareCostUsd: '',
  amortizationMonths: 36,
  location: '',
};

export default function GpuDashboardPage() {
  const { user } = useAuth();
  const [clusters, setClusters] = useState<GpuClusterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [form, setForm] = useState<RegisterForm>({ ...defaultForm });
  const [submitting, setSubmitting] = useState(false);
  const [newAgentToken, setNewAgentToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchClusters = useCallback(async () => {
    try {
      const res = await fetch('/api/gpu/clusters');
      if (res.ok) {
        setClusters(await res.json());
      }
    } catch {
      // silently fail for demo/unauth
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, any> = {
        name: form.name,
        gpuCount: form.gpuCount,
      };
      if (form.gpuModel) payload.gpuModel = form.gpuModel;
      if (form.totalVramGb !== '') payload.totalVramGb = Number(form.totalVramGb);
      if (form.electricityCostPerKwh !== '') payload.electricityCostPerKwh = Number(form.electricityCostPerKwh);
      if (form.hardwareCostUsd !== '') payload.hardwareCostUsd = Number(form.hardwareCostUsd);
      if (form.amortizationMonths) payload.amortizationMonths = form.amortizationMonths;
      if (form.location) payload.location = form.location;

      const res = await fetch('/api/gpu/clusters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to register cluster');
        return;
      }

      const data = await res.json();
      setNewAgentToken(data.agentToken);
      setForm({ ...defaultForm });
      await fetchClusters();
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">GPU Clusters</h1>
          <p className="text-gray-400 text-sm mt-1">
            Monitor your self-hosted GPU infrastructure
          </p>
        </div>
        <button
          onClick={() => {
            setShowRegister(!showRegister);
            setNewAgentToken(null);
            setError(null);
          }}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition-colors"
        >
          {showRegister ? 'Cancel' : '+ Register Cluster'}
        </button>
      </div>

      {/* Register Form */}
      {showRegister && (
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Register New Cluster</h2>

          {/* Agent token display after creation */}
          {newAgentToken && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-green-400 font-medium mb-2">Cluster registered successfully!</p>
              <p className="text-gray-400 text-sm mb-2">
                Copy this agent token for your Docker agent configuration.
                It will not be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-[#0a0a0f] rounded text-amber-400 text-xs font-mono break-all">
                  {newAgentToken}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(newAgentToken)}
                  className="px-3 py-2 bg-[#1e1e2e] hover:bg-[#2a2a3e] text-gray-300 rounded-lg text-sm transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Cluster Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="e.g. inference-prod-01"
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">GPU Count *</label>
              <input
                type="number"
                value={form.gpuCount}
                onChange={(e) => setForm({ ...form, gpuCount: parseInt(e.target.value) || 1 })}
                required
                min={1}
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">GPU Model</label>
              <input
                type="text"
                value={form.gpuModel}
                onChange={(e) => setForm({ ...form, gpuModel: e.target.value })}
                placeholder="e.g. NVIDIA A100 80GB"
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Total VRAM (GB)</label>
              <input
                type="number"
                value={form.totalVramGb}
                onChange={(e) => setForm({ ...form, totalVramGb: e.target.value })}
                placeholder="e.g. 640"
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Electricity Cost ($/kWh)</label>
              <input
                type="number"
                step="0.0001"
                value={form.electricityCostPerKwh}
                onChange={(e) => setForm({ ...form, electricityCostPerKwh: e.target.value })}
                placeholder="e.g. 0.12"
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Hardware Cost (USD)</label>
              <input
                type="number"
                step="0.01"
                value={form.hardwareCostUsd}
                onChange={(e) => setForm({ ...form, hardwareCostUsd: e.target.value })}
                placeholder="e.g. 120000"
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Amortization (months)</label>
              <input
                type="number"
                value={form.amortizationMonths}
                onChange={(e) => setForm({ ...form, amortizationMonths: parseInt(e.target.value) || 36 })}
                min={1}
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. us-east-1 / on-prem NYC"
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting || !form.name}
                className="px-6 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-medium rounded-lg transition-colors"
              >
                {submitting ? 'Registering...' : 'Register Cluster'}
              </button>
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>
          </form>
        </div>
      )}

      {/* Cluster Cards */}
      {clusters.length === 0 ? (
        <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#1e1e2e] flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </div>
          <h3 className="text-white font-medium mb-1">No GPU clusters registered</h3>
          <p className="text-gray-500 text-sm">
            Register your first cluster to start monitoring GPU utilization and costs.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clusters.map((cluster) => (
            <Link
              key={cluster.id}
              href={`/dashboard/gpu/${cluster.id}`}
              className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] hover:border-amber-500/30 p-5 transition-colors group"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-white font-semibold truncate group-hover:text-amber-400 transition-colors">
                    {cluster.name}
                  </h3>
                  <p className="text-gray-500 text-sm mt-0.5">
                    {cluster.gpuModel || `${cluster.gpuCount} GPU${cluster.gpuCount > 1 ? 's' : ''}`}
                  </p>
                </div>
                <span
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                    cluster.isOnline
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-gray-500/10 text-gray-500'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      cluster.isOnline ? 'bg-green-400' : 'bg-gray-500'
                    }`}
                  />
                  {cluster.isOnline ? 'Online' : 'Offline'}
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-gray-500 text-xs">GPUs</p>
                  <p className="text-white font-medium">{cluster.gpuCount}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Utilization</p>
                  <p className="text-white font-medium">
                    {cluster.avgUtilization !== null
                      ? `${cluster.avgUtilization.toFixed(1)}%`
                      : '--'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Cost/Token</p>
                  <p className="text-white font-medium">
                    {cluster.costPerToken !== null
                      ? `$${cluster.costPerToken.toFixed(6)}`
                      : '--'}
                  </p>
                </div>
              </div>

              {/* Location footer */}
              {cluster.location && (
                <div className="mt-3 pt-3 border-t border-[#1e1e2e]">
                  <p className="text-gray-600 text-xs truncate">{cluster.location}</p>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
