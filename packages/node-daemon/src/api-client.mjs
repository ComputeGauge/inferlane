// Thin API client for the node daemon. Wraps the InferLane REST
// endpoints the daemon needs: heartbeat, attestation nonce + submit,
// capability update. Exposes Promise-returning functions with
// typed-ish JSDoc so editors can autocomplete.

/**
 * @typedef {Object} ApiClient
 * @property {(body: object) => Promise<any>} heartbeat
 * @property {(nodeOperatorId: string) => Promise<{nonce: string, expiresAt: string}>} getAttestationNonce
 * @property {(body: object) => Promise<any>} submitAttestation
 * @property {(body: object) => Promise<any>} updateCapabilities
 */

export function createApiClient(config, logger) {
  const base = config.apiEndpoint.replace(/\/$/, '');
  const headers = {
    'Authorization': `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
    'User-Agent': `inferlane-node/${process.env.npm_package_version ?? '0.1.0-alpha'}`,
  };

  async function request(method, path, body) {
    const url = `${base}${path}`;
    const opts = {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    };
    let res;
    try {
      res = await fetch(url, opts);
    } catch (err) {
      logger.warn(`network error on ${method} ${path}: ${err.message}`);
      throw err;
    }
    if (!res.ok) {
      let errText = '';
      try { errText = await res.text(); } catch { /* swallow */ }
      const short = errText.slice(0, 300);
      logger.warn(`${method} ${path} -> ${res.status}: ${short}`);
      throw new Error(`${method} ${path} returned ${res.status}`);
    }
    if (res.status === 204) return null;
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  return {
    heartbeat(body) {
      return request('POST', '/api/nodes/heartbeat', body);
    },
    async getAttestationNonce(nodeOperatorId) {
      return request(
        'GET',
        `/api/nodes/attestation/nonce?nodeOperatorId=${encodeURIComponent(nodeOperatorId)}`,
      );
    },
    submitAttestation(body) {
      return request('POST', '/api/nodes/attestation', body);
    },
    updateCapabilities(body) {
      return request('POST', '/api/nodes/register', body);
    },
  };
}
