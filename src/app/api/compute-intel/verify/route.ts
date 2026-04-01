import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { withTiming } from '@/lib/api-timing';

// ---------------------------------------------------------------------------
// GET /api/compute-intel/verify?classificationId=X — verification history
// POST /api/compute-intel/verify — trigger verification (placeholder)
// ---------------------------------------------------------------------------

async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const rl = await rateLimit(`verify-read:${userId}`, 30, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const classificationId = req.nextUrl.searchParams.get('classificationId');
  if (!classificationId) {
    return NextResponse.json({ error: 'classificationId is required' }, { status: 400 });
  }

  const results = await prisma.computeVerificationResult.findMany({
    where: { classificationId },
    orderBy: { executedAt: 'desc' },
    take: 50,
  });

  return NextResponse.json(results);
}

async function handlePOST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  // Strict rate limit — probes cost real compute
  const rl = await rateLimit(`verify-write:${userId}`, 5, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { classificationId } = body;
  if (!classificationId) {
    return NextResponse.json({ error: 'classificationId is required' }, { status: 400 });
  }

  // Verify the classification exists
  const classification = await prisma.computeClassification.findUnique({
    where: { id: classificationId },
  });

  if (!classification) {
    return NextResponse.json({ error: 'Classification not found' }, { status: 404 });
  }

  // Verification probes require actual proxy calls to the target provider/node.
  // In production, this would call runAllVerifications() from verifier.ts
  // with a sendRequest callback that routes through the proxy.
  //
  // For now, we record that a verification was requested and return the
  // classification's current verification state.
  //
  // Full implementation will be wired when Stream T (node dispatch) provides
  // the sendRequest callback for decentralised nodes.

  return NextResponse.json({
    classificationId,
    targetType: classification.targetType,
    targetId: classification.targetId,
    model: classification.model,
    verificationScore: classification.verificationScore,
    lastVerifiedAt: classification.lastVerifiedAt,
    message: 'Verification probes queued. Results will update the classification score.',
  });
}

export const GET = withTiming(handleGET);
export const POST = withTiming(handlePOST);
