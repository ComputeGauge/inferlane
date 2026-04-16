// Node daemon configuration — env + config-file resolution.
//
// Precedence: CLI args > env vars > config file > defaults.
// Config file location: $XDG_CONFIG_HOME/inferlane/node.json or
//                       ~/.config/inferlane/node.json on Linux/macOS,
//                       %APPDATA%\inferlane\node.json on Windows.

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEFAULTS = {
  apiEndpoint: 'https://inferlane.dev',
  heartbeatIntervalMs: 15_000,
  attestationIntervalMs: 30 * 60 * 1000,        // 30 minutes
  capabilityRefreshMs: 60 * 60 * 1000,          // 1 hour
  logLevel: 'info',
};

function configPath() {
  if (process.platform === 'win32') {
    const appdata = process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming');
    return join(appdata, 'inferlane', 'node.json');
  }
  const xdg = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config');
  return join(xdg, 'inferlane', 'node.json');
}

function loadFileConfig() {
  try {
    const path = configPath();
    if (!existsSync(path)) return {};
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}

function fromEnv() {
  const out = {};
  if (process.env.INFERLANE_API_ENDPOINT) out.apiEndpoint = process.env.INFERLANE_API_ENDPOINT;
  if (process.env.INFERLANE_API_KEY) out.apiKey = process.env.INFERLANE_API_KEY;
  if (process.env.INFERLANE_NODE_ID) out.nodeOperatorId = process.env.INFERLANE_NODE_ID;
  if (process.env.INFERLANE_HEARTBEAT_MS) {
    out.heartbeatIntervalMs = Number(process.env.INFERLANE_HEARTBEAT_MS);
  }
  if (process.env.INFERLANE_LOG_LEVEL) out.logLevel = process.env.INFERLANE_LOG_LEVEL;
  if (process.env.INFERLANE_OLLAMA_URL) out.ollamaUrl = process.env.INFERLANE_OLLAMA_URL;
  if (process.env.INFERLANE_REGION) out.region = process.env.INFERLANE_REGION;
  return out;
}

export function loadConfig(cliOverrides = {}) {
  return {
    ...DEFAULTS,
    ...loadFileConfig(),
    ...fromEnv(),
    ...cliOverrides,
  };
}

export function validateConfig(cfg) {
  const errors = [];
  if (!cfg.apiKey) errors.push('apiKey is required (set INFERLANE_API_KEY)');
  if (!cfg.nodeOperatorId) {
    errors.push('nodeOperatorId is required (set INFERLANE_NODE_ID)');
  }
  if (!cfg.apiEndpoint || !cfg.apiEndpoint.startsWith('https://')) {
    errors.push('apiEndpoint must be an https:// URL');
  }
  if (cfg.heartbeatIntervalMs < 5_000) {
    errors.push('heartbeatIntervalMs must be >= 5000');
  }
  return errors;
}
