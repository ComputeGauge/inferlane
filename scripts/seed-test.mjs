import { PrismaClient } from '../src/generated/prisma/index.js';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function seed() {
  // Create test user
  const user = await prisma.user.upsert({
    where: { email: 'test@inferlane.dev' },
    update: {},
    create: {
      email: 'test@inferlane.dev',
      name: 'Test User',
    },
  });
  console.log('User:', user.id);

  // Create API key
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

  // Store Anthropic provider connection
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.log('WARN: No ENCRYPTION_KEY set — skipping provider connection');
    await prisma.$disconnect();
    return;
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    console.log('WARN: No ANTHROPIC_API_KEY — skipping provider connection');
    await prisma.$disconnect();
    return;
  }

  // Encrypt the provider API key (must match decrypt() in src/lib/crypto.ts)
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'hex'), iv);
  let encrypted = cipher.update(anthropicKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const encryptedApiKey = iv.toString('hex') + ':' + encrypted;

  await prisma.providerConnection.upsert({
    where: { userId_provider: { userId: user.id, provider: 'ANTHROPIC' } },
    update: { encryptedApiKey, isActive: true },
    create: {
      userId: user.id,
      provider: 'ANTHROPIC',
      encryptedApiKey,
      isActive: true,
    },
  });
  console.log('Provider connection: ANTHROPIC stored');

  await prisma.$disconnect();
  console.log('Done. Test with:');
  console.log(`curl -X POST http://localhost:3000/api/proxy -H "Authorization: Bearer ${rawKey}" -H "Content-Type: application/json" -d '{"provider":"ANTHROPIC","path":"/v1/messages","body":{"model":"claude-sonnet-4-20250514","max_tokens":50,"messages":[{"role":"user","content":"Say hello in 5 words"}]}}'`);
}

seed().catch(e => { console.error(e); process.exit(1); });
