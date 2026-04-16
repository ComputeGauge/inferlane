'use client';

import { useEffect, useState, use } from 'react';

interface AppealDetail {
  id: string;
  disputeCaseId: string;
  appellantRole: string;
  statement: string;
  newEvidenceUrls: string[];
  status: string;
  panelReviewers: string[];
  overturned: boolean | null;
  overrideRefundCents: string | null;
  decidedAt: string | null;
  decidedByUserId: string | null;
  reasoning: string | null;
  createdAt: string;
}

interface DisputeSummary {
  id: string;
  reason: string;
  status: string;
  amountUsdCents: string;
  originalOutcome: string | null;
  originalRefundCents: string | null;
  originalReasoning: string | null;
}

const STEP_UP_STORAGE_KEY = 'il_stepup_dispute_resolve';

export default function AppealDetailPage({
  params,
}: {
  params: Promise<{ appealId: string }>;
}) {
  const { appealId } = use(params);
  const [appeal, setAppeal] = useState<AppealDetail | null>(null);
  const [dispute, setDispute] = useState<DisputeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewerInput, setReviewerInput] = useState('');
  const [decideOverturn, setDecideOverturn] = useState(false);
  const [overrideUsd, setOverrideUsd] = useState('');
  const [decideReasoning, setDecideReasoning] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/appeals/${appealId}`);
        if (!res.ok) {
          setError(res.status === 404 ? 'Not found' : `Failed: ${res.status}`);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setAppeal(data.appeal);
        setDispute(data.dispute);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [appealId]);

  async function getStepUpToken(): Promise<string | null> {
    const cached = sessionStorage.getItem(STEP_UP_STORAGE_KEY);
    if (cached) return cached;
    try {
      const res = await fetch('/api/auth/step-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'dispute.resolve' }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.token) {
        sessionStorage.setItem(STEP_UP_STORAGE_KEY, data.token);
        return data.token;
      }
      return null;
    } catch {
      return null;
    }
  }

  async function assignPanel() {
    setSubmitting(true);
    setError(null);
    try {
      const ids = reviewerInput.split(',').map((s) => s.trim()).filter(Boolean);
      if (ids.length === 0) {
        setError('Enter at least one reviewer user id');
        setSubmitting(false);
        return;
      }
      const token = await getStepUpToken();
      const res = await fetch(`/api/appeals/${appealId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-Step-Up-Token': token } : {}),
        },
        body: JSON.stringify({ candidateReviewerIds: ids }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Failed: ${res.status}`);
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  async function decide() {
    setSubmitting(true);
    setError(null);
    try {
      if (decideReasoning.length < 20) {
        setError('Reasoning must be at least 20 characters');
        setSubmitting(false);
        return;
      }
      const token = await getStepUpToken();
      const body: Record<string, unknown> = {
        overturn: decideOverturn,
        reasoning: decideReasoning,
      };
      if (decideOverturn && overrideUsd) {
        body.overrideRefundCents = String(Math.round(parseFloat(overrideUsd) * 100));
      }
      const res = await fetch(`/api/appeals/${appealId}/decide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-Step-Up-Token': token } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Failed: ${res.status}`);
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="text-sm text-gray-500">Loading...</div>;
  if (error && !appeal) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-300">
        {error}
      </div>
    );
  }
  if (!appeal) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl md:text-3xl font-bold text-white">Appeal</h1>
          <span className="font-mono text-xs text-gray-500">{appeal.id}</span>
        </div>
        <p className="text-sm text-gray-500">
          Filed {new Date(appeal.createdAt).toLocaleString()} by {appeal.appellantRole}
        </p>
      </div>

      {dispute && (
        <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-5">
          <p className="text-xs uppercase text-gray-500 mb-1">Original dispute</p>
          <p className="font-mono text-sm text-white">{dispute.id}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
            <div>
              <p className="text-xs text-gray-500">Reason</p>
              <p className="text-sm text-white">{dispute.reason}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Amount</p>
              <p className="text-sm text-white">
                ${(Number(dispute.amountUsdCents) / 100).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Original outcome</p>
              <p className="text-sm text-white">{dispute.originalOutcome ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Original refund</p>
              <p className="text-sm text-white">
                {dispute.originalRefundCents
                  ? `$${(Number(dispute.originalRefundCents) / 100).toFixed(2)}`
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-5">
        <p className="text-xs uppercase text-gray-500 mb-2">Appellant statement</p>
        <p className="text-sm text-gray-300 whitespace-pre-wrap">{appeal.statement}</p>
      </div>

      {appeal.newEvidenceUrls.length > 0 && (
        <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-5">
          <p className="text-xs uppercase text-gray-500 mb-2">New evidence</p>
          <ul className="text-sm text-indigo-400 space-y-1">
            {appeal.newEvidenceUrls.map((u, i) => (
              <li key={i}>
                <a href={u} className="underline hover:text-indigo-300" rel="noopener">
                  Evidence {i + 1}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-5">
        <p className="text-xs uppercase text-gray-500 mb-2">Panel</p>
        {appeal.panelReviewers.length === 0 ? (
          <p className="text-sm text-gray-400">No panel assigned yet.</p>
        ) : (
          <ul className="text-sm text-gray-300 space-y-1">
            {appeal.panelReviewers.map((id) => (
              <li key={id} className="font-mono text-xs">{id}</li>
            ))}
          </ul>
        )}
      </div>

      {appeal.status === 'PENDING' && (
        <section className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">Assign panel</h2>
          <p className="text-xs text-gray-500">
            Paste candidate reviewer user ids separated by commas. Disputes ≥
            $10,000 require 3 reviewers; smaller disputes require 2. The original
            decider is automatically excluded.
          </p>
          <input
            type="text"
            value={reviewerInput}
            onChange={(e) => setReviewerInput(e.target.value)}
            placeholder="user_id_1, user_id_2, user_id_3"
            className="w-full px-4 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white"
          />
          <button
            type="button"
            disabled={submitting}
            onClick={assignPanel}
            className="rounded-lg bg-white text-black px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Assign panel
          </button>
        </section>
      )}

      {appeal.status === 'UNDER_PANEL_REVIEW' && (
        <section className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">Decide</h2>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={decideOverturn}
              onChange={(e) => setDecideOverturn(e.target.checked)}
            />
            Overturn the original decision
          </label>
          {decideOverturn && (
            <div>
              <label className="text-xs text-gray-500 uppercase block mb-1">
                Override refund (USD, optional)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={overrideUsd}
                onChange={(e) => setOverrideUsd(e.target.value)}
                className="w-full px-4 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white"
                placeholder="0.00"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave blank to overturn without changing the refund amount.
              </p>
            </div>
          )}
          <div>
            <label className="text-xs text-gray-500 uppercase block mb-1">
              Reasoning (≥ 20 chars)
            </label>
            <textarea
              rows={4}
              value={decideReasoning}
              onChange={(e) => setDecideReasoning(e.target.value)}
              className="w-full px-4 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white"
            />
          </div>
          <button
            type="button"
            disabled={submitting || decideReasoning.length < 20}
            onClick={decide}
            className="rounded-lg bg-white text-black px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {decideOverturn ? 'Overturn' : 'Uphold'}
          </button>
        </section>
      )}

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
