import { PrismaClient } from '../src/generated/prisma/client';
import crypto from 'crypto';
import { config as loadEnv } from 'dotenv';
// Use the same encrypt() the app uses so the ciphertext we write is
// decryptable by /api/proxy. The old seed path used raw AES-256-CBC
// with a hex-decoded key, which diverged from the app's
// AES-256-GCM + HKDF-SHA-256 pipeline in src/lib/crypto.ts.
import { encrypt as vaultEncrypt } from '../src/lib/crypto';

// Load .env.local so DATABASE_URL / ENCRYPTION_KEY / ANTHROPIC_API_KEY
// resolve when this script is run outside of Next.js. Silent if missing.
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

/**
 * Build a PrismaClient that matches src/lib/db.ts — use Accelerate URL
 * if DATABASE_URL is a prisma+postgres:// URL, otherwise the Neon
 * serverless adapter. This keeps the seed script working against the
 * same DBs the app uses (most deploys are Neon, not Accelerate).
 */
function buildClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not set (looked in process env, .env.local, .env)');
  }
  if (dbUrl.startsWith('prisma+postgres://') || dbUrl.startsWith('prisma://')) {
    return new PrismaClient({ accelerateUrl: dbUrl });
  }
  // Neon serverless adapter path
  const { PrismaNeon } = require('@prisma/adapter-neon') as typeof import('@prisma/adapter-neon');
  const adapter = new PrismaNeon({ connectionString: dbUrl });
  return new PrismaClient({ adapter }) as unknown as PrismaClient;
}

async function main() {
  const prisma = buildClient();

  const user = await prisma.user.upsert({
    where: { email: 'test@inferlane.dev' },
    update: {},
    create: { email: 'test@inferlane.dev', name: 'Test User' },
  });
  console.log('User:', user.id);

  const rawKey = 'il_test_d39c66390d8897a2434f5dcf99c98583f24de4209fd1a5d4';
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const apiKey = await prisma.apiKey.upsert({
    where: { keyHash },
    update: {},
    create: {
      userId: user.id,
      name: 'Local Test Key',
      keyHash,
      keyPrefix: 'il_test_d39c',
      permissions: ['read', 'write', 'proxy'],
      isActive: true,
    },
  });
  console.log('ApiKey:', apiKey.id);

  const encryptionKey = process.env.ENCRYPTION_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (encryptionKey && anthropicKey) {
    // Route through the app's vault encrypt() so the stored
    // ciphertext uses the same v1:HKDF-GCM format the proxy path
    // reads. Using raw crypto here would create ciphertext the app
    // can't decrypt.
    const encryptedApiKey = vaultEncrypt(anthropicKey);

    await prisma.providerConnection.upsert({
      where: { userId_provider: { userId: user.id, provider: 'ANTHROPIC' as any } },
      update: { encryptedApiKey, isActive: true },
      create: {
        userId: user.id,
        provider: 'ANTHROPIC' as any,
        encryptedApiKey,
        isActive: true,
      },
    });
    console.log('Provider: ANTHROPIC stored (v1 HKDF-GCM ciphertext)');
  } else {
    console.log('WARN: Missing ENCRYPTION_KEY or ANTHROPIC_API_KEY');
  }

  // Seed a credit balance so the proxy's credit-check doesn't 402.
  // $10 is enough for thousands of Haiku smoke-test calls.
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days
  await prisma.creditBalance.upsert({
    where: { userId: user.id },
    update: {
      totalAllocated: '10.00',
      available: '10.00',
      periodEnd,
    },
    create: {
      userId: user.id,
      totalAllocated: '10.00',
      available: '10.00',
      periodStart: now,
      periodEnd,
    },
  });
  console.log('CreditBalance: $10.00 available');

  await prisma.$disconnect();
  console.log('Done. Test key: il_test_d39c66390d8897a2434f5dcf99c98583f24de4209fd1a5d4');
}

main().catch(e => { console.error(e); process.exit(1); });
