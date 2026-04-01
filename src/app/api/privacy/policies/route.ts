import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';

// ---------------------------------------------------------------------------
// GET /api/privacy/policies — List user's privacy policies
// POST /api/privacy/policies — Create a new privacy policy
// ---------------------------------------------------------------------------

const VALID_TIERS = ['TRANSPORT_ONLY', 'BLIND_ROUTING', 'TEE_PREFERRED', 'CONFIDENTIAL'] as const;

async function handleGET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  const policies = await prisma.privacyPolicy.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });

  // If no policies exist, return defaults (they haven't configured any yet)
  if (policies.length === 0) {
    return NextResponse.json({
      policies: [],
      defaults: {
        tiers: VALID_TIERS,
        presets: [
          {
            name: 'Default',
            tier: 'TRANSPORT_ONLY',
            requireTEE: false,
            minFragments: 3,
            maxFragments: 5,
            piiStripping: false,
            canaryInjection: true,
            description: 'Transport encryption only. Node operators can see prompt content. Suitable for non-sensitive workloads.',
          },
          {
            name: 'Enterprise',
            tier: 'BLIND_ROUTING',
            requireTEE: false,
            minFragments: 3,
            maxFragments: 7,
            piiStripping: true,
            canaryInjection: true,
            description: 'Prompt fragmented across multiple nodes. No single node sees complete context. PII auto-stripped.',
          },
          {
            name: 'HIPAA Compliant',
            tier: 'CONFIDENTIAL',
            allowedRegions: ['US'],
            requireTEE: true,
            minFragments: 5,
            maxFragments: 7,
            piiStripping: true,
            canaryInjection: true,
            description: 'Hardware enclave required. US nodes only. Maximum privacy for regulated workloads.',
          },
        ],
      },
    });
  }

  return NextResponse.json({
    policies: policies.map((p) => ({
      id: p.id,
      name: p.name,
      isDefault: p.isDefault,
      tier: p.tier,
      allowedRegions: p.allowedRegions,
      requireTEE: p.requireTEE,
      minFragments: p.minFragments,
      maxFragments: p.maxFragments,
      piiStripping: p.piiStripping,
      canaryInjection: p.canaryInjection,
      maxLatencyMs: p.maxLatencyMs,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
  });
}

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  const rl = await rateLimit(`privacy-policies:${userId}`, 10, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    name,
    tier,
    allowedRegions,
    requireTEE,
    minFragments,
    maxFragments,
    piiStripping,
    canaryInjection,
    maxLatencyMs,
    isDefault,
  } = body;

  // Validation
  if (!name || typeof name !== 'string' || name.length > 100) {
    return NextResponse.json({ error: 'name is required (max 100 chars)' }, { status: 400 });
  }

  if (!tier || !VALID_TIERS.includes(tier)) {
    return NextResponse.json(
      { error: `tier must be one of: ${VALID_TIERS.join(', ')}` },
      { status: 400 },
    );
  }

  if (allowedRegions && (!Array.isArray(allowedRegions) || allowedRegions.some((r: unknown) => typeof r !== 'string'))) {
    return NextResponse.json({ error: 'allowedRegions must be an array of strings' }, { status: 400 });
  }

  if (minFragments !== undefined && (typeof minFragments !== 'number' || minFragments < 2 || minFragments > 10)) {
    return NextResponse.json({ error: 'minFragments must be between 2 and 10' }, { status: 400 });
  }

  if (maxFragments !== undefined && (typeof maxFragments !== 'number' || maxFragments < 2 || maxFragments > 10)) {
    return NextResponse.json({ error: 'maxFragments must be between 2 and 10' }, { status: 400 });
  }

  if (minFragments !== undefined && maxFragments !== undefined && minFragments > maxFragments) {
    return NextResponse.json({ error: 'minFragments cannot exceed maxFragments' }, { status: 400 });
  }

  if (maxLatencyMs !== undefined && maxLatencyMs !== null && (typeof maxLatencyMs !== 'number' || maxLatencyMs < 100)) {
    return NextResponse.json({ error: 'maxLatencyMs must be at least 100' }, { status: 400 });
  }

  // Limit to 5 policies per user
  const existingCount = await prisma.privacyPolicy.count({ where: { userId } });
  if (existingCount >= 5) {
    return NextResponse.json({ error: 'Maximum 5 privacy policies per user' }, { status: 400 });
  }

  // Check for duplicate name
  const existingName = await prisma.privacyPolicy.findUnique({
    where: { userId_name: { userId, name } },
  });
  if (existingName) {
    return NextResponse.json({ error: `Privacy policy "${name}" already exists` }, { status: 400 });
  }

  // If this is the default, unset other defaults
  if (isDefault) {
    await prisma.privacyPolicy.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const policy = await prisma.privacyPolicy.create({
    data: {
      userId,
      name,
      isDefault: isDefault === true || existingCount === 0, // first policy is auto-default
      tier,
      allowedRegions: allowedRegions || [],
      requireTEE: requireTEE === true,
      minFragments: minFragments ?? 3,
      maxFragments: maxFragments ?? 5,
      piiStripping: piiStripping === true,
      canaryInjection: canaryInjection !== false, // default true
      maxLatencyMs: maxLatencyMs ?? null,
    },
  });

  return NextResponse.json({
    id: policy.id,
    name: policy.name,
    isDefault: policy.isDefault,
    tier: policy.tier,
    allowedRegions: policy.allowedRegions,
    requireTEE: policy.requireTEE,
    minFragments: policy.minFragments,
    maxFragments: policy.maxFragments,
    piiStripping: policy.piiStripping,
    canaryInjection: policy.canaryInjection,
    maxLatencyMs: policy.maxLatencyMs,
    createdAt: policy.createdAt,
  }, { status: 201 });
}

export const GET = withTiming(handleGET);
export const POST = withTiming(handlePOST);
