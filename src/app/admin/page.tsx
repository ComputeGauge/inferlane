'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  Users, CreditCard, Activity, TrendingUp,
  Database, Shield, AlertTriangle, BarChart3
} from 'lucide-react';

interface AdminStats {
  totalUsers: number;
  activeSubscriptions: number;
  totalRevenue: number;
  monthlyActiveUsers: number;
  totalProxyRequests: number;
  totalAffiliateClicks: number;
  totalGpuClusters: number;
  recentSignups: Array<{
    id: string;
    email: string;
    createdAt: string;
    subscription: { tier: string } | null;
  }>;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchAdminStats();
    }
  }, [status]);

  const fetchAdminStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auth guard
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading admin dashboard...</div>
      </div>
    );
  }

  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes((session.user as Record<string, string>).role)) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400">You need admin privileges to view this page.</p>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers || 0, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Active Subs', value: stats?.activeSubscriptions || 0, icon: CreditCard, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Monthly Revenue', value: `$${(stats?.totalRevenue || 0).toLocaleString()}`, icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'MAU', value: stats?.monthlyActiveUsers || 0, icon: Activity, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Proxy Requests', value: (stats?.totalProxyRequests || 0).toLocaleString(), icon: Database, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: 'Affiliate Clicks', value: stats?.totalAffiliateClicks || 0, icon: BarChart3, color: 'text-pink-400', bg: 'bg-pink-500/10' },
    { label: 'GPU Clusters', value: stats?.totalGpuClusters || 0, icon: Activity, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'Alerts Active', value: 0, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="border-b border-[#1e1e2e] bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <a href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="font-bold text-white text-lg">ComputeGauge</span>
              </a>
              <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 text-xs font-mono">ADMIN</span>
            </div>
            <div className="text-sm text-gray-400">
              {session.user.email}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat) => (
            <div key={stat.label} className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <span className="text-sm text-gray-400">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold font-mono">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Recent Signups */}
        <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Signups</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-[#1e1e2e]">
                  <th className="pb-3 font-medium">Email</th>
                  <th className="pb-3 font-medium">Tier</th>
                  <th className="pb-3 font-medium">Signed Up</th>
                </tr>
              </thead>
              <tbody>
                {stats?.recentSignups?.length ? (
                  stats.recentSignups.map((user) => (
                    <tr key={user.id} className="border-b border-[#1e1e2e]/50">
                      <td className="py-3 text-white">{user.email}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                          user.subscription?.tier === 'FREE'
                            ? 'bg-gray-500/20 text-gray-400'
                            : user.subscription?.tier === 'PRO'
                            ? 'bg-blue-500/20 text-blue-400'
                            : user.subscription?.tier === 'HYBRID'
                            ? 'bg-purple-500/20 text-purple-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {user.subscription?.tier || 'FREE'}
                        </span>
                      </td>
                      <td className="py-3 text-gray-400">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-gray-500">
                      No users yet. They&apos;ll show up here once people start signing up.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Key Metrics Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-6">
            <h2 className="text-lg font-semibold mb-4">Acquisition Metrics</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Monthly Recurring Revenue (MRR)</span>
                <span className="font-mono text-green-400">$0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">AI Spend Through Platform (GMV)</span>
                <span className="font-mono text-blue-400">$0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Connected Provider Accounts</span>
                <span className="font-mono text-amber-400">0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">On-Prem GPU Agents Deployed</span>
                <span className="font-mono text-purple-400">0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">GitHub Stars</span>
                <span className="font-mono text-gray-400">—</span>
              </div>
            </div>
          </div>

          <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-6">
            <h2 className="text-lg font-semibold mb-4">Revenue Streams</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">SaaS Subscriptions</span>
                <span className="font-mono text-green-400">$0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Affiliate Commissions</span>
                <span className="font-mono text-blue-400">$0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Proxy Margin</span>
                <span className="font-mono text-amber-400">$0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">On-Prem Agent Licenses</span>
                <span className="font-mono text-purple-400">$0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">FinOps Savings Fees</span>
                <span className="font-mono text-pink-400">$0</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
