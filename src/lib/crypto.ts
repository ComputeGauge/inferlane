// API Key Vault — AES-256-GCM encryption for provider API keys.
//
// Key derivation: HKDF-SHA-256 from the ENCRYPTION_KEY env var (commercial
// build, ASVS V2.4.4 / V6.3.1). The env var itself is expected to be a
// high-entropy random string (32+ bytes). HKDF splits it per-context so
// the same master key can serve multiple purposes without reuse.
//
// Backwards compatibility: legacy ciphertext stored before this change
// was encrypted with keys derived via plain SHA-256. Decryption tries
// the HKDF path first, falls back to the legacy path if that fails, and
// callers should opportunistically re-encrypt on next write. Migration
// is complete when no SHA-256-derived ciphertexts remain.

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
  hkdfSync,
} from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;
const HKDF_INFO = 'inferlane/vault/v1';
const HKDF_SALT = 'inferlane-static-salt-v1';  // domain separation; public

// Current ciphertext format prefix identifies the derivation scheme.
// v1 = HKDF-SHA-256. Absence of prefix = legacy plain SHA-256.
const CIPHERTEXT_VERSION_V1 = 'v1';

function getMasterKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY not set');
  return Buffer.from(key, 'utf8');
}

/**
 * HKDF-derived key for the vault. Context string is a public label so
 * the same master key could be partitioned for other purposes later
 * (audit log HMAC, per-tenant keys, etc).
 */
function deriveKeyHkdf(): Buffer {
  const master = getMasterKey();
  // hkdfSync(digest, ikm, salt, info, length) -> ArrayBuffer
  const derived = hkdfSync(
    'sha256',
    master,
    Buffer.from(HKDF_SALT, 'utf8'),
    Buffer.from(HKDF_INFO, 'utf8'),
    KEY_LENGTH,
  );
  return Buffer.from(derived);
}

/**
 * Legacy key derivation: plain SHA-256 over the master. Kept for reading
 * old ciphertexts only. Never called from the encrypt path.
 */
function deriveKeyLegacy(): Buffer {
  const master = getMasterKey();
  return createHash('sha256').update(master).digest();
}

export function encrypt(plaintext: string): string {
  const key = deriveKeyHkdf();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  // Format: v1:iv:tag:ciphertext  (all hex except the version tag)
  return `${CIPHERTEXT_VERSION_V1}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(':');

  // v1 format: v1:iv:tag:ct (4 parts, leading "v1")
  if (parts.length === 4 && parts[0] === CIPHERTEXT_VERSION_V1) {
    return decryptWithKey(deriveKeyHkdf(), parts[1], parts[2], parts[3]);
  }

  // Legacy format: iv:tag:ct (3 parts). Try legacy derivation first;
  // if the auth tag verifies we know the legacy key is still current.
  if (parts.length === 3) {
    try {
      return decryptWithKey(deriveKeyLegacy(), parts[0], parts[1], parts[2]);
    } catch (err) {
      // Some records were double-wrapped during the brief transition
      // window. Fall through to HKDF as a last resort.
      try {
        return decryptWithKey(deriveKeyHkdf(), parts[0], parts[1], parts[2]);
      } catch {
        throw err;
      }
    }
  }

  throw new Error('Invalid encrypted data format');
}

function decryptWithKey(
  key: Buffer,
  ivHex: string,
  tagHex: string,
  ciphertextHex: string,
): string {
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * True if a ciphertext was encrypted under the legacy derivation and
 * should be re-encrypted next time it's touched.
 */
export function isLegacyCiphertext(encryptedData: string): boolean {
  const parts = encryptedData.split(':');
  return parts.length === 3;
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
