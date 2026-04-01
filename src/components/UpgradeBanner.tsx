'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTrack, EVENTS } from '@/hooks/useTrack';

interface UpgradeBannerProps {
  providerCount: number;
  requestCount?: number;
}

const FREE_LIMITS = {
  providers: 2,
  requests: 1000,
};

export default function UpgradeBanner({ providerCount, requestCount = 0 }: UpgradeBannerProps) {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const track = useTrack();

  const handleUpgrade = useCallback(async () => {
    setUpgrading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: 'PRO' }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setUpgrading(false);
    }
  }, []);

  const atProviderLimit = providerCount >= FREE_LIMITS.providers;
  const nearRequestLimit = requestCount >= FREE_LIMITS.requests * 0.8;
  const shouldShow = !!user && user.plan === 'free' && !dismissed && (atProviderLimit || nearRequestLimit);

  useEffect(() => {
    if (shouldShow) {
      track(EVENTS.UPGRADE_BANNER_VIEW);
    }
  }, [shouldShow, track]);

  if (!shouldShow) return null;

  const message = atProviderLimit
    ? `You've connected ${providerCount}/${FREE_LIMITS.providers} providers. Upgrade to Pro for unlimited providers.`
    : `You've used ${requestCount.toLocaleString()}/${FREE_LIMITS.requests.toLocaleString()} requests this month. Upgrade for unlimited.`;

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-purple-500/10 via-amber-500/10 to-purple-500/10 rounded-2xl border border-purple-500/20 p-4">
      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-white font-medium">{message}</p>
            <p className="text-xs text-gray-400 mt-0.5">Pro plan: $9/mo — unlimited providers, alerts, and smart routing.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => { track(EVENTS.UPGRADE_BANNER_CLICK); handleUpgrade(); }}
            disabled={upgrading}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-amber-500 text-white text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-50"
          >
            {upgrading ? 'Redirecting...' : 'Upgrade to Pro'}
          </button>
          <button
            onClick={() => { track(EVENTS.UPGRADE_BANNER_DISMISS); setDismissed(true); }}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-[#1e1e2e] transition-all"
            aria-label="Dismiss upgrade banner"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
