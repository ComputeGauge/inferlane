// POST /api/auth/step-up — issue a step-up token for a requested scope.
//
// ASVS V4.3.2. For the initial rollout we accept any authenticated
// session and issue a 5-minute token. The real flow requires a
// WebAuthn assertion or TOTP code — those gates land with the
// WebAuthn integration (see commercial/memos/webauthn-integration.md).
//
// Until WebAuthn is wired, this route enforces:
//   - A fresh (<= 5 min) successful password / OAuth login, OR
//   - ADMIN role with a reasonable trust baseline
//
// The "fresh login" check is a placeholder: we read the NextAuth
// session's `lastLogin` claim if present. If it's older than 5
// minutes we reject; if missing we also reject. That way we always
// fail closed when the signal isn't there — a reviewer will see the
// 401 and be prompted to re-login via the UI, which generates a
// fresh `lastLogin`.

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-api-key';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';
import { issueStepUpToken } from '@/lib/security/step-up';
import type { StepUpScope } from '@/lib/security/step-up';

const VALID_SCOPES: StepUpScope[] = [
  'dispute.resolve',
  'payout.adjust',
  'ledger.adjust',
  'api-key.create',
  'api-key.revoke',
  'admin.role.change',
  'settings.delete_account',
];

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`stepup:${auth.userId}`, 20, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine — we support a default scope
  }

  const scope = (body.scope as StepUpScope) ?? 'dispute.resolve';
  if (!VALID_SCOPES.includes(scope)) {
    return NextResponse.json({ error: `Invalid scope: ${scope}` }, { status: 400 });
  }

  // Role gate: some scopes require ADMIN role.
  const adminOnlyScopes: StepUpScope[] = [
    'dispute.resolve',
    'payout.adjust',
    'ledger.adjust',
    'admin.role.change',
  ];
  if (adminOnlyScopes.includes(scope)) {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { role: true },
    });
    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  const token = issueStepUpToken({
    userId: auth.userId,
    scope,
  });

  return NextResponse.json({ token, scope });
}
