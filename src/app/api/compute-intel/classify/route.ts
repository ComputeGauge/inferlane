import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';
import { classifyFromRegistry, classifyAllProviderModels, isKnownProvider } from '@/lib/compute-intel/classifier';
import { signClassification } from '@/lib/compute-intel/attestation';

// ---------------------------------------------------------------------------
// GET /api/compute-intel/classify?targetId=OPENAI&model=gpt-4o
// POST /api/compute-intel/classify — trigger classification
// ---------------------------------------------------------------------------

async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const rl = await rateLimit(`classify-read:${userId}`, 30, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const targetId = req.nextUrl.searchParams.get('targetId');
  const model = req.nextUrl.searchParams.get('model');

  if (!targetId) {
    return NextResponse.json({ error: 'targetId is required' }, { status: 400 });
  }

  // If model specified, return single classification
  if (model) {
    const existing = await prisma.computeClassification.findUnique({
      where: { targetType_targetId_model: { targetType: 'provider', targetId, model } },
      include: { verificationResults: { orderBy: { executedAt: 'desc' }, take: 5 } },
    });

    if (existing) {
      return NextResponse.json(serialiseClassification(existing));
    }

    // Generate from registry if not in DB
    if (isKnownProvider(targetId)) {
      const classification = classifyFromRegistry('provider', targetId, model);
      return NextResponse.json(classification);
    }

    return NextResponse.json({ error: 'Classification not found' }, { status: 404 });
  }

  // No model specified — return all classifications for this target
  const classifications = await prisma.computeClassification.findMany({
    where: { targetId },
    orderBy: { updatedAt: 'desc' },
  });

  if (classifications.length > 0) {
    return NextResponse.json(classifications.map(serialiseClassification));
  }

  // Generate from registry for known providers
  if (isKnownProvider(targetId)) {
    const generated = classifyAllProviderModels(targetId);
    return NextResponse.json(generated);
  }

  return NextResponse.json([]);
}

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const rl = await rateLimit(`classify-write:${userId}`, 10, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { targetType, targetId, model } = body;
  if (!targetType || !targetId || !model) {
    return NextResponse.json({ error: 'targetType, targetId, and model are required' }, { status: 400 });
  }

  if (targetType !== 'provider' && targetType !== 'node') {
    return NextResponse.json({ error: 'targetType must be "provider" or "node"' }, { status: 400 });
  }

  // Generate classification
  const classification = classifyFromRegistry(targetType, targetId, model);
  const signed = signClassification(classification);

  // Upsert into database
  const record = await prisma.computeClassification.upsert({
    where: {
      targetType_targetId_model: { targetType, targetId, model },
    },
    create: {
      targetType,
      targetId,
      model,
      inferenceType: signed.inferenceType,
      qualityTier: signed.qualityTier,
      latencyClass: signed.latencyClass,
      privacyClass: signed.privacyClass,
      availabilityClass: signed.availabilityClass,
      hardwareClass: signed.hardwareClass,
      regions: signed.regions,
      verificationScore: signed.verificationScore,
      verificationTTLHours: signed.verificationTTLHours,
      settlementLane: signed.settlementLane,
      settlementDelayHours: signed.settlementTerms.settlementDelayHours,
      escrowRequired: signed.settlementTerms.escrowRequired,
      disputeWindowHours: signed.settlementTerms.disputeWindowHours,
      signature: signed.signature,
      signedAt: signed.signedAt,
      signerKeyId: signed.signerKeyId,
    },
    update: {
      inferenceType: signed.inferenceType,
      qualityTier: signed.qualityTier,
      latencyClass: signed.latencyClass,
      privacyClass: signed.privacyClass,
      availabilityClass: signed.availabilityClass,
      hardwareClass: signed.hardwareClass,
      regions: signed.regions,
      signature: signed.signature,
      signedAt: signed.signedAt,
      signerKeyId: signed.signerKeyId,
    },
  });

  return NextResponse.json(serialiseClassification(record));
}

function serialiseClassification(record: Record<string, unknown>) {
  return {
    ...record,
    measuredThroughputTps: record.measuredThroughputTps ? Number(record.measuredThroughputTps) : null,
    measuredAccuracy: record.measuredAccuracy ? Number(record.measuredAccuracy) : null,
  };
}

export const GET = withTiming(handleGET);
export const POST = withTiming(handlePOST);
