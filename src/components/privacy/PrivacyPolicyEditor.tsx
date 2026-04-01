'use client';

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Privacy Policy Editor — Configure routing privacy preferences
// ---------------------------------------------------------------------------
// Lets users create and manage privacy policies that control how their
// inference requests are routed through the decentralised network.
// Each policy defines a privacy tier, geo-fencing, TEE requirements,
// fragment counts, PII stripping, and canary injection.
// ---------------------------------------------------------------------------

interface PrivacyPolicy {
  id: string;
  name: string;
  isDefault: boolean;
  tier: string;
  allowedRegions: string[];
  requireTEE: boolean;
  minFragments: number;
  maxFragments: number;
  piiStripping: boolean;
  canaryInjection: boolean;
  maxLatencyMs: number | null;
  createdAt: string;
  updatedAt?: string;
}

interface PolicyPreset {
  name: string;
  tier: string;
  requireTEE: boolean;
  minFragments: number;
  maxFragments: number;
  piiStripping: boolean;
  canaryInjection: boolean;
  allowedRegions?: string[];
  description: string;
}

const TIER_INFO: Record<string, { label: string; description: string; color: string }> = {
  TRANSPORT_ONLY: {
    label: 'Tier 0 — Transport Only',
    description: 'mTLS encryption in transit. Node sees plaintext during inference. Suitable for non-sensitive workloads.',
    color: 'text-green-400',
  },
  BLIND_ROUTING: {
    label: 'Tier 1 — Blind Routing',
    description: 'Prompt fragmented across multiple nodes. No single node sees the complete context. Shamir key splitting for cryptographic enforcement.',
    color: 'text-amber-400',
  },
  TEE_PREFERRED: {
    label: 'Tier 1.5 — TEE Preferred',
    description: 'Routes to TEE-capable nodes when available. Falls back to blind routing (fragmentation) if no TEE nodes are online.',
    color: 'text-orange-400',
  },
  CONFIDENTIAL: {
    label: 'Tier 2 — Confidential Compute',
    description: 'Hardware enclave required (Intel SGX, AMD SEV, NVIDIA CC). Node cannot inspect memory. Cryptographic attestation verified before dispatch.',
    color: 'text-red-400',
  },
};

const REGION_OPTIONS = [
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'IE', label: 'Ireland' },
  { code: 'SE', label: 'Sweden' },
  { code: 'JP', label: 'Japan' },
  { code: 'SG', label: 'Singapore' },
  { code: 'AU', label: 'Australia' },
  { code: 'CA', label: 'Canada' },
  { code: 'CH', label: 'Switzerland' },
];

export default function PrivacyPolicyEditor() {
  const [policies, setPolicies] = useState<PrivacyPolicy[]>([]);
  const [presets, setPresets] = useState<PolicyPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [formName, setFormName] = useState('');
  const [formTier, setFormTier] = useState('TRANSPORT_ONLY');
  const [formRegions, setFormRegions] = useState<string[]>([]);
  const [formRequireTEE, setFormRequireTEE] = useState(false);
  const [formMinFragments, setFormMinFragments] = useState(3);
  const [formMaxFragments, setFormMaxFragments] = useState(5);
  const [formPIIStripping, setFormPIIStripping] = useState(false);
  const [formCanaryInjection, setFormCanaryInjection] = useState(true);
  const [formMaxLatency, setFormMaxLatency] = useState<number | null>(null);
  const [formIsDefault, setFormIsDefault] = useState(false);

  const fetchPolicies = useCallback(async () => {
    try {
      const res = await fetch('/api/privacy/policies');
      const data = await res.json();
      setPolicies(data.policies || []);
      setPresets(data.defaults?.presets || []);
    } catch {
      setError('Failed to load privacy policies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);

  const applyPreset = (preset: PolicyPreset) => {
    setFormName(preset.name);
    setFormTier(preset.tier);
    setFormRequireTEE(preset.requireTEE);
    setFormMinFragments(preset.minFragments);
    setFormMaxFragments(preset.maxFragments);
    setFormPIIStripping(preset.piiStripping);
    setFormCanaryInjection(preset.canaryInjection);
    setFormRegions(preset.allowedRegions || []);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/privacy/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          tier: formTier,
          allowedRegions: formRegions,
          requireTEE: formRequireTEE,
          minFragments: formMinFragments,
          maxFragments: formMaxFragments,
          piiStripping: formPIIStripping,
          canaryInjection: formCanaryInjection,
          maxLatencyMs: formMaxLatency,
          isDefault: formIsDefault,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create policy');
        return;
      }

      setShowCreate(false);
      setFormName('');
      setFormTier('TRANSPORT_ONLY');
      setFormRegions([]);
      setFormRequireTEE(false);
      setFormMinFragments(3);
      setFormMaxFragments(5);
      setFormPIIStripping(false);
      setFormCanaryInjection(true);
      setFormMaxLatency(null);
      setFormIsDefault(false);
      fetchPolicies();
    } catch {
      setError('Network error creating policy');
    } finally {
      setSaving(false);
    }
  };

  const toggleRegion = (code: string) => {
    setFormRegions((prev) =>
      prev.includes(code) ? prev.filter((r) => r !== code) : [...prev, code],
    );
  };

  if (loading) {
    return (
      <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-[#1e1e2e] rounded w-48" />
          <div className="h-32 bg-[#1e1e2e] rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Privacy Policies</h2>
          <p className="text-sm text-gray-400 mt-1">
            Configure how your inference requests are routed through the decentralised network
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 text-white font-medium text-sm hover:from-amber-500 hover:to-orange-500 transition-all"
        >
          {showCreate ? 'Cancel' : 'Create Policy'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Presets (show if no policies exist) */}
      {policies.length === 0 && !showCreate && presets.length > 0 && (
        <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-6">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Quick Start — Choose a Preset</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {presets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className="text-left p-4 rounded-lg border border-[#2a2a3e] hover:border-amber-600/50 bg-[#0a0a0f] transition-all group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-sm font-medium ${TIER_INFO[preset.tier]?.color || 'text-gray-300'}`}>
                    {TIER_INFO[preset.tier]?.label || preset.tier}
                  </span>
                </div>
                <p className="text-white font-medium text-sm">{preset.name}</p>
                <p className="text-gray-500 text-xs mt-1">{preset.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div className="bg-[#12121a] rounded-xl border border-[#1e1e2e] p-6 space-y-6">
          <h3 className="text-lg font-medium text-white">New Privacy Policy</h3>

          {/* Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Policy Name</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., Production Workloads"
              className="w-full bg-[#0a0a0f] border border-[#2a2a3e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-600"
            />
          </div>

          {/* Privacy Tier */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Privacy Tier</label>
            <div className="space-y-2">
              {Object.entries(TIER_INFO).map(([tier, info]) => (
                <label
                  key={tier}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    formTier === tier
                      ? 'border-amber-600/50 bg-amber-900/10'
                      : 'border-[#2a2a3e] bg-[#0a0a0f] hover:border-[#3a3a4e]'
                  }`}
                >
                  <input
                    type="radio"
                    name="tier"
                    value={tier}
                    checked={formTier === tier}
                    onChange={(e) => setFormTier(e.target.value)}
                    className="mt-1 accent-amber-500"
                  />
                  <div>
                    <span className={`text-sm font-medium ${info.color}`}>{info.label}</span>
                    <p className="text-xs text-gray-500 mt-0.5">{info.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Fragmentation Settings (only for BLIND_ROUTING+) */}
          {formTier !== 'TRANSPORT_ONLY' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Min Fragments</label>
                <input
                  type="number"
                  min={2}
                  max={10}
                  value={formMinFragments}
                  onChange={(e) => setFormMinFragments(parseInt(e.target.value) || 3)}
                  className="w-full bg-[#0a0a0f] border border-[#2a2a3e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-600"
                />
                <p className="text-xs text-gray-600 mt-1">More fragments = better privacy, higher latency</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Max Fragments</label>
                <input
                  type="number"
                  min={2}
                  max={10}
                  value={formMaxFragments}
                  onChange={(e) => setFormMaxFragments(parseInt(e.target.value) || 5)}
                  className="w-full bg-[#0a0a0f] border border-[#2a2a3e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-600"
                />
              </div>
            </div>
          )}

          {/* Geo-Fencing */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Allowed Regions <span className="text-gray-600">(empty = any region)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {REGION_OPTIONS.map((region) => (
                <button
                  key={region.code}
                  onClick={() => toggleRegion(region.code)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    formRegions.includes(region.code)
                      ? 'bg-amber-600/20 text-amber-400 border border-amber-600/50'
                      : 'bg-[#0a0a0f] text-gray-500 border border-[#2a2a3e] hover:border-[#3a3a4e]'
                  }`}
                >
                  {region.code} — {region.label}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-lg border border-[#2a2a3e] bg-[#0a0a0f]">
              <div>
                <span className="text-sm text-white">Require TEE Hardware</span>
                <p className="text-xs text-gray-500">Only route to nodes with verified hardware enclaves</p>
              </div>
              <input
                type="checkbox"
                checked={formRequireTEE}
                onChange={(e) => setFormRequireTEE(e.target.checked)}
                className="accent-amber-500 w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-lg border border-[#2a2a3e] bg-[#0a0a0f]">
              <div>
                <span className="text-sm text-white">PII Auto-Stripping</span>
                <p className="text-xs text-gray-500">Automatically redact emails, phone numbers, SSNs before routing</p>
              </div>
              <input
                type="checkbox"
                checked={formPIIStripping}
                onChange={(e) => setFormPIIStripping(e.target.checked)}
                className="accent-amber-500 w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-lg border border-[#2a2a3e] bg-[#0a0a0f]">
              <div>
                <span className="text-sm text-white">Canary Injection</span>
                <p className="text-xs text-gray-500">Inject tracking tokens to detect prompt exfiltration by node operators</p>
              </div>
              <input
                type="checkbox"
                checked={formCanaryInjection}
                onChange={(e) => setFormCanaryInjection(e.target.checked)}
                className="accent-amber-500 w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-lg border border-[#2a2a3e] bg-[#0a0a0f]">
              <div>
                <span className="text-sm text-white">Set as Default</span>
                <p className="text-xs text-gray-500">Apply this policy to all requests unless overridden</p>
              </div>
              <input
                type="checkbox"
                checked={formIsDefault}
                onChange={(e) => setFormIsDefault(e.target.checked)}
                className="accent-amber-500 w-4 h-4"
              />
            </label>
          </div>

          {/* Latency Budget */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Max Latency (ms) <span className="text-gray-600">— optional</span>
            </label>
            <input
              type="number"
              min={100}
              value={formMaxLatency ?? ''}
              onChange={(e) => setFormMaxLatency(e.target.value ? parseInt(e.target.value) : null)}
              placeholder="No limit"
              className="w-full bg-[#0a0a0f] border border-[#2a2a3e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-600"
            />
            <p className="text-xs text-gray-600 mt-1">
              Router will select the highest privacy tier achievable within this budget
            </p>
          </div>

          {/* Create Button */}
          <button
            onClick={handleCreate}
            disabled={saving || !formName.trim()}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 text-white font-medium text-sm hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {saving ? 'Creating...' : 'Create Privacy Policy'}
          </button>
        </div>
      )}

      {/* Existing Policies */}
      {policies.length > 0 && (
        <div className="space-y-3">
          {policies.map((policy) => {
            const tierInfo = TIER_INFO[policy.tier] || { label: policy.tier, color: 'text-gray-400', description: '' };
            return (
              <div
                key={policy.id}
                className={`bg-[#12121a] rounded-xl border p-5 ${
                  policy.isDefault ? 'border-amber-600/30' : 'border-[#1e1e2e]'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-medium">{policy.name}</h3>
                      {policy.isDefault && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-amber-600/20 text-amber-400 border border-amber-600/30">
                          Default
                        </span>
                      )}
                    </div>
                    <span className={`text-sm ${tierInfo.color}`}>{tierInfo.label}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="bg-[#0a0a0f] rounded-lg p-2">
                    <span className="text-gray-500">Fragments</span>
                    <p className="text-gray-300 font-mono">{policy.minFragments}–{policy.maxFragments}</p>
                  </div>
                  <div className="bg-[#0a0a0f] rounded-lg p-2">
                    <span className="text-gray-500">TEE Required</span>
                    <p className={policy.requireTEE ? 'text-amber-400' : 'text-gray-500'}>
                      {policy.requireTEE ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div className="bg-[#0a0a0f] rounded-lg p-2">
                    <span className="text-gray-500">PII Stripping</span>
                    <p className={policy.piiStripping ? 'text-green-400' : 'text-gray-500'}>
                      {policy.piiStripping ? 'Enabled' : 'Off'}
                    </p>
                  </div>
                  <div className="bg-[#0a0a0f] rounded-lg p-2">
                    <span className="text-gray-500">Canaries</span>
                    <p className={policy.canaryInjection ? 'text-green-400' : 'text-gray-500'}>
                      {policy.canaryInjection ? 'Active' : 'Off'}
                    </p>
                  </div>
                </div>

                {policy.allowedRegions.length > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-gray-500">Geo-fence:</span>
                    <div className="flex flex-wrap gap-1">
                      {policy.allowedRegions.map((r) => (
                        <span
                          key={r}
                          className="px-2 py-0.5 rounded-full text-xs bg-blue-900/20 text-blue-400 border border-blue-800/30"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {policy.maxLatencyMs && (
                  <div className="mt-2 text-xs text-gray-500">
                    Max latency: <span className="text-gray-400 font-mono">{policy.maxLatencyMs}ms</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Privacy Architecture Info */}
      <div className="bg-[#0a0a0f] rounded-xl border border-[#1e1e2e] p-5">
        <h3 className="text-sm font-medium text-gray-300 mb-3">How Privacy Tiers Work</h3>
        <div className="space-y-3 text-xs text-gray-500">
          <div className="flex gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 mt-1 shrink-0" />
            <p>
              <span className="text-green-400 font-medium">Tier 0</span> — Standard mTLS encryption.
              Fast, but the executing node can see your prompt. Use for code generation, public data analysis.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0" />
            <p>
              <span className="text-amber-400 font-medium">Tier 1</span> — Your prompt is split into fragments
              and dispatched to different nodes. No single node sees the complete context.
              AES-256 encryption with Shamir key splitting provides cryptographic enforcement.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="w-2 h-2 rounded-full bg-orange-500 mt-1 shrink-0" />
            <p>
              <span className="text-orange-400 font-medium">Tier 1.5</span> — Routes to hardware-enclave
              nodes when available. Falls back to Tier 1 fragmentation when TEE nodes are offline.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500 mt-1 shrink-0" />
            <p>
              <span className="text-red-400 font-medium">Tier 2</span> — Requires verified hardware
              enclaves (Intel SGX, AMD SEV, NVIDIA Confidential Computing). The node physically cannot
              inspect prompt data. Required for HIPAA, PCI-DSS, and regulated workloads.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
