'use client';

import { useEffect, useState } from 'react';

// Dashboard — Attestation history.
//
// Commercial build, Phase 4 UI. Lists AttestationRecord rows for the
// operator's nodes, showing type, outcome, measurement prefix, and
// validity window. Gives operators a clear picture of whether their
// Confidential tier routing is enabled.

interface AttestationRow {
  id: string;
  nodeOperatorId: string | null;
  type: string;
  outcome: string;
  measurement: string | null;
  summary: string;
  validUntil: string | null;
  verifiedAt: string;
}

function outcomeColor(outcome: string): string {
  switch (outcome) {
    case 'VERIFIED':
      return 'text-emerald-400 border-emerald-800 bg-emerald-950/30';
    case 'STALE':
      return 'text-amber-400 border-amber-800 bg-amber-950/30';
    case 'UNSUPPORTED':
    case 'NONCE_MISMATCH':
      return 'text-orange-400 border-orange-800 bg-orange-950/30';
    case 'BAD_SIGNATURE':
    case 'POLICY_VIOLATION':
    case 'ERROR':
      return 'text-red-400 border-red-800 bg-red-950/30';
    default:
      return 'text-gray-400 border-gray-800 bg-gray-950/30';
  }
}

function measurementPrefix(m: string | null): string {
  if (!m) return '—';
  return m.slice(0, 16) + '…';
}

export default function AttestationPage() {
  const [rows, setRows] = useState<AttestationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/nodes/attestation?limit=50');
        if (!res.ok) {
          if (res.status === 404) {
            setNotReady(true);
            return;
          }
          throw new Error(`Failed: ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) setRows(data.records ?? []);
      } catch {
        if (!cancelled) setNotReady(true);
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
        <h1 className="text-2xl md:text-3xl font-bold text-white">Attestation</h1>
        <p className="text-sm text-gray-500 mt-1">
          TEE attestation history for your nodes. A fresh VERIFIED record
          is required to serve the Confidential privacy tier.
        </p>
      </div>

      {loading && <div className="text-sm text-gray-500">Loading...</div>}

      {!loading && notReady && (
        <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-6 text-sm text-gray-400">
          <p className="mb-2">No attestation records yet.</p>
          <p className="text-gray-500">
            Install the node daemon on your compute node (
            <code className="rounded bg-[#0a0a12] px-1 text-xs">
              npx @inferlane/node-daemon
            </code>
            ) — it will collect + submit attestations automatically when your
            hardware supports a Trusted Execution Environment.
          </p>
        </div>
      )}

      {!loading && !notReady && rows.length === 0 && (
        <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-6 text-sm text-gray-400">
          No attestation activity in the last 50 records.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[#1e1e2e]">
          <table className="w-full text-sm">
            <thead className="bg-[#0a0a12] text-gray-500 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Outcome</th>
                <th className="px-4 py-3 text-left">Measurement</th>
                <th className="px-4 py-3 text-left">Summary</th>
                <th className="px-4 py-3 text-left">Valid until</th>
                <th className="px-4 py-3 text-left">Verified at</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[#1e1e2e]">
                  <td className="px-4 py-3 text-gray-200">{r.type}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium border ${outcomeColor(r.outcome)}`}>
                      {r.outcome}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">
                    {measurementPrefix(r.measurement)}
                  </td>
                  <td className="px-4 py-3 text-gray-300 max-w-md truncate" title={r.summary}>
                    {r.summary}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {r.validUntil ? new Date(r.validUntil).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(r.verifiedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
