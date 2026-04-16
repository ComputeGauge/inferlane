'use client';

import { useEffect, useState } from 'react';

// Dashboard — Buyer Wallet surface.
//
// Commercial build, Phase F1.4 UI. Shows the buyer's wallet balance
// (pulled from the ledger projection at /api/wallet/balance),
// deposit history, and a call-to-action to top up.
//
// This page is read-only until the /api/wallet/* API surface lands.
// Until then it displays an empty state with clear instructions.
// The UI scaffold is in place so the backend work can light it up
// without touching React.

interface WalletBalance {
  availableUsdCents: string;     // BigInt serialised as string
  reservedUsdCents: string;
  totalUsdCents: string;
  lastUpdatedAt: string;
}

function formatUsdFromCentsString(cents: string): string {
  try {
    const n = Number(cents);
    if (!Number.isFinite(n)) return '—';
    return (n / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
  } catch {
    return '—';
  }
}

function StatCard({
  label,
  value,
  subtext,
  accent,
}: {
  label: string;
  value: string;
  subtext?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-4 md:p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">
        {label}
      </p>
      <p className={`text-xl md:text-2xl font-bold ${accent ?? 'text-white'}`}>
        {value}
      </p>
      {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
    </div>
  );
}

const TOPUP_PRESETS = [25, 100, 500, 2500];

export default function WalletPage() {
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState<number>(100);
  const [topupSubmitting, setTopupSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/wallet/balance');
        if (!res.ok) {
          // Endpoint not yet implemented — show empty state rather
          // than a scary error.
          if (res.status === 404) {
            setBalance(null);
            return;
          }
          throw new Error(`Failed to load wallet: ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) setBalance(data.balance ?? null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Wallet</h1>
          <p className="text-sm text-gray-500 mt-1">
            Prepaid compute credits. Deposit once, we route every request.
          </p>
        </div>
        <button
          onClick={() => setTopupOpen((o) => !o)}
          className="rounded-lg bg-white text-black px-4 py-2 text-sm font-semibold hover:opacity-90"
        >
          {topupOpen ? 'Cancel' : 'Top up wallet'}
        </button>
      </div>

      {topupOpen && (
        <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Top up your wallet</h2>
            <p className="text-sm text-gray-500">
              Pick an amount. You&apos;ll be redirected to Stripe Checkout to
              complete payment. Balance appears after the payment confirms
              (usually within 10 seconds).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {TOPUP_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setTopupAmount(preset)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  topupAmount === preset
                    ? 'border-white bg-white text-black'
                    : 'border-[#1e1e2e] bg-[#0a0a12] text-gray-300 hover:border-[#2e2e3e]'
                }`}
              >
                ${preset}
              </button>
            ))}
            <input
              type="number"
              min={5}
              max={500_000}
              value={topupAmount}
              onChange={(e) => setTopupAmount(Math.max(5, parseInt(e.target.value) || 5))}
              className="rounded-lg border border-[#1e1e2e] bg-[#0a0a12] px-4 py-2 text-sm text-white w-32"
              placeholder="Custom"
            />
          </div>
          <button
            type="button"
            disabled={topupSubmitting || topupAmount < 5}
            onClick={async () => {
              setTopupSubmitting(true);
              setError(null);
              try {
                const res = await fetch('/api/wallet/topup', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ amountCents: topupAmount * 100 }),
                });
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  throw new Error(data.error ?? `Failed: ${res.status}`);
                }
                const data = await res.json();
                if (data.url) window.location.href = data.url;
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
              } finally {
                setTopupSubmitting(false);
              }
            }}
            className="rounded-lg bg-white text-black px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {topupSubmitting ? 'Redirecting...' : `Pay $${topupAmount.toLocaleString()}`}
          </button>
          <p className="text-xs text-gray-500">
            Refundable per our{' '}
            <a href="/legal/refund-policy" className="underline hover:text-gray-300">
              Refund Policy
            </a>
            .
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Available"
          value={balance ? formatUsdFromCentsString(balance.availableUsdCents) : '$0.00'}
          subtext="Ready to spend"
          accent="text-emerald-400"
        />
        <StatCard
          label="Reserved"
          value={balance ? formatUsdFromCentsString(balance.reservedUsdCents) : '$0.00'}
          subtext="Held in workload escrow"
          accent="text-amber-400"
        />
        <StatCard
          label="Total"
          value={balance ? formatUsdFromCentsString(balance.totalUsdCents) : '$0.00'}
          subtext="Available + reserved"
        />
      </div>

      <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-6">
        <h2 className="text-lg font-semibold text-white mb-2">About your wallet</h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          Your wallet holds prepaid balance for all InferLane routing. We quote
          the rack-rate price at dispatch and debit it on completion. Uncommitted
          balance sits in FDIC-insured partner accounts until you use it — so
          you never pay a routing fee. (See{' '}
          <a
            href="/transparency"
            className="underline text-indigo-400 hover:text-indigo-300"
          >
            transparency
          </a>{' '}
          for the full economics.)
        </p>
      </div>

      {loading && (
        <div className="text-sm text-gray-500">Loading wallet balance...</div>
      )}
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-300">
          {error}
        </div>
      )}
      {!loading && !error && !balance && (
        <div className="rounded-lg border border-[#1e1e2e] bg-[#0a0a12] p-6 text-sm text-gray-500">
          Wallet projection endpoint not yet available in this build.
          Deposit flow ships in Phase F1.4.
        </div>
      )}
    </div>
  );
}
