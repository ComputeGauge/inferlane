#!/usr/bin/env node
/**
 * inferlane-node — node daemon binary entry point.
 *
 * Usage:
 *   inferlane-node                   # start the daemon
 *   inferlane-node --dry-run          # validate config, don't start loops
 *   inferlane-node --version          # print version
 *   inferlane-node --help             # print help
 *
 * Config precedence: CLI > env > config file > defaults.
 * See src/config.mjs for supported env vars.
 */

import { runDaemon } from '../src/daemon.mjs';

const args = process.argv.slice(2);

if (args.includes('--version') || args.includes('-v')) {
  console.log('@inferlane/node-daemon 0.1.0-alpha');
  process.exit(0);
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(
    `inferlane-node — InferLane node daemon\n\n` +
    `Environment variables:\n` +
    `  INFERLANE_API_KEY        (required) Bearer token for the dashboard account\n` +
    `  INFERLANE_NODE_ID        (required) NodeOperator id this daemon represents\n` +
    `  INFERLANE_API_ENDPOINT   (default https://inferlane.dev)\n` +
    `  INFERLANE_HEARTBEAT_MS   (default 15000)\n` +
    `  INFERLANE_OLLAMA_URL     (default http://127.0.0.1:11434)\n` +
    `  INFERLANE_REGION         (default unset)\n` +
    `  INFERLANE_LOG_LEVEL      (default info) debug | info | warn | error\n\n` +
    `Flags:\n` +
    `  --dry-run                Validate config and exit\n` +
    `  --version                Print version\n` +
    `  --help                   This message\n`,
  );
  process.exit(0);
}

if (args.includes('--dry-run')) {
  const { loadConfig, validateConfig } = await import('../src/config.mjs');
  const cfg = loadConfig();
  const errors = validateConfig(cfg);
  if (errors.length > 0) {
    for (const e of errors) console.error(`config: ${e}`);
    process.exit(1);
  }
  console.log('config ok:');
  console.log(JSON.stringify({ ...cfg, apiKey: cfg.apiKey ? '<redacted>' : undefined }, null, 2));
  process.exit(0);
}

runDaemon().catch((err) => {
  console.error(`fatal: ${err.stack ?? err.message ?? err}`);
  process.exit(1);
});
