// Attestation collector.
//
// Probes the local environment to figure out which TEE the node runs
// inside and fetches the appropriate attestation bundle (JWT from a
// managed attestation service, or raw hardware quote for DIY paths).
//
// Every detector is strictly best-effort: a probe that fails returns
// null rather than throwing. If no TEE is detected the daemon runs in
// TRANSPORT_ONLY mode and never asks for Confidential tier routing.

import { existsSync, readFileSync } from 'node:fs';

export async function detectTeeEnvironment() {
  // Azure Confidential VM — check dmidecode / SMBIOS for the Azure
  // SEV-SNP marker. On a non-CVM Azure VM this is absent.
  try {
    const chassis = readFileSync('/sys/class/dmi/id/chassis_asset_tag', 'utf8').trim();
    if (chassis === '7783-7084-3265-9085-8269-3286-77') {
      return 'AZURE_CONFIDENTIAL_VM';
    }
  } catch { /* swallow */ }

  // GCP Confidential Space — check metadata service.
  if (existsSync('/run/confidential-space')) {
    return 'GCP_CONFIDENTIAL_SPACE';
  }

  // Intel TDX — TDX guest sysfs.
  if (existsSync('/sys/kernel/config/tsm/report')) {
    return 'INTEL_TDX';
  }

  // AMD SEV-SNP — dmesg / kernel feature flag (not perfectly reliable;
  // more robust check is via /dev/sev-guest).
  if (existsSync('/dev/sev-guest')) {
    return 'AMD_SEV_SNP';
  }

  // NVIDIA Confidential Compute — nvidia-smi reports CC state. We
  // don't shell out; instead check sysfs if present.
  if (existsSync('/sys/module/nvidia/parameters/NVreg_ConfidentialCompute')) {
    return 'NVIDIA_CC';
  }

  return null;
}

/**
 * Collect an attestation bundle for the current TEE environment.
 * Returns null if no TEE is available or collection fails.
 */
export async function collectAttestation({ type, nonce }) {
  // Each branch is a placeholder that will be filled in with vendor
  // SDK calls during Phase 4.2. For now the collector only succeeds
  // in MOCK mode (explicitly enabled via env var for dev loops).
  if (process.env.INFERLANE_NODE_MOCK_ATTESTATION === '1') {
    return {
      type: 'MOCK',
      evidence: 'mock-evidence-bundle',
      endorsements: undefined,
      claimedMeasurement: 'mock-measurement',
      nonce,
      collectedAt: new Date().toISOString(),
    };
  }

  switch (type) {
    case 'AZURE_CONFIDENTIAL_VM':
      // TODO: call Azure attestation library, receive JWT, return it.
      return null;
    case 'GCP_CONFIDENTIAL_SPACE':
      return null;
    case 'INTEL_TDX':
      // TODO: read from /sys/kernel/config/tsm/report + sign with nonce
      return null;
    case 'AMD_SEV_SNP':
      // TODO: ioctl on /dev/sev-guest
      return null;
    case 'NVIDIA_CC':
      return null;
    default:
      return null;
  }
}
