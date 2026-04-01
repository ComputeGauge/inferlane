import { PrismaClient } from '../src/generated/prisma/client';
import crypto from 'crypto';

async function main() {
  const prisma = new PrismaClient({
    accelerateUrl: process.env.DATABASE_URL || '',
  });

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
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'hex'), iv);
    let encrypted = cipher.update(anthropicKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const encryptedApiKey = iv.toString('hex') + ':' + encrypted;

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
    console.log('Provider: ANTHROPIC stored');
  } else {
    console.log('WARN: Missing ENCRYPTION_KEY or ANTHROPIC_API_KEY');
  }

  await prisma.$disconnect();
  console.log('Done. Test key: il_test_d39c66390d8897a2434f5dcf99c98583f24de4209fd1a5d4');
}

main().catch(e => { console.error(e); process.exit(1); });
