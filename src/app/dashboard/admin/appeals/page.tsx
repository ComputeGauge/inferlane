'use client';

import { useEffect, useState } from 'react';

interface AppealRow {
  id: string;
  disputeCaseId: string;
  appellantRole: string;
  status: string;
  overturned: boolean | null;
  panelSize: number;
  createdAt: string;
  decidedAt: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: 'bg-amber-900/40 text-amber-300 border-amber-800',
    UNDER_PANEL_REVIEW: 'bg-indigo-900/40 text-indigo-300 border-indigo-800',
    OVERTURNED: 'bg-red-900/40 text-red-300 border-red-800',
    UPHELD: 'bg-emerald-900/40 text-emerald-300 border-emerald-800',
    WITHDRAWN: 'bg-slate-900/40 text-slate-300 border-slate-800',
  };
  const cls = colors[status] ?? 'bg-gray-900/40 text-gray-300 border-gray-800';
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium border ${cls}`}>
      {status}
    </span>
  );
}

export default function AppealsQueuePage() {
  const [rows, setRows] = useState<AppealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/appeals?limit=200');
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        const data = await res.json();
        if (!cancelled) setRows(data.appeals ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const pending = rows.filter((r) => r.status === 'PENDING');
  const underReview = rows.filter((r) => r.status === 'UNDER_PANEL_REVIEW');
  const done = rows.filter((r) => r.status === 'OVERTURNED' || r.status === 'UPHELD' || r.status === 'WITHDRAWN');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">Appeals queue</h1>
        <p className="text-sm text-gray-500 mt-1">
          {pending.length} awaiting panel assignment · {underReview.length} under panel review · {done.length} decided
        </p>
      </div>

      {loading && <div className="text-sm text-gray-500">Loading...</div>}
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <Section title="Awaiting panel assignment" rows={pending} emptyText="No appeals awaiting assignment." />
          <Section title="Under panel review" rows={underReview} emptyText="No appeals currently under review." />
          <Section title="Decided" rows={done} emptyText="No decided appeals yet." />
        </>
      )}
    </div>
  );
}

function Section({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: AppealRow[];
  emptyText: string;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-3">{title}</h2>
      {rows.length === 0 ? (
        <div className="rounded-lg border border-[#1e1e2e] bg-[#12121a] p-6 text-sm text-gray-500">
          {emptyText}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#1e1e2e]">
          <table className="w-full text-sm">
            <thead className="bg-[#0a0a12] text-gray-500 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Appeal id</th>
                <th className="px-4 py-3 text-left">Dispute</th>
                <th className="px-4 py-3 text-left">Appellant</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Panel</th>
                <th className="px-4 py-3 text-left">Filed</th>
                <th className="px-4 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[#1e1e2e] hover:bg-[#0a0a12]/50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{r.id}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{r.disputeCaseId}</td>
                  <td className="px-4 py-3 text-gray-300">{r.appellantRole}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-gray-300">{r.panelSize || '—'}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/dashboard/admin/appeals/${r.id}`}
                      className="text-indigo-400 hover:text-indigo-300 text-xs font-medium"
                    >
                      Open →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
