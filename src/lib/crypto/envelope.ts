// Envelope encryption — ASVS V6.4.1.
//
// Replaces the single-key AES-GCM path in src/lib/crypto.ts with a
// proper envelope model:
//
//   - A Data Encryption Key (DEK) is generated randomly for each
//     piece of protected content. DEKs never leave this process in
//     plaintext after use.
//   - The DEK is encrypted under a Key Encryption Key (KEK) that
//     lives in a managed KMS. The wrapped DEK is stored alongside
//     the ciphertext.
//   - Decryption reverses the process: unwrap the DEK via KMS, use
//     it to decrypt the payload, then discard.
//
// Why envelope instead of a single key?
//   - Key rotation becomes O(1) — rotate the KEK, rewrap all DEKs.
//     No need to re-encrypt every record.
//   - Compromise containment — leaking one DEK only exposes one
//     record. The KEK stays in KMS and is never readable by the
//     application.
//   - Audit trail — every KMS unwrap is logged by the KMS provider,
//     so forensic questions ("who decrypted record X") are
//     answerable from an independent audit log.
//
// Provider abstraction: this module ships two adapters (`local` and
// `aws-kms`) and is designed for easy addition of `gcp-kms`,
// `azure-key-vault`, and `vault`. The default is `local`, which
// derives the KEK from ENCRYPTION_KEY via HKDF (same as the legacy
// path in src/lib/crypto.ts). Production deployments should set
// INFERLANE_KMS_PROVIDER=aws-kms or similar.

import { createCipheriv, createDecipheriv, randomBytes, hkdfSync } from 'crypto';

const ALGO = 'aes-256-gcm';
const DEK_BYTES = 32;
const IV_BYTES = 12;           // 96-bit nonce (GCM spec)
const VERSION = 1;

export interface EnvelopeCiphertext {
  version: number;
  provider: string;            // "local" | "aws-kms" | ...
  keyId: string;               // KEK id or alias
  wrappedDek: string;          // base64 of wrapped DEK
  iv: string;                  // base64
  tag: string;                 // base64
  ciphertext: string;          // base64
}

interface KmsProvider {
  readonly name: string;
  readonly keyId: string;
  wrap(dek: Buffer): Promise<Buffer>;
  unwrap(wrapped: Buffer, keyId: string): Promise<Buffer>;
}

// ---- Local provider (HKDF-derived KEK) ----

class LocalKmsProvider implements KmsProvider {
  readonly name = 'local';
  readonly keyId = 'local-v1';

  private kek(): Buffer {
    const master = process.env.ENCRYPTION_KEY;
    if (!master) throw new Error('ENCRYPTION_KEY not set');
    return Buffer.from(
      hkdfSync(
        'sha256',
        Buffer.from(master, 'utf8'),
        Buffer.from('inferlane-kek-salt-v1', 'utf8'),
        Buffer.from('inferlane/kek/v1', 'utf8'),
        32,
      ),
    );
  }

  async wrap(dek: Buffer): Promise<Buffer> {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGO, this.kek(), iv);
    const enc = Buffer.concat([cipher.update(dek), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Format: iv || tag || ct (fixed lengths so unwrap knows offsets)
    return Buffer.concat([iv, tag, enc]);
  }

  async unwrap(wrapped: Buffer, _keyId: string): Promise<Buffer> {
    const iv = wrapped.subarray(0, IV_BYTES);
    const tag = wrapped.subarray(IV_BYTES, IV_BYTES + 16);
    const enc = wrapped.subarray(IV_BYTES + 16);
    const decipher = createDecipheriv(ALGO, this.kek(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]);
  }
}

// ---- AWS KMS provider (stub) ----
//
// Lives behind a dynamic import so the aws-sdk is not pulled in for
// every deployment. Activate by setting:
//   INFERLANE_KMS_PROVIDER=aws-kms
//   INFERLANE_KMS_KEY_ID=arn:aws:kms:us-east-1:123456789012:key/xxx
// and ensuring the runtime has AWS credentials (IAM role, env vars,
// or ~/.aws/credentials).

class AwsKmsProvider implements KmsProvider {
  readonly name = 'aws-kms';
  readonly keyId: string;

  constructor(keyId: string) {
    this.keyId = keyId;
  }

  async wrap(dek: Buffer): Promise<Buffer> {
    // TODO(phase-6.4): import '@aws-sdk/client-kms' and call Encrypt
    // against this.keyId with dek as Plaintext. Return the
    // CiphertextBlob.
    throw new Error('aws-kms provider not yet wired (install @aws-sdk/client-kms)');
  }

  async unwrap(wrapped: Buffer, _keyId: string): Promise<Buffer> {
    // TODO(phase-6.4): import '@aws-sdk/client-kms' and call Decrypt
    // with wrapped as CiphertextBlob. Return Plaintext.
    throw new Error('aws-kms provider not yet wired (install @aws-sdk/client-kms)');
  }
}

// ---- Provider factory ----

let cachedProvider: KmsProvider | null = null;

export function getKmsProvider(): KmsProvider {
  if (cachedProvider) return cachedProvider;
  const name = (process.env.INFERLANE_KMS_PROVIDER ?? 'local').toLowerCase();
  switch (name) {
    case 'aws-kms': {
      const keyId = process.env.INFERLANE_KMS_KEY_ID ?? '';
      if (!keyId) throw new Error('INFERLANE_KMS_KEY_ID is required for aws-kms');
      cachedProvider = new AwsKmsProvider(keyId);
      return cachedProvider;
    }
    case 'local':
    default:
      cachedProvider = new LocalKmsProvider();
      return cachedProvider;
  }
}

// ---- Public encrypt / decrypt ----

export async function envelopeEncrypt(plaintext: string | Buffer): Promise<EnvelopeCiphertext> {
  const provider = getKmsProvider();
  const dek = randomBytes(DEK_BYTES);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, dek, iv);
  const input = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;
  const enc = Buffer.concat([cipher.update(input), cipher.final()]);
  const tag = cipher.getAuthTag();
  const wrappedDek = await provider.wrap(dek);

  // Zero the plaintext DEK so it isn't left in the closure.
  dek.fill(0);

  return {
    version: VERSION,
    provider: provider.name,
    keyId: provider.keyId,
    wrappedDek: wrappedDek.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: enc.toString('base64'),
  };
}

export async function envelopeDecrypt(bundle: EnvelopeCiphertext): Promise<Buffer> {
  if (bundle.version !== VERSION) {
    throw new Error(`Unsupported envelope version: ${bundle.version}`);
  }
  const provider = getKmsProvider();
  if (provider.name !== bundle.provider) {
    throw new Error(
      `Envelope was wrapped by ${bundle.provider} but current provider is ${provider.name}`,
    );
  }
  const dek = await provider.unwrap(Buffer.from(bundle.wrappedDek, 'base64'), bundle.keyId);
  try {
    const decipher = createDecipheriv(ALGO, dek, Buffer.from(bundle.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(bundle.tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(bundle.ciphertext, 'base64')),
      decipher.final(),
    ]);
  } finally {
    dek.fill(0);
  }
}

export async function envelopeDecryptString(bundle: EnvelopeCiphertext): Promise<string> {
  const buf = await envelopeDecrypt(bundle);
  try {
    return buf.toString('utf8');
  } finally {
    buf.fill(0);
  }
}
