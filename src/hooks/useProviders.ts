'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { providers as mockProviders } from '@/lib/mock-data';
import type { ProviderConfig } from '@/lib/types';

interface ProvidersData {
  providers: ProviderConfig[];
  loading: boolean;
  error: string | null;
}

export function useProviders(): ProvidersData {
  const { isDemo, isAuthenticated } = useAuth();
  const [data, setData] = useState<ProvidersData>({
    providers: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!isAuthenticated) return;

    // Demo mode: use mock data
    if (isDemo) {
      setData({ providers: mockProviders, loading: false, error: null });
      return;
    }

    // Real user: fetch from API
    let cancelled = false;

    async function fetchProviders() {
      try {
        const [providersRes, spendRes] = await Promise.all([
          fetch('/api/providers'),
          fetch('/api/spend?period=month'),
        ]);

        if (cancelled) return;

        if (!providersRes.ok) {
          setData(prev => ({ ...prev, loading: false, error: 'Failed to load providers' }));
          return;
        }

        const providersData = await providersRes.json() as Record<string, unknown>[];
        const spendData = spendRes.ok ? await spendRes.json() : { byProvider: {}, budgets: [] };

        const providerConfigs: ProviderConfig[] = providersData.map((conn: Record<string, unknown>) => {
          const providerKey = (conn.provider as string || '').toLowerCase();
          const providerSpend = (spendData.byProvider as Record<string, { spend: number }>)?.[conn.provider as string];
          const budget = (spendData.budgets as { provider: string; limit: number }[] || []).find(
            (b: { provider: string; limit: number }) => b.provider === conn.provider
          );

          // Inherit visual config from mock data if provider matches
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
            dailySpend: mockProvider?.dailySpend || [],
            topUpUrl: mockProvider?.topUpUrl || '#',
            partnerUrl: mockProvider?.partnerUrl || '#',
            models: mockProvider?.models || [],
            cloudAlternatives: mockProvider?.cloudAlternatives || [],
          };
        });

        setData({ providers: providerConfigs, loading: false, error: null });
      } catch {
        if (!cancelled) {
          setData(prev => ({ ...prev, loading: false, error: 'Failed to load providers' }));
        }
      }
    }

    fetchProviders();
    return () => { cancelled = true; };
  }, [isDemo, isAuthenticated]);

  return data;
}
