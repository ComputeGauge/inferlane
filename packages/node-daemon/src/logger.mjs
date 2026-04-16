// Minimal structured logger for the node daemon. Emits JSON lines to
// stdout. No dependency on the InferLane telemetry facade so the
// daemon can be published as a standalone package without dragging
// in the monorepo's src/ tree.

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

export function createLogger(levelName = 'info') {
  const minLevel = LEVELS[levelName] ?? LEVELS.info;

  function emit(level, msg, attrs = {}) {
    if ((LEVELS[level] ?? 0) < minLevel) return;
    const safeMsg = String(msg).replace(/[\x00-\x1f\x7f]/g, '?');  // strip control chars
    const record = {
      kind: 'log',
      level,
      msg: safeMsg,
      attrs,
      ts: new Date().toISOString(),
    };
    try {
      process.stdout.write(JSON.stringify(record) + '\n');
    } catch { /* swallow */ }
  }

  return {
    debug: (msg, attrs) => emit('debug', msg, attrs),
    info:  (msg, attrs) => emit('info', msg, attrs),
    warn:  (msg, attrs) => emit('warn', msg, attrs),
    error: (msg, attrs) => emit('error', msg, attrs),
  };
}
