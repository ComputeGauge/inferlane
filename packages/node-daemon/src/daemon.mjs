// Node daemon main loop.
//
// Starts three independent cycles once configured + validated:
//   1. Heartbeat every 15s so the dispatcher knows we're alive.
//   2. Attestation every 30m (configurable) if a TEE is detected.
//   3. Capability refresh every hour so the router sees our
//      current model list.
//
// Each cycle wraps its work in try/catch so a single failure can't
// take down the whole daemon. Exponential backoff kicks in after
// three consecutive failures on the same cycle.

import { loadConfig, validateConfig } from './config.mjs';
import { createLogger } from './logger.mjs';
import { createApiClient } from './api-client.mjs';
import { detectRuntimes, detectHardwareProfile } from './capability-detector.mjs';
import { detectTeeEnvironment, collectAttestation } from './attestation-collector.mjs';

function makeCycle({ name, intervalMs, work, logger, onError }) {
  let timer = null;
  let running = false;
  let consecutiveFailures = 0;

  async function tick() {
    if (running) return;
    running = true;
    try {
      await work();
      if (consecutiveFailures > 0) {
        logger.info(`${name}: recovered after ${consecutiveFailures} failures`);
      }
      consecutiveFailures = 0;
    } catch (err) {
      consecutiveFailures++;
      logger.warn(`${name}: failure #${consecutiveFailures}: ${err.message}`);
      if (onError) onError(err, consecutiveFailures);
    } finally {
      running = false;
      schedule();
    }
  }

  function schedule() {
    // Exponential backoff capped at 10x interval when things are bad.
    const backoff = Math.min(10, Math.pow(2, Math.max(0, consecutiveFailures - 3)));
    timer = setTimeout(tick, intervalMs * backoff);
  }

  return {
    start() {
      tick();
    },
    stop() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

export async function runDaemon(cliOverrides = {}) {
  const cfg = loadConfig(cliOverrides);
  const logger = createLogger(cfg.logLevel);

  const errors = validateConfig(cfg);
  if (errors.length > 0) {
    for (const e of errors) logger.error(`config: ${e}`);
    logger.error('Configuration is invalid. Exiting.');
    process.exit(1);
  }

  logger.info('inferlane-node starting', {
    apiEndpoint: cfg.apiEndpoint,
    nodeOperatorId: cfg.nodeOperatorId,
    heartbeatIntervalMs: cfg.heartbeatIntervalMs,
  });

  const api = createApiClient(cfg, logger);

  // One-shot startup checks. Detection is best-effort; failures don't
  // abort startup, they just reduce what this node advertises.
  const teeType = await detectTeeEnvironment();
  logger.info(`TEE environment: ${teeType ?? 'none (TRANSPORT_ONLY)'}`);

  const hw = detectHardwareProfile();
  logger.info('hardware profile', hw);

  const heartbeat = makeCycle({
    name: 'heartbeat',
    intervalMs: cfg.heartbeatIntervalMs,
    logger,
    async work() {
      await api.heartbeat({ nodeId: cfg.nodeOperatorId });
    },
  });

  const capabilities = makeCycle({
    name: 'capability-refresh',
    intervalMs: cfg.capabilityRefreshMs,
    logger,
    async work() {
      const runtimes = await detectRuntimes({ ollamaUrl: cfg.ollamaUrl });
      await api.updateCapabilities({
        nodeOperatorId: cfg.nodeOperatorId,
        runtimes,
        hardware: hw,
        region: cfg.region,
      });
    },
  });

  let attestation = null;
  if (teeType || process.env.INFERLANE_NODE_MOCK_ATTESTATION === '1') {
    attestation = makeCycle({
      name: 'attestation',
      intervalMs: cfg.attestationIntervalMs,
      logger,
      async work() {
        const { nonce } = await api.getAttestationNonce(cfg.nodeOperatorId);
        const bundle = await collectAttestation({
          type: teeType ?? 'MOCK',
          nonce,
        });
        if (!bundle) {
          logger.warn('attestation: bundle collection returned null');
          return;
        }
        const result = await api.submitAttestation({
          nodeOperatorId: cfg.nodeOperatorId,
          ...bundle,
        });
        logger.info('attestation: submitted', {
          outcome: result?.record?.outcome,
          routingEnabled: result?.routingEnabled,
        });
      },
    });
  }

  heartbeat.start();
  capabilities.start();
  attestation?.start();

  // Graceful shutdown
  function shutdown(signal) {
    logger.info(`received ${signal}, shutting down`);
    heartbeat.stop();
    capabilities.stop();
    attestation?.stop();
    process.exit(0);
  }
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
