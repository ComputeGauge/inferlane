'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface GpuSnapshot {
  gpuIndex: number;
  utilization: number;
  memoryUsedGb: number | null;
  memoryTotalGb: number | null;
  powerDrawWatts: number | null;
  temperatureC: number | null;
  inferenceCount: number | null;
  costPerToken: number | null;
  timestamp: string;
}

interface TcoSummary {
  monthlyElectricityCost: number;
  monthlyAmortizedHardware: number;
  monthlyTotal: number;
  totalPowerWatts: number;
}

interface ClusterDetail {
  id: string;
  name: string;
  gpuCount: number;
  gpuModel: string | null;
  totalVramGb: number | null;
  location: string | null;
  isOnline: boolean;
  lastHeartbeat: string | null;
  agentToken: string;
  electricityCostPerKwh: number;
  hardwareCostUsd: number;
  amortizationMonths: number;
  createdAt: string;
  tco: TcoSummary;
  totalInferences24h: number;
  gpus: GpuSnapshot[];
}

function maskToken(token: string): string {
  if (token.length <= 8) return token;
  return token.slice(0, 4) + '*'.repeat(token.length - 8) + token.slice(-4);
}

function UtilizationGauge({ value }: { value: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color =
    value > 90 ? '#ef4444' : value > 70 ? '#f59e0b' : value > 40 ? '#22c55e' : '#6b7280';

  return (
    <div className="relative w-24 h-24 mx-auto">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r={radius}
          stroke="#1e1e2e"
          strokeWidth="6"
          fill="none"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          stroke={color}
          strokeWidth="6"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-white text-sm font-bold">{value.toFixed(0)}%</span>
      </div>
    </div>
  );
}

function MemoryBar({ used, total }: { used: number | null; total: number | null }) {
  if (used === null || total === null || total === 0) {
    return <div className="text-gray-600 text-xs">N/A</div>;
  }
  const pct = Math.min((used / total) * 100, 100);
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{used.toFixed(1)} GB</span>
        <span>{total.toFixed(1)} GB</span>
      </div>
      <div className="w-full h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#22c55e',
          }}
        />
      </div>
    </div>
  );
}

export default function ClusterDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const clusterId = params.clusterId as string;

  const [cluster, setCluster] = useState<ClusterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenRevealed, setTokenRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchCluster = useCallback(async () => {
    try {
      const res = await fetch(`/api/gpu/clusters/${clusterId}`);
      if (res.ok) {
        setCluster(await res.json());
      } else if (res.status === 404) {
        router.push('/dashboard/gpu');
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [clusterId, router]);

  useEffect(() => {
    fetchCluster();
    // Auto-refresh every 30s
    const interval = setInterval(fetchCluster, 30_000);
    return () => clearInterval(interval);
  }, [fetchCluster]);

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this cluster? All metrics data will be lost.')) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/gpu/clusters/${clusterId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/dashboard/gpu');
      }
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  }

  function handleCopyToken() {
    if (cluster) {
      navigator.clipboard.writeText(cluster.agentToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!cluster) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Cluster not found.</p>
        <Link href="/dashboard/gpu" className="text-amber-400 hover:underline mt-2 inline-block">
          Back to clusters
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div>
        <Link href="/dashboard/gpu" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
          GPU Clusters
        </Link>
        <span className="text-gray-600 mx-2">/</span>
        <span className="text-gray-400 text-sm">{cluster.name}</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{cluster.name}</h1>
            <span
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                cluster.isOnline
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-gray-500/10 text-gray-500'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  cluster.isOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
                }`}
              />
              {cluster.isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            {cluster.gpuCount}x {cluster.gpuModel || 'GPU'}
            {cluster.location && ` \u00b7 ${cluster.location}`}
            {cluster.totalVramGb && ` \u00b7 ${cluster.totalVramGb} GB VRAM`}
          </p>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {deleting ? 'Deleting...' : 'Delete Cluster'}
        </button>
      </div>

      {/* Agent Token */}
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-5">
        <h2 className="text-sm font-medium text-gray-400 mb-3">Agent Token</h2>
        <div className="flex items-center gap-2">
          <code className="flex-1 p-2.5 bg-[#0a0a0f] rounded-lg text-amber-400 text-xs font-mono break-all">
            {tokenRevealed ? cluster.agentToken : maskToken(cluster.agentToken)}
          </code>
          <button
            onClick={() => setTokenRevealed(!tokenRevealed)}
            className="px-3 py-2 bg-[#1e1e2e] hover:bg-[#2a2a3e] text-gray-400 rounded-lg text-sm transition-colors"
          >
            {tokenRevealed ? 'Hide' : 'Reveal'}
          </button>
          <button
            onClick={handleCopyToken}
            className="px-3 py-2 bg-[#1e1e2e] hover:bg-[#2a2a3e] text-gray-400 rounded-lg text-sm transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="text-gray-600 text-xs mt-2">
          Use this token in your Docker agent&apos;s Authorization header: <code className="text-gray-500">Bearer {'<token>'}</code>
        </p>
      </div>

      {/* TCO Summary */}
      <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-5">
        <h2 className="text-sm font-medium text-gray-400 mb-4">Total Cost of Ownership</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-[#0a0a0f] rounded-lg">
            <p className="text-gray-500 text-xs mb-1">Electricity / month</p>
            <p className="text-white font-semibold text-lg">
              ${cluster.tco.monthlyElectricityCost.toFixed(2)}
            </p>
            <p className="text-gray-600 text-xs">{cluster.tco.totalPowerWatts.toFixed(0)}W draw</p>
          </div>
          <div className="p-3 bg-[#0a0a0f] rounded-lg">
            <p className="text-gray-500 text-xs mb-1">Hardware / month</p>
            <p className="text-white font-semibold text-lg">
              ${cluster.tco.monthlyAmortizedHardware.toFixed(2)}
            </p>
            <p className="text-gray-600 text-xs">
              ${cluster.hardwareCostUsd.toLocaleString()} over {cluster.amortizationMonths}mo
            </p>
          </div>
          <div className="p-3 bg-[#0a0a0f] rounded-lg">
            <p className="text-gray-500 text-xs mb-1">Total / month</p>
            <p className="text-amber-400 font-semibold text-lg">
              ${cluster.tco.monthlyTotal.toFixed(2)}
            </p>
          </div>
          <div className="p-3 bg-[#0a0a0f] rounded-lg">
            <p className="text-gray-500 text-xs mb-1">Inferences (24h)</p>
            <p className="text-white font-semibold text-lg">
              {cluster.totalInferences24h.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Per-GPU Cards */}
      <div>
        <h2 className="text-sm font-medium text-gray-400 mb-4">
          GPU Status ({cluster.gpus.length} reporting)
        </h2>
        {cluster.gpus.length === 0 ? (
          <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-8 text-center">
            <p className="text-gray-500">No metrics received yet. Deploy the Docker agent to start monitoring.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {cluster.gpus
              .sort((a, b) => a.gpuIndex - b.gpuIndex)
              .map((gpu) => (
                <div
                  key={gpu.gpuIndex}
                  className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-medium text-sm">GPU {gpu.gpuIndex}</h3>
                    {gpu.costPerToken !== null && (
                      <span className="text-amber-400 text-xs font-mono">
                        ${gpu.costPerToken.toFixed(6)}/tok
                      </span>
                    )}
                  </div>

                  {/* Utilization gauge */}
                  <UtilizationGauge value={gpu.utilization} />
                  <p className="text-center text-gray-500 text-xs mt-1 mb-4">Utilization</p>

                  {/* Memory bar */}
                  <div className="mb-3">
                    <p className="text-gray-500 text-xs mb-1">Memory</p>
                    <MemoryBar used={gpu.memoryUsedGb} total={gpu.memoryTotalGb} />
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#1e1e2e]">
                    <div>
                      <p className="text-gray-600 text-xs">Temperature</p>
                      <p
                        className={`text-sm font-medium ${
                          gpu.temperatureC !== null && gpu.temperatureC > 85
                            ? 'text-red-400'
                            : gpu.temperatureC !== null && gpu.temperatureC > 70
                            ? 'text-amber-400'
                            : 'text-white'
                        }`}
                      >
                        {gpu.temperatureC !== null ? `${gpu.temperatureC.toFixed(0)}\u00b0C` : '--'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-xs">Power</p>
                      <p className="text-white text-sm font-medium">
                        {gpu.powerDrawWatts !== null ? `${gpu.powerDrawWatts.toFixed(0)}W` : '--'}
                      </p>
                    </div>
                  </div>

                  {gpu.inferenceCount !== null && (
                    <div className="mt-2 pt-2 border-t border-[#1e1e2e]">
                      <p className="text-gray-600 text-xs">Inferences</p>
                      <p className="text-white text-sm font-medium">
                        {gpu.inferenceCount.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
