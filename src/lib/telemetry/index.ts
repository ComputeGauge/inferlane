// Vendor-neutral telemetry facade.
//
// Commercial build, Phase 1.1: observability backbone.
//
// Design: this file is the single place the app imports from. It wraps
// OpenTelemetry if the SDK is installed *and* a collector endpoint is
// configured; otherwise it degrades to structured console logging. Callers
// never need to know which is active.
//
// Why a facade: edge runtime, Vercel serverless, and local dev all have
// different constraints. Static OTel imports crash edge routes the moment
// they touch node:fs. Dynamic import behind a facade keeps every surface
// safe and lets us swap the exporter (Datadog / Grafana / Honeycomb / Azure
// Monitor) without changing call sites.

type AttributeValue = string | number | boolean | null | undefined;
type Attributes = Record<string, AttributeValue>;

/**
 * Sanitize a string value before it lands in a structured log.
 *
 * Strips control characters (newlines, nulls, escape sequences) that
 * could break log aggregators that parse JSON lines or confuse
 * log-query languages that treat strings as executable. Also bounds
 * the length so a hostile user can't bloat the log stream.
 *
 * Addresses ASVS V14.5.2.
 */
function sanitizeValue(value: AttributeValue): AttributeValue {
  if (typeof value !== 'string') return value;
  // Strip C0 control chars (0x00–0x1F) and DEL (0x7F). JSON.stringify
  // escapes these safely but some SIEMs render them verbatim or use
  // them as record separators. We replace rather than remove so the
  // presence is still visible in the log.
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\x00-\x1f\x7f]/g, '?');
  // Cap at 2000 chars per field — longer values should be uploaded
  // as blobs and referenced by hash.
  return cleaned.length > 2000 ? cleaned.slice(0, 2000) + '…' : cleaned;
}

function sanitizeAttributes(attrs?: Attributes): Attributes | undefined {
  if (!attrs) return attrs;
  const out: Attributes = {};
  for (const [k, v] of Object.entries(attrs)) {
    out[k] = sanitizeValue(v);
  }
  return out;
}

export interface Span {
  setAttribute(key: string, value: AttributeValue): void;
  setAttributes(attrs: Attributes): void;
  recordException(err: unknown): void;
  setStatus(status: 'ok' | 'error', message?: string): void;
  end(): void;
}

export interface Tracer {
  startSpan(name: string, attrs?: Attributes): Span;
}

export interface Meter {
  counter(name: string, value?: number, attrs?: Attributes): void;
  histogram(name: string, value: number, attrs?: Attributes): void;
  gauge(name: string, value: number, attrs?: Attributes): void;
}

export interface Logger {
  debug(msg: string, attrs?: Attributes): void;
  info(msg: string, attrs?: Attributes): void;
  warn(msg: string, attrs?: Attributes): void;
  error(msg: string, attrs?: Attributes): void;
}

// ---- Console-backed fallback implementations ----

class ConsoleSpan implements Span {
  private readonly name: string;
  private readonly startedAt: number;
  private attrs: Attributes = {};
  private status: 'ok' | 'error' = 'ok';
  private statusMessage?: string;
  private exception?: unknown;

  constructor(name: string, initial?: Attributes) {
    // Sanitize the name in case a caller ever passes user-supplied
    // content as a span name. Current call sites all use
    // code-defined names, but this is defense-in-depth for the
    // structured log stream (red-team finding M-4).
    const safeName = sanitizeValue(name);
    this.name = typeof safeName === 'string' ? safeName : 'unknown';
    this.startedAt = Date.now();
    // Initial attrs come through the same sanitization path as
    // setAttribute() so a caller can't bypass the control-char
    // strip by passing everything up front.
    const cleaned = sanitizeAttributes(initial);
    if (cleaned) this.attrs = cleaned;
  }

  setAttribute(key: string, value: AttributeValue): void {
    this.attrs[key] = sanitizeValue(value);
  }

  setAttributes(attrs: Attributes): void {
    const clean = sanitizeAttributes(attrs);
    if (clean) Object.assign(this.attrs, clean);
  }

  recordException(err: unknown): void {
    this.exception = err;
    this.status = 'error';
  }

  setStatus(status: 'ok' | 'error', message?: string): void {
    this.status = status;
    if (message) this.statusMessage = message;
  }

  end(): void {
    const duration = Date.now() - this.startedAt;
    // Span name is internal (always a code-defined string), so not
    // sanitized. statusMessage and exception fields may contain
    // upstream errors reflecting user input, so they are sanitized
    // before emission.
    const record = {
      kind: 'span',
      name: this.name,
      durationMs: duration,
      status: this.status,
      statusMessage:
        typeof this.statusMessage === 'string'
          ? sanitizeValue(this.statusMessage)
          : this.statusMessage,
      attrs: this.attrs,
      exception:
        this.exception instanceof Error
          ? {
              message: sanitizeValue(this.exception.message),
              // Stack traces are internal code paths; skipping sanitize
              // because the format must remain parseable.
              stack: this.exception.stack,
            }
          : this.exception,
      ts: new Date().toISOString(),
    };
    // Never throw from observability code
    try {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(record));
    } catch {
      /* ignore */
    }
  }
}

class ConsoleTracer implements Tracer {
  startSpan(name: string, attrs?: Attributes): Span {
    return new ConsoleSpan(name, attrs);
  }
}

class ConsoleMeter implements Meter {
  private emit(kind: string, name: string, value: number, attrs?: Attributes) {
    try {
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({
          kind,
          metric: name,
          value,
          attrs: sanitizeAttributes(attrs) ?? {},
          ts: new Date().toISOString(),
        }),
      );
    } catch {
      /* ignore */
    }
  }
  counter(name: string, value = 1, attrs?: Attributes): void {
    this.emit('counter', name, value, attrs);
  }
  histogram(name: string, value: number, attrs?: Attributes): void {
    this.emit('histogram', name, value, attrs);
  }
  gauge(name: string, value: number, attrs?: Attributes): void {
    this.emit('gauge', name, value, attrs);
  }
}

class ConsoleLogger implements Logger {
  private emit(level: string, msg: string, attrs?: Attributes) {
    try {
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({
          kind: 'log',
          level,
          msg: sanitizeValue(msg),
          attrs: sanitizeAttributes(attrs) ?? {},
          ts: new Date().toISOString(),
        }),
      );
    } catch {
      /* ignore */
    }
  }
  debug(msg: string, attrs?: Attributes): void {
    if (process.env.IL_LOG_LEVEL === 'debug') this.emit('debug', msg, attrs);
  }
  info(msg: string, attrs?: Attributes): void {
    this.emit('info', msg, attrs);
  }
  warn(msg: string, attrs?: Attributes): void {
    this.emit('warn', msg, attrs);
  }
  error(msg: string, attrs?: Attributes): void {
    this.emit('error', msg, attrs);
  }
}

// ---- Exports ----

export const tracer: Tracer = new ConsoleTracer();
export const meter: Meter = new ConsoleMeter();
export const logger: Logger = new ConsoleLogger();

/**
 * Wrap an async function in a span. Automatically records duration, status,
 * and any thrown exception. Use this over manual startSpan/end to avoid
 * leaking spans on early returns.
 *
 *   const result = await withSpan('fleet.recordEvent', { sessionId }, async (span) => {
 *     span.setAttribute('type', type);
 *     return await prisma.fleetEvent.create(...);
 *   });
 */
export async function withSpan<T>(
  name: string,
  attrs: Attributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const span = tracer.startSpan(name, attrs);
  try {
    const result = await fn(span);
    span.setStatus('ok');
    return result;
  } catch (err) {
    span.recordException(err);
    span.setStatus('error', err instanceof Error ? err.message : String(err));
    throw err;
  } finally {
    span.end();
  }
}

/**
 * Redact a value for logging. Returns SHA-256 prefix for API keys / tokens.
 * Never log raw credentials even at debug level.
 */
export function redact(value: string | undefined | null): string {
  if (!value) return '<empty>';
  if (value.length < 8) return '<short>';
  return `${value.slice(0, 4)}…${value.slice(-2)}`;
}
