'use client';

import { useEffect, useState } from 'react';

// /dashboard/admin/disputes — reviewer-only queue view.
//
// Shows every dispute in an actionable state (OPEN, EVIDENCE_REQUESTED,
// UNDER_REVIEW) with quick-action buttons. Clicking a row navigates
// to the detail page where the reviewer can request more evidence
// or issue a resolution (which requires step-up re-auth).

interface DisputeRow {
  id: string;
  reason: string;
  status: string;
  amountUsdCents: string;
  openedAt: string;
}

function PriorityBadge({ amountUsdCents }: { amountUsdCents: string }) {
  const n = Number(amountUsdCents);
  if (n >= 1_000_000) {
    return (
      <span className="inline-block rounded px-2 py-0.5 text-xs font-semibold bg-red-900/40 text-red-300 border border-red-800">
        HIGH VALUE
      </span>
    );
  }
  if (n >= 100_000) {
    return (
      <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-amber-900/40 text-amber-300 border border-amber-800">
        medium
      </span>
    );
  }
  return (
    <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-slate-900/40 text-slate-400 border border-slate-800">
      standard
    </span>
  );
}

export default function ReviewerDisputesPage() {
  const [rows, setRows] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/disputes?limit=200');
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        const data = await res.json();
        if (!cancelled) setRows(data.open ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Dispute queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            Reviewer-only view. {rows.length} active disputes across OPEN, EVIDENCE_REQUESTED, and UNDER_REVIEW.
          </p>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-500">Loading queue...</div>}

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-10 text-center">
          <p className="text-gray-400">The queue is empty. Nothing to review.</p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[#1e1e2e]">
          <table className="w-full text-sm">
            <thead className="bg-[#0a0a12] text-gray-500 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Priority</th>
                <th className="px-4 py-3 text-left">Id</th>
                <th className="px-4 py-3 text-left">Reason</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Age</th>
                <th className="px-4 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const ageMs = Date.now() - new Date(r.openedAt).getTime();
                const ageHours = Math.round(ageMs / (60 * 60 * 1000));
                return (
                  <tr key={r.id} className="border-t border-[#1e1e2e] hover:bg-[#0a0a12]/50">
                    <td className="px-4 py-3"><PriorityBadge amountUsdCents={r.amountUsdCents} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{r.id}</td>
                    <td className="px-4 py-3 text-gray-200">{r.reason}</td>
                    <td className="px-4 py-3 text-right text-gray-200">
                      ${(Number(r.amountUsdCents) / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{r.status}</td>
                    <td className="px-4 py-3 text-gray-400">{ageHours}h</td>
                    <td className="px-4 py-3">
                      <a
                        href={`/dashboard/admin/disputes/${r.id}`}
                        className="text-indigo-400 hover:text-indigo-300 text-xs font-medium"
                      >
                        Review →
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
