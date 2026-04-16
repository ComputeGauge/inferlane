// GET /api/nodes/attestation/nonce — issue a fresh nonce for attestation.
//
// The node daemon calls this *before* collecting an attestation bundle,
// embeds the returned nonce into the evidence (e.g. as `report_data`
// for SEV-SNP or `client_payload.nonce` for Azure MAA), and then
// submits the bundle to /api/nodes/attestation. The server-side
// attestation verifier rejects bundles whose nonce doesn't match.
//
// This prevents replay of a previously-valid attestation and forces
// the node to re-attest with fresh evidence each time.
//
// Nonces are one-time, expire after 15 minutes, and are ownership-bound
// so a nonce issued to one operator can't be reused by another.
//
// Response: { nonce: string, expiresAt: string }

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-api-key';
import { rateLimit } from '@/lib/rate-limit';
import { randomBytes } from 'crypto';

// In-memory nonce store. For production with multiple regions this
// needs to move to Redis (same Upstash path as rate limiting). For the
// commercial-build scaffold, in-memory is fine.
const nonceStore = new Map<string, { nodeOperatorId: string; expiresAt: number }>();

function cleanupExpired() {
  const now = Date.now();
  for (const [nonce, meta] of nonceStore.entries()) {
    if (meta.expiresAt <= now) nonceStore.delete(nonce);
  }
}

/**
 * Check whether a nonce was issued to the given operator and is still
 * valid. Consumes the nonce on success (one-time use). Exported so the
 * attestation POST route can import it.
 */
export function consumeNonce(nonce: string, nodeOperatorId: string): boolean {
  cleanupExpired();
  const meta = nonceStore.get(nonce);
  if (!meta) return false;
  if (meta.expiresAt <= Date.now()) {
    nonceStore.delete(nonce);
    return false;
  }
  if (meta.nodeOperatorId !== nodeOperatorId) return false;
  nonceStore.delete(nonce);
  return true;
}

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`attestation-nonce:${auth.apiKeyId ?? auth.userId}`, 30, 60_000);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  const url = new URL(req.url);
  const nodeOperatorId = url.searchParams.get('nodeOperatorId');
  if (!nodeOperatorId) {
    return NextResponse.json(
      { error: 'nodeOperatorId query parameter is required' },
      { status: 400 },
    );
  }

  // 256-bit nonce, hex-encoded. No operator-controlled input, so
  // injection is not possible.
  const nonce = randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 15 * 60 * 1000;
  nonceStore.set(nonce, { nodeOperatorId, expiresAt });

  cleanupExpired();

  return NextResponse.json({
    nonce,
    expiresAt: new Date(expiresAt).toISOString(),
  });
}
