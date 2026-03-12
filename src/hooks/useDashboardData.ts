'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  providers as mockProviders,
  spendHistory as mockSpendHistory,
  alerts as mockAlerts,
  getTotalSpend as mockGetTotalSpend,
  getTotalBudget as mockGetTotalBudget,
  getProjectedMonthlySpend as mockGetProjectedMonthlySpend,
} from '@/lib/mock-data';
import type { ProviderConfig, SpendSnapshot, Alert } from '@/lib/types';

interface DashboardData {
  providers: ProviderConfig[];
  spendHistory: SpendSnapshot[];
  alerts: Alert[];
  totalSpend: number;
  totalBudget: number;
  projectedMonthly: number;
  loading: boolean;
  error: string | null;
}

export function useDashboardData(): DashboardData {
  const { isDemo, isAuthenticated } = useAuth();
  const [data, setData] = useState<DashboardData>({
    providers: [],
    spendHistory: [],
    alerts: [],
    totalSpend: 0,
    totalBudget: 0,
    projectedMonthly: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!isAuthenticated) return;

    // Demo mode: use mock data immediately
    if (isDemo) {
      setData({
        providers: mockProviders,
        spendHistory: mockSpendHistory,
        alerts: mockAlerts,
        totalSpend: mockGetTotalSpend(),
        totalBudget: mockGetTotalBudget(),
        projectedMonthly: mockGetProjectedMonthlySpend(),
        loading: false,
        error: null,
      });
      return;
    }

    // Real user: fetch from API
    let cancelled = false;

    async function fetchData() {
      try {
        const [spendRes, alertsRes, providersRes] = await Promise.all([
          fetch('/api/spend?period=month'),
          fetch('/api/alerts'),
          fetch('/api/providers'),
        ]);

        if (cancelled) return;

        if (!spendRes.ok || !alertsRes.ok || !providersRes.ok) {
          setData(prev => ({ ...prev, loading: false, error: 'Failed to load dashboard data' }));
          return;
        }

        const [spendData, alertsData, providersData] = await Promise.all([
          spendRes.json(),
          alertsRes.json(),
          providersRes.json(),
        ]);

        // Map API provider connections to ProviderConfig format
        const providerConfigs: ProviderConfig[] = (providersData as Record<string, unknown>[]).map((conn: Record<string, unknown>) => {
          const providerKey = (conn.provider as string || '').toLowerCase();
          const providerSpend = (spendData.byProvider as Record<string, { spend: number; tokens: number; requests: number }>)?.[conn.provider as string];
          const budget = (spendData.budgets as { provider: string; limit: number }[] || []).find(
            (b: { provider: string; limit: number }) => b.provider === conn.provider
          );

          // Use defaults from mock-data for visual config if available
          const mockProvider = mockProviders.find(p => p.id === providerKey);

          return {
            id: providerKey || (conn.id as string),
            name: (conn.displayName as string) || (conn.provider as string) || 'Unknown',
            icon: mockProvider?.icon || '/provider.svg',
            color: mockProvider?.color || '#6b7280',
            gradientFrom: mockProvider?.gradientFrom || '#6b7280',
            gradientTo: mockProvider?.gradientTo || '#4b5563',
            apiKeyEnvVar: '',
            monthlyBudget: budget?.limit || 100,
            currentSpend: providerSpend?.spend || 0,
            dailySpend: [],
            topUpUrl: mockProvider?.topUpUrl || '#',
            partnerUrl: mockProvider?.partnerUrl || '#',
            models: [],
            cloudAlternatives: mockProvider?.cloudAlternatives || [],
          };
        });

        // Map daily trend to SpendSnapshot format
        const spendHistory: SpendSnapshot[] = ((spendData.dailyTrend || []) as { date: string; total: number }[]).map((day: { date: string; total: number }) => ({
          date: day.date,
          anthropic: 0,
          openai: 0,
          google: 0,
          other: 0,
          total: day.total || 0,
        }));

        // Map alerts to client Alert format
        const alerts: Alert[] = (alertsData as Record<string, unknown>[]).map((a: Record<string, unknown>) => ({
          id: a.id as string,
          providerId: (a.provider as string || '').toLowerCase(),
          providerName: a.provider as string || 'Unknown',
          type: ((a.type as string) === 'BUDGET_WARNING' ? 'warning' : (a.type as string) === 'SPEND_CRITICAL' ? 'critical' : 'info') as Alert['type'],
          message: a.message as string || '',
          threshold: a.threshold as number || 0,
          triggered: a.isActive as boolean ?? true,
          timestamp: new Date(a.createdAt as string),
        }));

        const totalSpend = spendData.totalSpend || 0;
        const totalBudget = providerConfigs.reduce((s, p) => s + p.monthlyBudget, 0);
        const today = new Date().getDate();
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        const projectedMonthly = today > 0 ? (totalSpend / today) * daysInMonth : 0;

        setData({
          providers: providerConfigs,
          spendHistory,
          alerts,
          totalSpend,
          totalBudget,
          projectedMonthly,
          loading: false,
          error: null,
        });
      } catch {
        if (!cancelled) {
          setData(prev => ({ ...prev, loading: false, error: 'Failed to load dashboard data' }));
        }
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [isDemo, isAuthenticated]);

  return data;
}
