// GET /api/wallet/balance — current buyer wallet balance.
//
// Commercial build, Phase F1.4. Reads from the ledger projection
// via src/lib/wallets/buyer-wallet.ts. BigInt values are serialised
// as strings since JSON doesn't support BigInt natively.

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth-api-key';
import { rateLimit } from '@/lib/rate-limit';
import { getBalance } from '@/lib/wallets/buyer-wallet';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`wallet-balance:${auth.userId}`, 120, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const balance = await getBalance(auth.userId);

  return NextResponse.json({
    balance: {
      userId: balance.userId,
      availableUsdCents: balance.availableUsdCents.toString(),
      reservedUsdCents: balance.reservedUsdCents.toString(),
      totalUsdCents: balance.totalUsdCents.toString(),
      lastUpdatedAt: balance.lastUpdatedAt.toISOString(),
    },
  });
}
