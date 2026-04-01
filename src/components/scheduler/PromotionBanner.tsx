'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Promotion {
  id: string;
  provider: string;
  title: string;
  multiplier: number;
  startsAt: string;
  endsAt: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Expired';
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h remaining`;
  }
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

function getDismissedKey(id: string): string {
  return `promo_dismissed_${id}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PromotionBanner() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(Date.now());

  // Load dismissed state from localStorage
  useEffect(() => {
    const dismissedSet = new Set<string>();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('promo_dismissed_')) {
          const id = key.replace('promo_dismissed_', '');
          dismissedSet.add(id);
        }
      }
    } catch {
      // localStorage may not be available
    }
    setDismissed(dismissedSet);
  }, []);

  // Fetch active promotions
  useEffect(() => {
    let cancelled = false;

    async function fetchPromotions() {
      try {
        const res = await fetch('/api/promotions');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.promotions)) {
          setPromotions(
            data.promotions.filter(
              (p: Promotion) => p.status === 'ACTIVE' && p.multiplier > 1,
            ),
          );
        }
      } catch {
        // Silently fail — banner is non-critical
      }
    }

    fetchPromotions();
    return () => {
      cancelled = true;
    };
  }, []);

  // Countdown tick
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleDismiss = useCallback((id: string) => {
    try {
      localStorage.setItem(getDismissedKey(id), '1');
    } catch {
      // localStorage may not be available
    }
    setDismissed((prev) => new Set(prev).add(id));
  }, []);

  // Filter out dismissed promotions
  const visible = promotions.filter((p) => !dismissed.has(p.id));
  if (visible.length === 0) return null;

  const promo = visible[0]; // Show the top promotion
  const remaining = new Date(promo.endsAt).getTime() - now;
  if (remaining <= 0) return null;

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/20 px-4 py-3 mb-6">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/5 blur-xl" />

      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* Lightning icon */}
          <div className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>

          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              <span className="text-amber-400">{promo.provider}</span>{' '}
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {promo.multiplier}x
              </span>{' '}
              usage active
            </p>
            <p className="text-xs text-gray-400 truncate">
              {promo.title} &mdash; {formatCountdown(remaining)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/dashboard/scheduler"
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 transition-all whitespace-nowrap"
          >
            Queue prompts &rarr;
          </Link>
          <button
            onClick={() => handleDismiss(promo.id)}
            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Dismiss promotion banner"
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
