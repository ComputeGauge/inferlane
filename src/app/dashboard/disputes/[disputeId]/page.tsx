'use client';

import { useEffect, useState, use } from 'react';

// /dashboard/disputes/:id — detail view of a single dispute.
//
// Shows the dispute header, full evidence list, resolution (if any),
// and context-aware actions depending on the caller's role:
//   - Buyer:    add evidence, withdraw, file appeal (if resolved)
//   - Operator: add evidence, file appeal (if resolved)
//   - Reviewer: resolve the dispute (with step-up)
//
// The "resolve" action flow is deliberately minimal here — a real
// reviewer UI lives at /dashboard/admin/disputes/:id/resolve with
// a dedicated form. This page is the shared read-mostly view.

interface Evidence {
  id: string;
  kind: string;
  submittedBy: string;
  submittedAt: string;
  contentHash: string;
  contentUrl: string | null;
}

interface DisputeDetail {
  id: string;
  status: string;
  reason: string;
  description: string;
  amountUsdCents: string;
  openedAt: string;
  evidence: Evidence[];
  resolution: null | {
    decidedBy: string;
    decidedAt: string;
    outcome: 'BUYER' | 'OPERATOR' | 'SPLIT';
    refundCents: string;
    reasoning: string;
    drawdownFromReserve: boolean;
  };
}

export default function DisputeDetailPage({
  params,
}: {
  params: Promise<{ disputeId: string }>;
}) {
  const { disputeId } = use(params);
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/disputes/${disputeId}`);
        if (!res.ok) {
          if (res.status === 404) setError('Dispute not found');
          else throw new Error(`Failed: ${res.status}`);
          return;
        }
        const data = await res.json();
        if (!cancelled) setDispute(data.dispute);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [disputeId]);

  if (loading) return <div className="text-sm text-gray-500">Loading dispute...</div>;
  if (error) return (
    <div className="rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-300">
      {error}
    </div>
  );
  if (!dispute) return null;

  const amountDollars = (Number(dispute.amountUsdCents) / 100).toFixed(2);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl md:text-3xl font-bold text-white">Dispute</h1>
          <span className="font-mono text-xs text-gray-500">{dispute.id}</span>
        </div>
        <p className="text-sm text-gray-500">
          Opened {new Date(dispute.openedAt).toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-5">
          <p className="text-xs uppercase text-gray-500 mb-1">Status</p>
          <p className="text-xl font-semibold text-white">{dispute.status}</p>
        </div>
        <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-5">
          <p className="text-xs uppercase text-gray-500 mb-1">Amount at stake</p>
          <p className="text-xl font-semibold text-white">${amountDollars}</p>
        </div>
        <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-5">
          <p className="text-xs uppercase text-gray-500 mb-1">Reason</p>
          <p className="text-xl font-semibold text-white">{dispute.reason}</p>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-white mb-3">Buyer statement</h2>
        <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-5 text-gray-300 whitespace-pre-wrap">
          {dispute.description}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white mb-3">
          Evidence ({dispute.evidence.length})
        </h2>
        {dispute.evidence.length === 0 ? (
          <div className="rounded-lg border border-[#1e1e2e] bg-[#12121a] p-6 text-sm text-gray-500">
            No evidence attached yet.
          </div>
        ) : (
          <div className="space-y-2">
            {dispute.evidence.map((e) => (
              <div
                key={e.id}
                className="rounded-lg border border-[#1e1e2e] bg-[#12121a] p-4 flex items-start justify-between gap-4"
              >
                <div>
                  <p className="text-sm text-white font-medium">{e.kind}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Submitted by {e.submittedBy.slice(0, 12)}... · {new Date(e.submittedAt).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 font-mono">
                    hash: {e.contentHash.slice(0, 16)}...
                  </p>
                </div>
                {e.contentUrl && (
                  <a
                    href={e.contentUrl}
                    className="text-xs text-indigo-400 hover:text-indigo-300"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    View
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {dispute.resolution && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">Resolution</h2>
          <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase text-gray-500">Outcome</span>
              <span className="text-sm text-white font-semibold">{dispute.resolution.outcome}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase text-gray-500">Refund</span>
              <span className="text-sm text-white">
                ${(Number(dispute.resolution.refundCents) / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase text-gray-500">Decided</span>
              <span className="text-sm text-gray-300">
                {new Date(dispute.resolution.decidedAt).toLocaleString()}
              </span>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500 mb-1">Reasoning</p>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">
                {dispute.resolution.reasoning}
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
