// POST /api/nodes/attestation — record a TEE attestation verdict for a node.
//
// Commercial build, Phase 4 writer path. This is how nodes prove they
// belong in the Confidential privacy tier. The node daemon collects an
// attestation bundle (Azure MAA JWT, GCP Confidential Space JWT, raw
// TDX/SEV-SNP quote, or NVIDIA CC evidence) and posts it here. We:
//
//   1. Verify ownership — the API key must belong to the same user as
//      the NodeOperator being attested.
//   2. Rate limit — one attestation submission per 10 seconds per
//      node is plenty; this is not a hot path.
//   3. Run the attestation facade (src/lib/attestation/index.ts)
//      which dispatches to the vendor-specific verifier.
//   4. Persist the verdict as an AttestationRecord row. This row is
//      what router-commercial.ts gateByPrivacyTier() reads to decide
//      whether the node qualifies for Confidential routing.
//
// The node daemon is expected to call this periodically (every 15-60
// minutes, plus on demand before joining a new routing window).
//
// Request body:
// {
//   nodeOperatorId: string,
//   type: 'AZURE_CONFIDENTIAL_VM' | 'GCP_CONFIDENTIAL_SPACE' | ...,
//   evidence: string,        // JWT or base64 quote
//   endorsements?: string,   // PEM cert chain for DIY paths
//   claimedMeasurement?: string,
//   nonce: string,           // must match nonce issued via /api/nodes/attestation/nonce
//   collectedAt: string,     // ISO timestamp
// }
//
// Response:
// {
//   record: { id, outcome, measurement, validUntil, summary },
//   routingEnabled: boolean
// }

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-api-key';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import { verifyAttestation } from '@/lib/attestation';
import type { AttestationType as FacadeAttestationType } from '@/lib/attestation';
import { createHash } from 'crypto';
import { logger } from '@/lib/telemetry';

const VALID_TYPES: FacadeAttestationType[] = [
  'AZURE_CONFIDENTIAL_VM',
  'GCP_CONFIDENTIAL_SPACE',
  'INTEL_TDX',
  'AMD_SEV_SNP',
  'NVIDIA_CC',
  'MOCK',
];

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // One attestation per 10s per API key; attestations are periodic so
  // a runaway client is easy to spot.
  const rl = await rateLimit(`attestation:${auth.apiKeyId ?? auth.userId}`, 6, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const nodeOperatorId = body.nodeOperatorId as string | undefined;
  const type = body.type as FacadeAttestationType | undefined;
  const evidence = body.evidence as string | undefined;
  const nonce = body.nonce as string | undefined;
  const collectedAtRaw = body.collectedAt as string | undefined;

  if (!nodeOperatorId || !type || !evidence || !nonce || !collectedAtRaw) {
    return NextResponse.json(
      {
        error:
          'Missing required field(s): nodeOperatorId, type, evidence, nonce, collectedAt',
      },
      { status: 400 },
    );
  }

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Invalid attestation type: ${type}` },
      { status: 400 },
    );
  }

  // Ownership check — the API key must belong to the same user that
  // owns this NodeOperator. Without this check a node could post
  // attestations for a competitor.
  const operator = await prisma.nodeOperator.findUnique({
    where: { id: nodeOperatorId },
    select: { id: true, userId: true },
  });
  if (!operator || operator.userId !== auth.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Parse collectedAt as a Date. Reject malformed.
  const collectedAt = new Date(collectedAtRaw);
  if (Number.isNaN(collectedAt.getTime())) {
    return NextResponse.json(
      { error: 'collectedAt is not a valid ISO timestamp' },
      { status: 400 },
    );
  }

  // Run the attestation facade. This dispatches to the vendor verifier.
  const verdict = await verifyAttestation({
    type,
    evidence,
    endorsements: body.endorsements as string | undefined,
    claimedMeasurement: body.claimedMeasurement as string | undefined,
    nonce,
    collectedAt,
  });

  // Compute the evidence hash for the audit trail — we never store
  // the raw evidence blob, just its SHA-256.
  const evidenceHash = createHash('sha256').update(evidence).digest('hex');

  // Persist the verdict. Even non-VERIFIED outcomes are recorded so
  // we can audit the attestation history (and reject operators who
  // repeatedly fail attestation).
  const record = await prisma.attestationRecord.create({
    data: {
      nodeOperatorId,
      type,
      outcome: verdict.outcome,
      measurement: verdict.measurement,
      nonce,
      evidenceHash,
      verifier: verdict.verifier,
      summary: verdict.summary,
      validUntil: verdict.validUntil,
      collectedAt,
    },
  });

  // If the verdict is VERIFIED, also flip teeAttested on the
  // NodeOperator so the router's fast path doesn't have to re-query.
  if (verdict.outcome === 'VERIFIED') {
    await prisma.nodeOperator.update({
      where: { id: nodeOperatorId },
      data: { teeAttested: true },
    });
  }

  logger.info('attestation.recorded', {
    nodeOperatorId,
    type,
    outcome: verdict.outcome,
    measurementPrefix: verdict.measurement?.slice(0, 16) ?? null,
    recordId: record.id,
  });

  return NextResponse.json(
    {
      record: {
        id: record.id,
        outcome: record.outcome,
        measurement: record.measurement,
        validUntil: record.validUntil,
        summary: record.summary,
      },
      routingEnabled: verdict.outcome === 'VERIFIED',
    },
    { status: 201 },
  );
}
