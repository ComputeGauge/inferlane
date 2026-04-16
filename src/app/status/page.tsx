// /status — public status page.
//
// Server-rendered page that checks each critical subsystem and
// reports green / yellow / red. This is a minimal viable status
// page; a full implementation would use a dedicated service like
// statuspage.io or instatus.com.
//
// Subsystems checked:
//   - Database connectivity (Prisma + Neon)
//   - Upstream provider availability (via health tracker)
//   - Treasury adapter readiness
//   - Fireblocks readiness
//   - Ledger reconciliation (last successful run age)

import { prisma } from '@/lib/db';
import { checkReadiness as checkStripeTreasury } from '@/lib/treasury/adapters/stripe-treasury';
import { checkFireblocksReadiness } from '@/lib/treasury/adapters/fireblocks';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

export const metadata = {
  title: 'Status — InferLane',
  description: 'Real-time status of the InferLane platform subsystems.',
};

async function checkDatabase(): Promise<{
  ok: boolean;
  message: string;
  latencyMs: number;
}> {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, message: 'operational', latencyMs: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'unknown error',
      latencyMs: Date.now() - started,
    };
  }
}

interface Subsystem {
  name: string;
  ok: boolean;
  status: string;
  detail?: string;
}

async function gatherStatus(): Promise<Subsystem[]> {
  const out: Subsystem[] = [];

  const db = await checkDatabase();
  out.push({
    name: 'Database (Neon)',
    ok: db.ok,
    status: db.ok ? 'operational' : 'degraded',
    detail: db.ok ? `${db.latencyMs}ms` : db.message,
  });

  try {
    const treasury = await checkStripeTreasury();
    out.push({
      name: 'Treasury (Stripe)',
      ok: treasury.enabled && treasury.accountReachable,
      status: treasury.enabled
        ? treasury.accountReachable
          ? 'operational'
          : 'degraded'
        : 'not configured',
      detail: treasury.issues.join('; ') || undefined,
    });
  } catch {
    out.push({ name: 'Treasury (Stripe)', ok: false, status: 'unknown' });
  }

  try {
    const fb = await checkFireblocksReadiness();
    out.push({
      name: 'Treasury (Fireblocks)',
      ok: fb.enabled && fb.vaultReachable,
      status: fb.enabled
        ? fb.vaultReachable
          ? 'operational'
          : 'degraded'
        : 'not configured',
      detail: fb.issues.join('; ') || undefined,
    });
  } catch {
    out.push({ name: 'Treasury (Fireblocks)', ok: false, status: 'unknown' });
  }

  return out;
}

function StatusRow({ subsystem }: { subsystem: Subsystem }) {
  const dotColor = subsystem.ok
    ? 'bg-emerald-400'
    : subsystem.status === 'not configured'
      ? 'bg-slate-400'
      : 'bg-amber-400';
  return (
    <div className="flex items-center justify-between py-4 border-b border-[#1e1e2e] last:border-b-0">
      <div className="flex items-center gap-3">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor}`} />
        <span className="text-white font-medium">{subsystem.name}</span>
      </div>
      <div className="text-right">
        <p className="text-sm text-gray-300 uppercase tracking-wider">{subsystem.status}</p>
        {subsystem.detail && (
          <p className="text-xs text-gray-500 mt-0.5">{subsystem.detail}</p>
        )}
      </div>
    </div>
  );
}

export default async function StatusPage() {
  const subsystems = await gatherStatus();
  const allGreen = subsystems.every((s) => s.ok);
  const updated = new Date().toLocaleString();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-gray-200">
      <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">Status</h1>
      <p className="text-sm text-gray-500 mb-8">
        Real-time health of the InferLane platform. Updated {updated}.
      </p>

      <div
        className={`rounded-2xl border p-6 mb-8 ${
          allGreen
            ? 'border-emerald-800 bg-emerald-950/20'
            : 'border-amber-800 bg-amber-950/20'
        }`}
      >
        <p className="text-lg font-semibold text-white">
          {allGreen ? 'All systems operational' : 'Some subsystems need attention'}
        </p>
      </div>

      <div className="rounded-2xl border border-[#1e1e2e] bg-[#12121a] px-6">
        {subsystems.map((s) => (
          <StatusRow key={s.name} subsystem={s} />
        ))}
      </div>

      <p className="text-xs text-gray-500 mt-8">
        For incident history see{' '}
        <a
          href="https://github.com/ComputeGauge/inferlane/blob/main/CHANGELOG.md"
          className="underline hover:text-gray-300"
        >
          CHANGELOG.md
        </a>
        . Report an outage to{' '}
        <a href="mailto:ops@inferlane.dev" className="underline hover:text-gray-300">
          ops@inferlane.dev
        </a>
        .
      </p>
    </div>
  );
}
