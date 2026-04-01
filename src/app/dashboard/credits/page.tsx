'use client';

import { useState, useEffect } from 'react';
import CreditBalanceCard from '@/components/credits/CreditBalanceCard';
import PoolDelegation from '@/components/credits/PoolDelegation';
import MarketplaceOffers from '@/components/credits/MarketplaceOffers';
import TransactionHistory from '@/components/credits/TransactionHistory';

interface CreditSummary {
  available: number;
  delegatedToPool: number;
  earned: number;
  totalAllocated: number;
  periodEnd: string;
}

function StatCard({
  label,
  value,
  subtext,
  accentClass,
}: {
  label: string;
  value: string;
  subtext?: string;
  accentClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-4 md:p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">
        {label}
      </p>
      <p
        className={`text-xl md:text-2xl font-bold ${
          accentClass || 'text-white'
        }`}
      >
        {value}
      </p>
      {subtext && (
        <p className="text-xs text-gray-600 mt-1">{subtext}</p>
      )}
    </div>
  );
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function CreditsPage() {
  const [summary, setSummary] = useState<CreditSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSummary() {
      try {
        const res = await fetch('/api/credits/balance');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setSummary(data);
      } catch {
        // CreditBalanceCard handles its own error state
      } finally {
        setLoading(false);
      }
    }
    fetchSummary();
  }, []);

  const fmt = (n: number) =>
    `$${n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="space-y-6 md:space-y-8">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            Credits &amp; Billing
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your compute credits &mdash; delegate, trade, and track
            your history.
          </p>
        </div>

        <a
          href="/api/stripe/checkout"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold text-sm hover:brightness-110 transition-all shrink-0 self-start sm:self-auto"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Buy Credits
        </a>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Summary stat cards                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-5 animate-pulse h-24"
              />
            ))}
          </>
        ) : summary ? (
          <>
            <StatCard
              label="Available Credits"
              value={fmt(summary.available)}
              subtext={
                summary.periodEnd
                  ? `Resets in ${daysUntil(summary.periodEnd)} days`
                  : undefined
              }
              accentClass="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent"
            />
            <StatCard
              label="Delegated to Pool"
              value={fmt(summary.delegatedToPool)}
              subtext="Earning passive income"
            />
            <StatCard
              label="Earned This Month"
              value={fmt(summary.earned)}
              subtext="From pool + marketplace"
              accentClass="text-green-400"
            />
          </>
        ) : (
          <div className="col-span-full rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-5">
            <p className="text-gray-600 text-sm text-center">
              Unable to load credit summary.
            </p>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Credit Balance (full width)                                        */}
      {/* ------------------------------------------------------------------ */}
      <CreditBalanceCard />

      {/* ------------------------------------------------------------------ */}
      {/* Pool + Marketplace (side by side on desktop)                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PoolDelegation />
        <MarketplaceOffers />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Transaction History (full width)                                   */}
      {/* ------------------------------------------------------------------ */}
      <TransactionHistory />
    </div>
  );
}
