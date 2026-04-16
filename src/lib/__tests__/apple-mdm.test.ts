// Unit tests for the Apple App Attest CBOR parser + authData parser.
//
// Full chain validation requires real Apple-signed fixtures. These
// tests exercise the CBOR decoder, the authData layout parser, and
// the failure paths for common malformed inputs.

import { describe, it, expect } from 'vitest';
import {
  parseAppleAttestation,
  parseAuthData,
} from '@/lib/attestation/apple-mdm';

// Minimal CBOR encoder to build fixtures. Supports only what we
// need: text strings, byte strings, arrays, maps. Definite length.
function cborTextString(s: string): Buffer {
  const data = Buffer.from(s, 'utf8');
  const len = data.length;
  if (len < 24) {
    return Buffer.concat([Buffer.from([0x60 | len]), data]);
  }
  // larger strings go via 1-byte length
  return Buffer.concat([Buffer.from([0x78, len]), data]);
}

function cborByteString(b: Buffer): Buffer {
  const len = b.length;
  if (len < 24) {
    return Buffer.concat([Buffer.from([0x40 | len]), b]);
  }
  if (len < 256) {
    return Buffer.concat([Buffer.from([0x58, len]), b]);
  }
  const hdr = Buffer.alloc(3);
  hdr[0] = 0x59;
  hdr.writeUInt16BE(len, 1);
  return Buffer.concat([hdr, b]);
}

function cborArray(items: Buffer[]): Buffer {
  const len = items.length;
  if (len < 24) {
    return Buffer.concat([Buffer.from([0x80 | len]), ...items]);
  }
  return Buffer.concat([Buffer.from([0x98, len]), ...items]);
}

function cborMap(entries: Array<[string, Buffer]>): Buffer {
  const len = entries.length;
  const header = len < 24 ? Buffer.from([0xa0 | len]) : Buffer.from([0xb8, len]);
  const body = entries.map(([k, v]) => Buffer.concat([cborTextString(k), v]));
  return Buffer.concat([header, ...body]);
}

describe('apple-mdm: parseAppleAttestation', () => {
  it('parses a well-formed attestation object', () => {
    const authData = Buffer.alloc(37 + 16 + 2 + 10 + 5);
    // rpIdHash = 0x01 repeated 32 times
    authData.fill(0x01, 0, 32);
    // flags byte with attested credential data bit set (bit 6)
    authData[32] = 0x40;
    // signCount (big-endian)
    authData.writeUInt32BE(5, 33);
    // aaguid — 'appattest' + padding
    Buffer.from('appattest\0\0\0\0\0\0\0', 'ascii').copy(authData, 37);
    // credentialIdLength
    authData.writeUInt16BE(10, 53);
    // credentialId (10 bytes of 0x02)
    authData.fill(0x02, 55, 65);
    // credentialPublicKey placeholder (5 bytes)
    authData.fill(0x03, 65, 70);

    const leafCert = Buffer.from('leaf-cert-der');
    const intermediateCert = Buffer.from('intermediate-cert-der');

    const attStmt = cborMap([
      ['x5c', cborArray([cborByteString(leafCert), cborByteString(intermediateCert)])],
    ]);
    const root = cborMap([
      ['fmt', cborTextString('apple-appattest')],
      ['attStmt', attStmt],
      ['authData', cborByteString(authData)],
    ]);

    const parsed = parseAppleAttestation(root);
    expect(parsed.fmt).toBe('apple-appattest');
    expect(parsed.x5c).toHaveLength(2);
    expect(parsed.x5c[0].toString()).toBe('leaf-cert-der');
    expect(parsed.x5c[1].toString()).toBe('intermediate-cert-der');
    expect(parsed.authData.length).toBe(authData.length);
  });

  it('rejects the wrong fmt', () => {
    const buf = cborMap([
      ['fmt', cborTextString('packed')],
      ['attStmt', cborMap([])],
      ['authData', cborByteString(Buffer.alloc(10))],
    ]);
    expect(() => parseAppleAttestation(buf)).toThrow(/Unsupported attestation fmt/);
  });

  it('rejects missing attStmt', () => {
    const buf = cborMap([
      ['fmt', cborTextString('apple-appattest')],
      ['authData', cborByteString(Buffer.alloc(10))],
    ]);
    expect(() => parseAppleAttestation(buf)).toThrow(/Missing attStmt/);
  });

  it('rejects an empty x5c', () => {
    const attStmt = cborMap([['x5c', cborArray([])]]);
    const buf = cborMap([
      ['fmt', cborTextString('apple-appattest')],
      ['attStmt', attStmt],
      ['authData', cborByteString(Buffer.alloc(10))],
    ]);
    expect(() => parseAppleAttestation(buf)).toThrow(
      /x5c must contain at least 2 certificates/,
    );
  });
});

describe('apple-mdm: parseAuthData', () => {
  function makeAuthData(params: {
    flags: number;
    aaguid: string;
    credentialId: Buffer;
  }): Buffer {
    const buf = Buffer.alloc(37 + 16 + 2 + params.credentialId.length + 4);
    buf.fill(0x01, 0, 32);                  // rpIdHash
    buf[32] = params.flags;
    buf.writeUInt32BE(1, 33);                // signCount
    Buffer.from(params.aaguid.padEnd(16, '\0'), 'ascii').copy(buf, 37);
    buf.writeUInt16BE(params.credentialId.length, 53);
    params.credentialId.copy(buf, 55);
    return buf;
  }

  it('parses a valid authData with attested credential flag', () => {
    const authData = makeAuthData({
      flags: 0x40,
      aaguid: 'appattest',
      credentialId: Buffer.from([0xaa, 0xbb, 0xcc, 0xdd]),
    });
    const parsed = parseAuthData(authData);
    expect(parsed.rpIdHash.length).toBe(32);
    expect(parsed.flags).toBe(0x40);
    expect(parsed.signCount).toBe(1);
    expect(parsed.aaguid.toString('ascii').replace(/\0+$/, '')).toBe('appattest');
    expect(parsed.credentialId).toEqual(Buffer.from([0xaa, 0xbb, 0xcc, 0xdd]));
  });

  it('rejects authData without the attested credential flag', () => {
    const authData = makeAuthData({
      flags: 0x00,
      aaguid: 'appattest',
      credentialId: Buffer.from([0xaa]),
    });
    expect(() => parseAuthData(authData)).toThrow(
      /attested credential data not present/,
    );
  });

  it('rejects too-short authData', () => {
    expect(() => parseAuthData(Buffer.alloc(10))).toThrow(/too short/);
  });
});
