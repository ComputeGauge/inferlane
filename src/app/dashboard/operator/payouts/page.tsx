'use client';

import { useEffect, useState } from 'react';

interface PayoutRow {
  id: string;
  amount: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  processedAt: string | null;
  stripeTransferId: string | null;
}

interface PayoutSummary {
  isOperator: boolean;
  message?: string;
  operatorId?: string;
  payoutEnabled?: boolean;
  hasStripeAccount?: boolean;
  pendingUsdCents?: string;
  minimumPayoutUsdCents?: string;
  nextCycleAt?: string;
  payouts?: PayoutRow[];
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: 'bg-amber-900/40 text-amber-300 border-amber-800',
    PROCESSING: 'bg-indigo-900/40 text-indigo-300 border-indigo-800',
    COMPLETED: 'bg-emerald-900/40 text-emerald-300 border-emerald-800',
    FAILED: 'bg-red-900/40 text-red-300 border-red-800',
  };
  const cls = colors[status] ?? 'bg-gray-900/40 text-gray-300 border-gray-800';
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium border ${cls}`}>
      {status}
    </span>
  );
}

function formatCents(cents: string | bigint | number | undefined): string {
  if (cents == null) return '$0.00';
  const n = Number(cents);
  if (!Number.isFinite(n)) return '—';
  return (n / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default function OperatorPayoutsPage() {
  const [data, setData] = useState<PayoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/operator/payouts');
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="text-sm text-gray-500">Loading payouts...</div>;
  if (error) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-300">
        {error}
      </div>
    );
  }
  if (!data?.isOperator) {
    return (
      <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-10 text-center space-y-3">
        <p className="text-gray-400">You are not a registered operator.</p>
        <a
          href="/dashboard/operator/onboarding/kyc"
          className="inline-block rounded-lg bg-white text-black px-4 py-2 text-sm font-semibold"
        >
          Start operator onboarding
        </a>
      </div>
    );
  }

  const pending = data.pendingUsdCents ?? '0';
  const minimum = data.minimumPayoutUsdCents ?? '5000';
  const eligible = BigInt(pending) >= BigInt(minimum);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">Payouts</h1>
        <p className="text-sm text-gray-500 mt-1">
          Pending balance, next cycle, and recent history.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-5">
          <p className="text-xs uppercase text-gray-500 mb-1">Pending</p>
          <p className="text-2xl font-bold text-emerald-400">{formatCents(pending)}</p>
          <p className="text-xs text-gray-500 mt-1">
            Released after the 168h dispute window
          </p>
        </div>
        <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-5">
          <p className="text-xs uppercase text-gray-500 mb-1">Minimum payout</p>
          <p className="text-2xl font-bold text-white">{formatCents(minimum)}</p>
          <p className="text-xs text-gray-500 mt-1">Balance rolls over below this</p>
        </div>
        <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-5">
          <p className="text-xs uppercase text-gray-500 mb-1">Next cycle</p>
          <p className="text-lg font-semibold text-white">
            {data.nextCycleAt ? new Date(data.nextCycleAt).toLocaleString() : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Weekly on Monday 18:30 UTC</p>
        </div>
      </div>

      {!data.hasStripeAccount && (
        <div className="rounded-lg border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-300">
          You haven&apos;t connected a Stripe payout account yet. Connect one to
          receive payouts.{' '}
          <a
            href="/api/nodes/stripe-onboard"
            className="underline hover:text-amber-200"
          >
            Connect Stripe →
          </a>
        </div>
      )}

      {data.hasStripeAccount && !eligible && (
        <div className="rounded-lg border border-[#1e1e2e] bg-[#12121a] p-4 text-sm text-gray-400">
          Pending balance is below the minimum payout amount. The next cycle
          will skip and the balance rolls forward.
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Recent payouts</h2>
        {!data.payouts?.length ? (
          <div className="rounded-lg border border-[#1e1e2e] bg-[#12121a] p-6 text-sm text-gray-500">
            No payouts yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#1e1e2e]">
            <table className="w-full text-sm">
              <thead className="bg-[#0a0a12] text-gray-500 uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Created</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Period</th>
                  <th className="px-4 py-3 text-left">Stripe ref</th>
                </tr>
              </thead>
              <tbody>
                {data.payouts.map((p) => (
                  <tr key={p.id} className="border-t border-[#1e1e2e]">
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(p.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-200">
                      ${Number(p.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(p.periodStart).toLocaleDateString()} →{' '}
                      {new Date(p.periodEnd).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {p.stripeTransferId ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
