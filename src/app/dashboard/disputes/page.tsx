'use client';

import { useEffect, useState } from 'react';

// Dashboard — Disputes surface.
//
// Commercial build, Phase 5.3 UI. Shows:
//   - Open disputes (for buyer or operator depending on role)
//   - Resolved dispute history
//   - "Open a dispute" entry for a completed workload
//
// Backed by /api/disputes (list + create) which ships in Phase 5.3.
// Until the API lands, this page renders an empty state.

interface DisputeRow {
  id: string;
  reason: string;
  status: string;
  amountUsdCents: string;
  openedAt: string;
  resolvedAt: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    OPEN: 'bg-amber-900/40 text-amber-300 border-amber-800',
    EVIDENCE_REQUESTED: 'bg-blue-900/40 text-blue-300 border-blue-800',
    UNDER_REVIEW: 'bg-indigo-900/40 text-indigo-300 border-indigo-800',
    RESOLVED_BUYER: 'bg-emerald-900/40 text-emerald-300 border-emerald-800',
    RESOLVED_OPERATOR: 'bg-slate-900/40 text-slate-300 border-slate-800',
    RESOLVED_SPLIT: 'bg-teal-900/40 text-teal-300 border-teal-800',
    CANCELLED: 'bg-gray-900/40 text-gray-300 border-gray-800',
  };
  const cls = colors[status] ?? 'bg-gray-900/40 text-gray-300 border-gray-800';
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium border ${cls}`}>
      {status}
    </span>
  );
}

export default function DisputesPage() {
  const [open, setOpen] = useState<DisputeRow[]>([]);
  const [resolved, setResolved] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/disputes');
        if (!res.ok) {
          if (res.status === 404) return;
          throw new Error(`Failed to load disputes: ${res.status}`);
        }
        const data = await res.json();
        if (cancelled) return;
        setOpen(data.open ?? []);
        setResolved(data.resolved ?? []);
      } catch {
        /* silent — empty state handles it */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">Disputes</h1>
        <p className="text-sm text-gray-500 mt-1">
          Contest a workload you believe was defective, incomplete, or ran outside
          its declared privacy tier. Disputes must be opened within 168 hours of
          workload completion.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Open</h2>
        {loading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : open.length === 0 ? (
          <div className="rounded-lg border border-[#1e1e2e] bg-[#12121a] p-6 text-sm text-gray-500">
            No open disputes. Click any completed workload to open one.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#1e1e2e]">
            <table className="w-full text-sm">
              <thead className="bg-[#0a0a12] text-gray-500 uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Id</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Opened</th>
                </tr>
              </thead>
              <tbody>
                {open.map((d) => (
                  <tr key={d.id} className="border-t border-[#1e1e2e]">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{d.id}</td>
                    <td className="px-4 py-3 text-gray-200">{d.reason}</td>
                    <td className="px-4 py-3 text-right text-gray-200">
                      ${(Number(d.amountUsdCents) / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(d.openedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Resolved</h2>
        {loading ? null : resolved.length === 0 ? (
          <div className="rounded-lg border border-[#1e1e2e] bg-[#12121a] p-6 text-sm text-gray-500">
            No resolved disputes yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#1e1e2e]">
            <table className="w-full text-sm">
              <thead className="bg-[#0a0a12] text-gray-500 uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Id</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Outcome</th>
                  <th className="px-4 py-3 text-left">Resolved</th>
                </tr>
              </thead>
              <tbody>
                {resolved.map((d) => (
                  <tr key={d.id} className="border-t border-[#1e1e2e]">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{d.id}</td>
                    <td className="px-4 py-3 text-gray-200">{d.reason}</td>
                    <td className="px-4 py-3 text-right text-gray-200">
                      ${(Number(d.amountUsdCents) / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                    <td className="px-4 py-3 text-gray-400">
                      {d.resolvedAt ? new Date(d.resolvedAt).toLocaleString() : '—'}
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
