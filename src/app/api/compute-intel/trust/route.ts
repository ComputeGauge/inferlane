import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';
import {
  calculateTrustScore,
  evaluatePromotion,
  determinePlatformMaturity,
} from '@/lib/compute-intel/trust';
import type { SettlementLane, LaneTransition } from '@/lib/compute-intel/types';

// ---------------------------------------------------------------------------
// GET /api/compute-intel/trust?entityId=X&entityType=provider
// ---------------------------------------------------------------------------
// Returns the trust profile for a compute entity including score components,
// current lane, promotion eligibility, and trust history.
// ---------------------------------------------------------------------------

async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const rl = await rateLimit(`trust-read:${userId}`, 30, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const entityId = req.nextUrl.searchParams.get('entityId');
  const entityType = req.nextUrl.searchParams.get('entityType') as 'provider' | 'node' | null;

  if (!entityId) {
    return NextResponse.json({ error: 'entityId is required' }, { status: 400 });
  }

  if (!entityType || (entityType !== 'provider' && entityType !== 'node')) {
    return NextResponse.json(
      { error: 'entityType must be "provider" or "node"' },
      { status: 400 },
    );
  }

  // --- Gather trust inputs from database ---

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Get the latest classification for this entity
  const classification = await prisma.computeClassification.findFirst({
    where: { targetId: entityId, targetType: entityType },
    orderBy: { updatedAt: 'desc' },
  });

  // Get verification results for accuracy calculation
  const verificationResults = classification
    ? await prisma.computeVerificationResult.findMany({
        where: { classificationId: classification.id },
      })
    : [];

  const verifiedProbes = verificationResults.filter((r) => r.outcome === 'VERIFIED').length;
  const totalProbes = verificationResults.length;

  // Get settlement history for dispute rate and volume
  const [settlements90d, disputes90d, settlements30d] = await Promise.all([
    prisma.computeSettlementRecord.count({
      where: { payeeId: entityId, createdAt: { gte: ninetyDaysAgo } },
    }),
    prisma.computeSettlementRecord.count({
      where: { payeeId: entityId, status: 'DISPUTED', createdAt: { gte: ninetyDaysAgo } },
    }),
    prisma.computeSettlementRecord.count({
      where: { payeeId: entityId, createdAt: { gte: thirtyDaysAgo } },
    }),
  ]);

  // Calculate trust score
  const trustResult = calculateTrustScore({
    totalOnlineHours: 720, // placeholder — nodes would report uptime via heartbeat
    downtimeHours: 0,
    verifiedProbes,
    totalProbes,
    successfulRequests30d: settlements30d,
    activeDisputes90d: disputes90d,
    totalSettlements90d: settlements90d,
  });

  // Current lane from most recent classification or snapshot
  const latestSnapshot = await prisma.trustSnapshot.findFirst({
    where: { entityId, entityType },
    orderBy: { snapshotAt: 'desc' },
  });

  const currentLane: SettlementLane = (latestSnapshot?.currentLane as SettlementLane)
    ?? (classification?.settlementLane as SettlementLane)
    ?? 'DEFERRED';

  // Get total settlements for promotion check
  const totalSettlements = await prisma.computeSettlementRecord.count({
    where: { payeeId: entityId },
  });

  const disputeRate90d = settlements90d > 0 ? disputes90d / settlements90d : 0;

  // Check all verification methods
  const verificationMethods = new Set(
    verificationResults
      .filter((r) => r.outcome === 'VERIFIED')
      .map((r) => r.method),
  );
  const allMethodsPassed = verificationMethods.size >= 5;

  // Get settled total for lifetime earnings
  const lifetimeEarnings = await prisma.computeSettlementRecord.aggregate({
    where: { payeeId: entityId, status: 'SETTLED' },
    _sum: { amountUsd: true },
  });

  // Get account creation date (approximate from first settlement)
  const firstSettlement = await prisma.computeSettlementRecord.findFirst({
    where: { payeeId: entityId },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });

  const accountAgeDays = firstSettlement
    ? Math.floor((now.getTime() - firstSettlement.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Evaluate promotion eligibility
  const promotion = evaluatePromotion({
    currentLane,
    trustScore: trustResult.trustScore,
    consecutiveDaysAboveThreshold: accountAgeDays, // simplified — real impl would check snapshots
    totalRequests: totalSettlements,
    disputeRate90d,
    accountAgeDays,
    verificationScore: classification?.verificationScore ?? 0,
    allVerificationMethodsPassed: allMethodsPassed,
    lifetimeEarningsUsd: Number(lifetimeEarnings._sum.amountUsd ?? 0),
  });

  // Get trust history (last 30 snapshots)
  const trustHistory = await prisma.trustSnapshot.findMany({
    where: { entityId, entityType },
    orderBy: { snapshotAt: 'desc' },
    take: 30,
  });

  // Lane transition history from snapshots
  const laneHistory: LaneTransition[] = [];
  for (let i = trustHistory.length - 1; i > 0; i--) {
    const prev = trustHistory[i];
    const curr = trustHistory[i - 1];
    if (prev.currentLane !== curr.currentLane) {
      laneHistory.push({
        from: prev.currentLane as SettlementLane,
        to: curr.currentLane as SettlementLane,
        reason: prev.trustScore > curr.trustScore ? 'Trust decay' : 'Trust improvement',
        occurredAt: curr.snapshotAt,
      });
    }
  }

  // Get platform maturity
  const latestMetrics = await prisma.platformMetrics.findFirst({
    orderBy: { computedAt: 'desc' },
  });

  const platformMaturity = determinePlatformMaturity({
    totalSettledUsd: Number(latestMetrics?.totalSettledUsd ?? 0),
    averageDisputeRate: Number(latestMetrics?.averageDisputeRate ?? 1.0),
    activeNodes: latestMetrics?.activeNodes ?? 0,
    activeProviders: latestMetrics?.activeProviders ?? 0,
  });

  return NextResponse.json({
    entityId,
    entityType,
    trustScore: trustResult.trustScore,
    components: trustResult.components,
    currentLane,
    promotionEligible: promotion.eligible,
    promotionTargetLane: promotion.targetLane,
    promotionCriteria: promotion.criteria,
    laneHistory,
    trustHistory: trustHistory.map((s) => ({
      trustScore: s.trustScore,
      uptimeScore: Number(s.uptimeScore),
      accuracyScore: Number(s.accuracyScore),
      volumeScore: Number(s.volumeScore),
      disputeScore: Number(s.disputeScore),
      currentLane: s.currentLane,
      snapshotAt: s.snapshotAt,
    })),
    platformMaturity: {
      level: platformMaturity.name,
      instantThreshold: platformMaturity.instantTrustThreshold,
      deferredDelayDays: platformMaturity.deferredDelayDays,
      verificationTTLHours: platformMaturity.verificationTTLHours,
    },
  });
}

export const GET = withTiming(handleGET);
