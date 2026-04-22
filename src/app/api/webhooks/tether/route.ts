// POST /api/webhooks/tether — USDT deposit confirmation webhook.
//
// Commercial build, Phase F4.2. Receives deposit notifications from
// our USDT custodian partner (Fireblocks primary, Tether merchant
// API secondary — see commercial/memos/tether-partner-selection.md).
//
// Webhook authentication pattern (per Fireblocks' standard):
//   - Partner signs the raw body with an Ed25519 key.
//   - We verify the signature against the partner's public key,
//     pinned in env: TETHER_WEBHOOK_PUBLIC_KEY (PEM).
//   - Replay protection: reject timestamps older than 5 minutes.
//
// This endpoint is live behind a kill switch. Until TETHER_WEBHOOK_ENABLED
// is set, every request returns 503 so we can't be tricked into
// crediting a wallet before the partner contract is in place.

import { NextRequest, NextResponse } from 'next/server';
import { createPublicKey, createVerify } from 'crypto';
import { handleDepositWebhook } from '@/lib/tether';
import { logger } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;  // 5 minutes
const seen = new Map<string, number>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function isEnabled(): boolean {
  // GATED: accepting USDT is Virtual Asset Service Provider (VASP)
  // activity. Triggers AUSTRAC registration (AU), FinCEN MSB (US), MiCA
  // (EU), FCA registration (UK), and similar regimes. Do not enable
  // without the appropriate registrations in every jurisdiction from
  // which you accept funds. See _internal/HUMAN_TASKS.md task F2.
  // The VASP_COMPLIANCE_ACKNOWLEDGED gate is required in addition to
  // TETHER_WEBHOOK_ENABLED so the webhook can't accidentally go live.
  if (process.env.VASP_COMPLIANCE_ACKNOWLEDGED !== '1') return false;
  return (
    process.env.TETHER_WEBHOOK_ENABLED === '1' ||
    process.env.TETHER_WEBHOOK_ENABLED === 'true'
  );
}

function alreadySeen(eventId: string): boolean {
  const ts = seen.get(eventId);
  if (!ts) return false;
  if (Date.now() - ts > IDEMPOTENCY_TTL_MS) {
    seen.delete(eventId);
    return false;
  }
  return true;
}

function remember(eventId: string): void {
  seen.set(eventId, Date.now());
  if (seen.size > 10_000) {
    const cutoff = Date.now() - IDEMPOTENCY_TTL_MS;
    for (const [id, ts] of seen) {
      if (ts < cutoff) seen.delete(id);
    }
  }
}

function verifySignature(body: string, signatureB64: string): boolean {
  try {
    const pem = process.env.TETHER_WEBHOOK_PUBLIC_KEY;
    if (!pem) return false;
    const key = createPublicKey(pem);
    const verifier = createVerify('RSA-SHA256');
    verifier.update(body);
    return verifier.verify(key, Buffer.from(signatureB64, 'base64'));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!isEnabled()) {
    return NextResponse.json(
      { error: 'Tether webhook not enabled (TETHER_WEBHOOK_ENABLED unset)' },
      { status: 503 },
    );
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-tether-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  if (!verifySignature(rawBody, signature)) {
    logger.warn('tether.webhook.signature_failed');
    return NextResponse.json({ error: 'Bad signature' }, { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventId = payload.eventId as string | undefined;
  const timestamp = payload.timestamp as string | undefined;
  if (!eventId || !timestamp) {
    return NextResponse.json(
      { error: 'Missing eventId or timestamp' },
      { status: 400 },
    );
  }

  const eventTime = new Date(timestamp).getTime();
  if (Number.isNaN(eventTime) || Math.abs(Date.now() - eventTime) > MAX_CLOCK_SKEW_MS) {
    return NextResponse.json(
      { error: 'Event timestamp outside acceptable clock skew' },
      { status: 400 },
    );
  }

  if (alreadySeen(eventId)) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const eventType = payload.eventType as string | undefined;
  if (eventType !== 'deposit.confirmed') {
    remember(eventId);
    return NextResponse.json({ ok: true, ignored: true, eventType });
  }

  const deposit = payload.deposit as Record<string, unknown> | undefined;
  const buyerUserId = payload.buyerUserId as string | undefined;
  if (!deposit || !buyerUserId) {
    return NextResponse.json(
      { error: 'Missing deposit or buyerUserId' },
      { status: 400 },
    );
  }

  try {
    const result = await handleDepositWebhook(
      {
        externalId: deposit.externalId as string,
        chain: deposit.chain as 'PLASMA' | 'ARBITRUM' | 'TRON' | 'SOLANA' | 'ETHEREUM',
        txHash: deposit.txHash as string,
        amountMicroUsdt: BigInt(deposit.amountMicroUsdt as string),
        fromAddress: (deposit.fromAddress as string | null) ?? null,
        confirmedAt: new Date(deposit.confirmedAt as string),
        confirmations: (deposit.confirmations as number) ?? 0,
      },
      buyerUserId,
    );

    remember(eventId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error('tether.webhook.handle_failed', {
      eventId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }
}
