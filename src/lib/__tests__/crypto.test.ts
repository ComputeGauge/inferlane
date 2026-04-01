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
    expect(encrypted).toContain(':'); // iv:tag:ciphertext format
    expect(encrypted.split(':')).toHaveLength(3);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toEqual(plaintext);
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
