// Unit tests for the telemetry facade's sanitization behavior.
//
// The critical property is that user-supplied strings cannot inject
// control characters into the structured log stream (ASVS V14.5.2)
// and that span lifecycles always emit an "end" record.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tracer, logger, withSpan, redact } from '@/lib/telemetry';

describe('telemetry: span sanitization', () => {
  let logs: string[] = [];
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logs = [];
    spy = vi.spyOn(console, 'log').mockImplementation((msg: unknown) => {
      if (typeof msg === 'string') logs.push(msg);
    });
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it('emits a span record on end()', () => {
    const span = tracer.startSpan('test.op', { userId: 'u_1' });
    span.end();
    expect(logs.length).toBeGreaterThan(0);
    const record = JSON.parse(logs[0]);
    expect(record.kind).toBe('span');
    expect(record.name).toBe('test.op');
    expect(record.attrs.userId).toBe('u_1');
  });

  it('strips control characters from attribute values', () => {
    const span = tracer.startSpan('test.op', {
      evil: 'hello\nworld\x00\x07',
    });
    span.end();
    const record = JSON.parse(logs[0]);
    expect(record.attrs.evil).not.toContain('\n');
    expect(record.attrs.evil).not.toContain('\x00');
    expect(record.attrs.evil).not.toContain('\x07');
  });

  it('caps attribute length at 2000 characters', () => {
    const big = 'x'.repeat(5000);
    const span = tracer.startSpan('test.op', { big });
    span.end();
    const record = JSON.parse(logs[0]);
    expect(record.attrs.big.length).toBeLessThanOrEqual(2001);  // + ellipsis
    expect(record.attrs.big.endsWith('…')).toBe(true);
  });

  it('sanitizes status messages on span end', () => {
    const span = tracer.startSpan('test.op', {});
    span.setStatus('error', 'kaboom\nwith newline');
    span.end();
    const record = JSON.parse(logs[0]);
    expect(record.statusMessage).not.toContain('\n');
  });

  it('records exceptions with sanitized messages', () => {
    const span = tracer.startSpan('test.op', {});
    span.recordException(new Error('bad\ninput'));
    span.end();
    const record = JSON.parse(logs[0]);
    expect(record.exception.message).not.toContain('\n');
    expect(record.status).toBe('error');
  });
});

describe('telemetry: logger', () => {
  let logs: string[] = [];
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logs = [];
    spy = vi.spyOn(console, 'log').mockImplementation((msg: unknown) => {
      if (typeof msg === 'string') logs.push(msg);
    });
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it('emits info logs', () => {
    logger.info('hello', { userId: 'u_1' });
    expect(logs.length).toBe(1);
    const record = JSON.parse(logs[0]);
    expect(record.level).toBe('info');
    expect(record.msg).toBe('hello');
  });

  it('sanitizes log messages', () => {
    logger.info('hello\nworld');
    const record = JSON.parse(logs[0]);
    expect(record.msg).not.toContain('\n');
  });
});

describe('telemetry: withSpan', () => {
  let logs: string[] = [];
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logs = [];
    spy = vi.spyOn(console, 'log').mockImplementation((msg: unknown) => {
      if (typeof msg === 'string') logs.push(msg);
    });
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it('wraps a successful call', async () => {
    const result = await withSpan('test.work', { id: 1 }, async () => 42);
    expect(result).toBe(42);
    expect(logs.length).toBe(1);
    const record = JSON.parse(logs[0]);
    expect(record.status).toBe('ok');
  });

  it('records a failed call and rethrows', async () => {
    await expect(
      withSpan('test.work', {}, async () => {
        throw new Error('nope');
      }),
    ).rejects.toThrow(/nope/);

    const record = JSON.parse(logs[0]);
    expect(record.status).toBe('error');
    expect(record.exception.message).toBe('nope');
  });
});

describe('telemetry: redact', () => {
  it('redacts long strings to prefix-ellipsis-suffix', () => {
    expect(redact('il_live_abcdefghijklmnop')).toBe('il_l…op');
  });
  it('returns <short> for strings under 8 chars', () => {
    expect(redact('short')).toBe('<short>');
  });
  it('returns <empty> for null/undefined/empty', () => {
    expect(redact(null)).toBe('<empty>');
    expect(redact(undefined)).toBe('<empty>');
    expect(redact('')).toBe('<empty>');
  });
});
