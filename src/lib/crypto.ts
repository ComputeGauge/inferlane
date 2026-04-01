// API Key Vault — AES-256-GCM encryption for provider API keys
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY not set');
  // Hash to ensure 32 bytes
  return createHash('sha256').update(key).digest();
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const parts = encryptedData.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted data format');

  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const ciphertext = parts[2];

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// Generate a InferLane API key (il_live_xxx or il_test_xxx)
export function generateApiKey(prefix: 'live' | 'test' = 'live'): { raw: string; hash: string; prefix: string } {
  const random = randomBytes(32).toString('base64url');
  const raw = `il_${prefix}_${random}`;
  const hash = createHash('sha256').update(raw).digest('hex');
  const keyPrefix = raw.slice(0, 16);

  return { raw, hash, prefix: keyPrefix };
}

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
