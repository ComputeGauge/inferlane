// Capability detector for the node daemon. Probes local inference
// runtimes (Ollama, vLLM, llama.cpp server, LM Studio) and hardware
// specs so the daemon can tell InferLane what this node can serve.
//
// Never spawns processes. Uses HTTP fetches against known local
// ports with short timeouts so a dead service can't stall startup.

const TIMEOUT_MS = 2_000;

async function fetchWithTimeout(url, init = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function detectOllama(baseUrl = 'http://127.0.0.1:11434') {
  try {
    const res = await fetchWithTimeout(`${baseUrl}/api/tags`);
    if (!res.ok) return null;
    const data = await res.json();
    const models = Array.isArray(data?.models) ? data.models : [];
    return {
      runtime: 'ollama',
      endpoint: baseUrl,
      models: models.map((m) => ({
        name: m.name,
        size: m.size,
        family: m.details?.family,
        parameterSize: m.details?.parameter_size,
      })),
    };
  } catch {
    return null;
  }
}

async function detectVllm(baseUrl = 'http://127.0.0.1:8000') {
  try {
    const res = await fetchWithTimeout(`${baseUrl}/v1/models`);
    if (!res.ok) return null;
    const data = await res.json();
    const models = Array.isArray(data?.data) ? data.data : [];
    return {
      runtime: 'vllm',
      endpoint: baseUrl,
      models: models.map((m) => ({ name: m.id })),
    };
  } catch {
    return null;
  }
}

async function detectLlamaCpp(baseUrl = 'http://127.0.0.1:8080') {
  try {
    const res = await fetchWithTimeout(`${baseUrl}/props`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      runtime: 'llama.cpp',
      endpoint: baseUrl,
      models: data?.default_generation_settings?.model
        ? [{ name: data.default_generation_settings.model }]
        : [],
    };
  } catch {
    return null;
  }
}

export async function detectRuntimes({ ollamaUrl } = {}) {
  const results = await Promise.all([
    detectOllama(ollamaUrl),
    detectVllm(),
    detectLlamaCpp(),
  ]);
  return results.filter(Boolean);
}

export function detectHardwareProfile() {
  const profile = {
    platform: process.platform,
    arch: process.arch,
    cpuCount: undefined,
    memoryGb: undefined,
  };

  try {
    const os = require('node:os');
    profile.cpuCount = os.cpus().length;
    profile.memoryGb = Math.round(os.totalmem() / (1024 * 1024 * 1024));
  } catch { /* swallow */ }

  return profile;
}
