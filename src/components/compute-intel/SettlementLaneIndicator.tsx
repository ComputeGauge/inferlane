'use client';

// ---------------------------------------------------------------------------
// SettlementLaneIndicator — pill showing settlement lane + timing
// ---------------------------------------------------------------------------
// "INSTANT (0h)" / "STANDARD (24h)" / "DEFERRED (7d)"
// With progress bar for pending settlements approaching release.
// ---------------------------------------------------------------------------

interface SettlementLaneIndicatorProps {
  lane: string;
  settlementDelayHours: number;
  // For pending settlements: show progress
  createdAt?: string | Date;
  escrowReleaseAt?: string | Date | null;
  status?: string;
}

const LANE_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  INSTANT: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  STANDARD: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    dot: 'bg-amber-400',
  },
  DEFERRED: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/30',
    dot: 'bg-red-400',
  },
};

function formatDelay(hours: number): string {
  if (hours === 0) return '0h';
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

export default function SettlementLaneIndicator({
  lane,
  settlementDelayHours,
  createdAt,
  escrowReleaseAt,
  status,
}: SettlementLaneIndicatorProps) {
  const styles = LANE_STYLES[lane] ?? LANE_STYLES.DEFERRED;

  // Calculate progress for pending settlements
  let progressPct = 0;
  if (status === 'PENDING' && createdAt && escrowReleaseAt) {
    const created = new Date(createdAt).getTime();
    const release = new Date(escrowReleaseAt).getTime();
    const now = Date.now();
    const total = release - created;
    if (total > 0) {
      progressPct = Math.min(100, Math.max(0, ((now - created) / total) * 100));
    }
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${styles.bg} ${styles.border}`}>
      {/* Dot */}
      <span className={`w-2 h-2 rounded-full ${styles.dot} ${status === 'PENDING' ? 'animate-pulse' : ''}`} />

      {/* Label */}
      <span className={`text-xs font-semibold ${styles.text}`}>
        {lane} ({formatDelay(settlementDelayHours)})
      </span>

      {/* Progress bar for pending */}
      {status === 'PENDING' && progressPct > 0 && (
        <div className="w-16 h-1 rounded-full bg-[#1e1e2e] overflow-hidden">
          <div
            className={`h-full rounded-full ${styles.dot}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Status badge */}
      {status && status !== 'PENDING' && (
        <span className={`text-[10px] font-medium uppercase ${
          status === 'SETTLED' ? 'text-emerald-400' :
          status === 'DISPUTED' ? 'text-red-400' :
          status === 'REVERSED' ? 'text-gray-500' : 'text-gray-400'
        }`}>
          {status}
        </span>
      )}
    </div>
  );
}
