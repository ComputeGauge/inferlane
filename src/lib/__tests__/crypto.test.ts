import { describe, it, expect, beforeAll } from 'vitest';

// Set a test encryption key before importing crypto module
beforeAll(() => {
  // 32-byte hex key for AES-256
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);
});

describe('crypto', () => {
  it('encrypts and decrypts a string', async () => {
    const { encrypt, decrypt } = await import('../crypto');
    const plaintext = 'sk-ant-api-key-test-1234567890';
    const encrypted = encrypt(plaintext);

    expect(encrypted).not.toEqual(plaintext);
    expect(encrypted).toContain(':');
    // Post-HKDF migration (ASVS V6.3.1): ciphertext is v1:iv:tag:ct.
    // Legacy 3-part ciphertexts still decrypt via the fallback path.
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('v1');

    const decrypted = decrypt(encrypted);
    expect(decrypted).toEqual(plaintext);
  });

  it('decrypts legacy 3-part ciphertexts (backwards compatibility)', async () => {
    // Legacy ciphertexts were encrypted with a SHA-256 derived key
    // and stored as iv:tag:ct. The decrypt() function falls back to
    // that path when it sees 3 parts. We construct a legacy
    // ciphertext here using the same algorithm the old encrypt() used.
    const { decrypt } = await import('../crypto');
    const crypto = await import('node:crypto');

    const legacyKey = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY!).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', legacyKey, iv);
    let enc = cipher.update('legacy-secret', 'utf8', 'hex');
    enc += cipher.final('hex');
    const tag = cipher.getAuthTag();
    const legacyCiphertext = `${iv.toString('hex')}:${tag.toString('hex')}:${enc}`;

    expect(decrypt(legacyCiphertext)).toBe('legacy-secret');
  });

  it('produces different ciphertext for same input (random IV)', async () => {
    const { encrypt } = await import('../crypto');
    const plaintext = 'test-api-key';
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);

    expect(a).not.toEqual(b); // Different IVs → different ciphertext
  });

  it('generates API keys with correct format', async () => {
    const { generateApiKey } = await import('../crypto');
    const { raw, hash, prefix } = generateApiKey('live');

    expect(raw).toMatch(/^il_live_[A-Za-z0-9_-]+$/);
    expect(prefix).toBe(raw.slice(0, 16));
    expect(hash).toHaveLength(64); // SHA-256 hex
    expect(hash).not.toEqual(raw);
  });

  it('generates test keys with test prefix', async () => {
    const { generateApiKey } = await import('../crypto');
    const { raw, prefix } = generateApiKey('test');

    expect(raw).toMatch(/^il_test_/);
    expect(prefix).toMatch(/^il_test_/);
  });
});
