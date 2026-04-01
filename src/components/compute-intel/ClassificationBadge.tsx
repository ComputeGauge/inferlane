'use client';

// ---------------------------------------------------------------------------
// ClassificationBadge — compact inline badge showing compute classification
// ---------------------------------------------------------------------------
// Renders: [FRONTIER] [REALTIME] [TEE] [INSTANT]
// Used on marketplace offers, proxy logs, and node dashboard cards.
// ---------------------------------------------------------------------------

interface ClassificationBadgeProps {
  qualityTier: string;
  latencyClass?: string;
  hardwareClass?: string;
  settlementLane?: string;
  verificationScore?: number;
  compact?: boolean; // Only show tier + lane
}

const TIER_COLORS: Record<string, string> = {
  FRONTIER: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  STANDARD: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  ECONOMY: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  OPEN_WEIGHT: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

const LANE_COLORS: Record<string, string> = {
  INSTANT: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  STANDARD: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  DEFERRED: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const LANE_LABELS: Record<string, string> = {
  INSTANT: 'INSTANT',
  STANDARD: 'T+1',
  DEFERRED: 'DEFERRED',
};

function VerificationDot({ score }: { score: number }) {
  if (score >= 65) {
    return <span className="text-emerald-400" title={`Verified (${score}/100)`}>&#10003;</span>;
  }
  if (score >= 1) {
    return <span className="text-amber-400" title={`Partial (${score}/100)`}>~</span>;
  }
  return <span className="text-red-400" title="Unverified">&#10007;</span>;
}

export default function ClassificationBadge({
  qualityTier,
  latencyClass,
  hardwareClass,
  settlementLane,
  verificationScore,
  compact = false,
}: ClassificationBadgeProps) {
  const tierColor = TIER_COLORS[qualityTier] ?? TIER_COLORS.ECONOMY;
  const laneColor = settlementLane ? (LANE_COLORS[settlementLane] ?? LANE_COLORS.DEFERRED) : '';

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Quality tier */}
      <span className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded border ${tierColor}`}>
        {qualityTier.replace('_', ' ')}
      </span>

      {/* Latency class */}
      {!compact && latencyClass && (
        <span className="px-1.5 py-0.5 text-[10px] font-medium uppercase rounded border border-[#2a2a3a] text-gray-400">
          {latencyClass}
        </span>
      )}

      {/* Hardware (only TEE worth calling out) */}
      {!compact && hardwareClass === 'TEE_CAPABLE' && (
        <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded border bg-purple-500/15 text-purple-400 border-purple-500/30">
          TEE
        </span>
      )}

      {/* Settlement lane */}
      {settlementLane && (
        <span className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded border ${laneColor}`}>
          {LANE_LABELS[settlementLane] ?? settlementLane}
        </span>
      )}

      {/* Verification indicator */}
      {verificationScore !== undefined && (
        <span className="text-xs">
          <VerificationDot score={verificationScore} />
        </span>
      )}
    </div>
  );
}
