// Unit tests for the envelope encryption primitive (ASVS V6.4.1).
//
// Uses the `local` provider (HKDF-derived KEK) so the tests run
// without any KMS dependency. AWS KMS path is covered by integration
// tests in a separate suite.

import { describe, it, expect, beforeAll } from 'vitest';
import {
  envelopeEncrypt,
  envelopeDecrypt,
  envelopeDecryptString,
} from '@/lib/crypto/envelope';

beforeAll(() => {
  if (!process.env.ENCRYPTION_KEY) {
    process.env.ENCRYPTION_KEY = 'test-envelope-key-' + 'y'.repeat(50);
  }
  // Ensure we use the local provider in tests.
  process.env.INFERLANE_KMS_PROVIDER = 'local';
});

describe('envelope encryption', () => {
  it('round-trips a string', async () => {
    const bundle = await envelopeEncrypt('hello world');
    const out = await envelopeDecryptString(bundle);
    expect(out).toBe('hello world');
  });

  it('round-trips a buffer', async () => {
    const input = Buffer.from([0, 1, 2, 3, 255, 254, 253]);
    const bundle = await envelopeEncrypt(input);
    const out = await envelopeDecrypt(bundle);
    expect(out.equals(input)).toBe(true);
  });

  it('produces different ciphertext for identical plaintext', async () => {
    const a = await envelopeEncrypt('same input');
    const b = await envelopeEncrypt('same input');
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.iv).not.toBe(b.iv);
    expect(a.wrappedDek).not.toBe(b.wrappedDek);
  });

  it('fails to decrypt when the tag is tampered', async () => {
    const bundle = await envelopeEncrypt('sensitive data');
    const tampered = { ...bundle, tag: Buffer.from('A'.repeat(24)).toString('base64') };
    await expect(envelopeDecrypt(tampered)).rejects.toThrow();
  });

  it('fails to decrypt when the ciphertext is tampered', async () => {
    const bundle = await envelopeEncrypt('sensitive data');
    // Mutate one byte of the ciphertext
    const ctBytes = Buffer.from(bundle.ciphertext, 'base64');
    ctBytes[0] ^= 0xff;
    const tampered = { ...bundle, ciphertext: ctBytes.toString('base64') };
    await expect(envelopeDecrypt(tampered)).rejects.toThrow();
  });

  it('fails on unsupported version', async () => {
    const bundle = await envelopeEncrypt('x');
    const wrongVersion = { ...bundle, version: 999 };
    await expect(envelopeDecrypt(wrongVersion)).rejects.toThrow(/Unsupported envelope version/);
  });

  it('handles empty string', async () => {
    const bundle = await envelopeEncrypt('');
    expect(await envelopeDecryptString(bundle)).toBe('');
  });

  it('handles large payloads', async () => {
    const big = 'x'.repeat(100_000);
    const bundle = await envelopeEncrypt(big);
    expect(await envelopeDecryptString(bundle)).toBe(big);
  });
});
