// Minimal ASN.1 DER parser.
//
// Supports the subset of DER needed to walk an X.509 certificate
// extensions structure: SEQUENCE, SET, OCTET STRING, OBJECT IDENTIFIER,
// INTEGER, BOOLEAN, BIT STRING, NULL, and context-specific tags
// (primitive and constructed) with tag numbers 0-30. Multi-byte tags
// and indefinite-length encodings are deliberately rejected — DER
// forbids both, and accepting them would create ambiguity.
//
// This module exists so we can extract the Apple App Attest nonce
// extension from a leaf cert without depending on a heavyweight ASN.1
// library. It's also used by the SEV-SNP and TDX signature-conversion
// paths as a shared primitive.

export class Asn1ParseError extends Error {
  constructor(message: string) {
    super(`ASN.1: ${message}`);
    this.name = 'Asn1ParseError';
  }
}

export type Asn1Class = 'universal' | 'application' | 'context' | 'private';

export interface Asn1Node {
  /** Raw tag byte. */
  tag: number;
  /** Tag class (universal / application / context / private). */
  class: Asn1Class;
  /** True if the tag's constructed bit (0x20) is set. */
  constructed: boolean;
  /** Tag number within its class. */
  tagNumber: number;
  /** Content length in bytes. */
  length: number;
  /** Offset of the content's first byte within the source buffer. */
  contentStart: number;
  /** Offset one past the content's last byte. */
  contentEnd: number;
  /** Slice of the source buffer containing just the content. */
  content: Buffer;
  /** Total length including tag + length header + content. */
  totalLength: number;
}

const CLASS_NAMES: Asn1Class[] = ['universal', 'application', 'context', 'private'];

/**
 * Parse a single DER-encoded ASN.1 element starting at `offset` in
 * `buf`. Returns the parsed node; the caller can use `totalLength`
 * to advance the cursor.
 *
 * Throws `Asn1ParseError` on malformed input. The parser rejects
 * anything it can't interpret rather than guessing.
 */
export function parseDer(buf: Buffer, offset = 0): Asn1Node {
  if (offset < 0 || offset >= buf.length) {
    throw new Asn1ParseError(`offset ${offset} out of range for buffer length ${buf.length}`);
  }

  const tag = buf[offset];
  const tagClass = (tag & 0xc0) >> 6;
  const constructed = (tag & 0x20) !== 0;
  const tagNumber = tag & 0x1f;

  if (tagNumber === 0x1f) {
    // High-tag-number form (multi-byte tag). We don't need this for
    // any of the certs we parse, and accepting it would expand the
    // attack surface.
    throw new Asn1ParseError('high-tag-number form is not supported');
  }

  const lenOffset = offset + 1;
  if (lenOffset >= buf.length) {
    throw new Asn1ParseError('unexpected end of input while reading length');
  }

  const lenFirst = buf[lenOffset];
  let length: number;
  let contentStart: number;

  if ((lenFirst & 0x80) === 0) {
    // Short form: length is the byte itself.
    length = lenFirst;
    contentStart = lenOffset + 1;
  } else {
    // Long form: low 7 bits are the number of subsequent length bytes.
    const numLenBytes = lenFirst & 0x7f;
    if (numLenBytes === 0) {
      // Indefinite length is not permitted in DER.
      throw new Asn1ParseError('indefinite-length encoding is not permitted in DER');
    }
    if (numLenBytes > 4) {
      // A length that needs more than 4 bytes is > 4 GiB. We don't
      // accept anything that large; it's almost certainly garbage.
      throw new Asn1ParseError(`unsupported long-form length: ${numLenBytes} bytes`);
    }
    if (lenOffset + 1 + numLenBytes > buf.length) {
      throw new Asn1ParseError('unexpected end of input while reading long-form length');
    }
    length = 0;
    for (let i = 0; i < numLenBytes; i++) {
      length = (length << 8) | buf[lenOffset + 1 + i];
    }
    // Reject non-minimal encodings: the first length byte must be
    // non-zero, and the length must not fit in fewer bytes.
    if (buf[lenOffset + 1] === 0) {
      throw new Asn1ParseError('non-minimal long-form length encoding');
    }
    if (numLenBytes === 1 && length < 0x80) {
      throw new Asn1ParseError('long-form length used where short form was sufficient');
    }
    contentStart = lenOffset + 1 + numLenBytes;
  }

  const contentEnd = contentStart + length;
  if (contentEnd > buf.length) {
    throw new Asn1ParseError(
      `content length ${length} exceeds remaining buffer (${buf.length - contentStart})`,
    );
  }

  return {
    tag,
    class: CLASS_NAMES[tagClass],
    constructed,
    tagNumber,
    length,
    contentStart,
    contentEnd,
    content: buf.subarray(contentStart, contentEnd),
    totalLength: contentEnd - offset,
  };
}

/**
 * Parse all direct children of a constructed ASN.1 node (SEQUENCE, SET,
 * or any context-specific constructed wrapper). Throws if called on a
 * primitive node.
 */
export function parseChildren(node: Asn1Node): Asn1Node[] {
  if (!node.constructed) {
    throw new Asn1ParseError('cannot parse children of a primitive node');
  }
  const out: Asn1Node[] = [];
  let cursor = 0;
  while (cursor < node.content.length) {
    const child = parseDer(node.content, cursor);
    out.push(child);
    cursor += child.totalLength;
  }
  return out;
}

// -------------- Type guards --------------

export function isSequence(node: Asn1Node): boolean {
  return node.class === 'universal' && node.tagNumber === 0x10 && node.constructed;
}

export function isSet(node: Asn1Node): boolean {
  return node.class === 'universal' && node.tagNumber === 0x11 && node.constructed;
}

export function isOctetString(node: Asn1Node): boolean {
  return node.class === 'universal' && node.tagNumber === 0x04;
}

export function isOid(node: Asn1Node): boolean {
  return node.class === 'universal' && node.tagNumber === 0x06 && !node.constructed;
}

export function isContext(node: Asn1Node, tagNumber: number): boolean {
  return node.class === 'context' && node.tagNumber === tagNumber;
}

// -------------- OID encoding / decoding --------------

/**
 * Decode the content bytes of an OBJECT IDENTIFIER into dotted
 * notation (e.g. "1.2.840.113635.100.8.2").
 */
export function decodeOid(content: Buffer): string {
  if (content.length === 0) {
    throw new Asn1ParseError('empty OID content');
  }
  const first = content[0];
  const parts: number[] = [Math.floor(first / 40), first % 40];
  let value = 0;
  let started = false;
  for (let i = 1; i < content.length; i++) {
    const b = content[i];
    value = (value << 7) | (b & 0x7f);
    started = true;
    if ((b & 0x80) === 0) {
      parts.push(value);
      value = 0;
      started = false;
    }
  }
  if (started) {
    throw new Asn1ParseError('truncated OID content (trailing continuation byte)');
  }
  return parts.join('.');
}

/**
 * Encode a dotted OID string (e.g. "1.2.840.113635.100.8.2") into
 * DER content bytes. The returned buffer does NOT include the outer
 * tag (0x06) or length prefix — use `compareOid` if all you want is
 * to check a candidate OID against a known one.
 */
export function encodeOidContent(oid: string): Buffer {
  const parts = oid.split('.').map((p) => {
    const n = Number(p);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      throw new Asn1ParseError(`invalid OID arc: ${p}`);
    }
    return n;
  });
  if (parts.length < 2) {
    throw new Asn1ParseError(`OID must have at least 2 arcs: ${oid}`);
  }

  const bytes: number[] = [parts[0] * 40 + parts[1]];
  for (let i = 2; i < parts.length; i++) {
    let v = parts[i];
    if (v === 0) {
      bytes.push(0);
      continue;
    }
    const stack: number[] = [];
    while (v > 0) {
      stack.push(v & 0x7f);
      v >>>= 7;
    }
    // Emit from most-significant to least-significant; all but the
    // final byte have the high bit set.
    for (let j = stack.length - 1; j >= 0; j--) {
      bytes.push(stack[j] | (j > 0 ? 0x80 : 0));
    }
  }
  return Buffer.from(bytes);
}

/**
 * Compare an OID node's content against a known dotted-notation OID.
 * Returns true if the node is an OID and its content matches.
 */
export function oidEquals(node: Asn1Node, oid: string): boolean {
  if (!isOid(node)) return false;
  try {
    const expected = encodeOidContent(oid);
    return node.content.equals(expected);
  } catch {
    return false;
  }
}
