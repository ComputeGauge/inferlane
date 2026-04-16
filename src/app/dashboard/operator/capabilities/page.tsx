'use client';

import { useEffect, useState } from 'react';

// /dashboard/operator/capabilities — declare what your node can run.
//
// Operators declare hardware, supported models, privacy tier, and
// regions. The router uses these declarations when picking which
// operators to route a workload to. Misrepresentation is a material
// breach per the Operator Agreement and grounds for slashing.

type PrivacyTier = 'TRANSPORT_ONLY' | 'CONFIDENTIAL' | 'FEDERATED';
type HardwareClass = 'CPU' | 'GPU_CONSUMER' | 'GPU_ENTERPRISE' | 'TPU' | 'NPU';

interface CapabilitiesForm {
  displayName: string;
  hardwareClass: HardwareClass;
  gpuModel: string;
  gpuMemoryGb: number;
  supportedModels: string;       // comma-separated for now
  regions: string;               // comma-separated ISO 3166 codes
  privacyTier: PrivacyTier;
  maxConcurrent: number;
  apiEndpoint: string;
}

const DEFAULT_FORM: CapabilitiesForm = {
  displayName: '',
  hardwareClass: 'GPU_ENTERPRISE',
  gpuModel: '',
  gpuMemoryGb: 0,
  supportedModels: '',
  regions: '',
  privacyTier: 'TRANSPORT_ONLY',
  maxConcurrent: 4,
  apiEndpoint: '',
};

export default function CapabilitiesPage() {
  const [form, setForm] = useState<CapabilitiesForm>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/nodes/register');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data?.operator) return;
        setForm((prev) => ({
          ...prev,
          displayName: data.operator.displayName ?? '',
          regions: (data.operator.regions ?? []).join(', '),
          privacyTier: data.operator.privacyTier ?? 'TRANSPORT_ONLY',
          maxConcurrent: data.operator.maxConcurrent ?? 4,
          apiEndpoint: data.operator.apiEndpoint ?? '',
        }));
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/nodes/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: form.displayName,
          capabilities: {
            hardwareClass: form.hardwareClass,
            gpuModel: form.gpuModel,
            gpuMemoryGb: form.gpuMemoryGb,
          },
          supportedModels: form.supportedModels
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          regions: form.regions
            .split(',')
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean),
          privacyTier: form.privacyTier,
          maxConcurrent: form.maxConcurrent,
          apiEndpoint: form.apiEndpoint,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Failed: ${res.status}`);
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-gray-500">Loading capabilities...</div>;

  return (
    <form onSubmit={onSave} className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">Capabilities</h1>
        <p className="text-sm text-gray-500 mt-1">
          Declare what your node can serve. These values feed the router&apos;s
          candidate selection and are audited for honesty. Misrepresentation
          is grounds for slashing per the{' '}
          <a
            href="/legal/seller-agreement"
            className="underline text-indigo-400 hover:text-indigo-300"
          >
            Operator Agreement
          </a>
          .
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-[#1e1e2e] bg-[#12121a] p-6">
        <Field label="Display name">
          <input
            type="text"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            className="w-full px-4 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white"
            placeholder="e.g. aws-us-east-1-01"
          />
        </Field>

        <Field label="Hardware class">
          <select
            value={form.hardwareClass}
            onChange={(e) =>
              setForm({ ...form, hardwareClass: e.target.value as HardwareClass })
            }
            className="w-full px-4 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white"
          >
            <option value="CPU">CPU only</option>
            <option value="GPU_CONSUMER">GPU (consumer: 4090, 3090)</option>
            <option value="GPU_ENTERPRISE">GPU (enterprise: H100, A100)</option>
            <option value="TPU">TPU</option>
            <option value="NPU">NPU / specialised</option>
          </select>
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="GPU model">
            <input
              type="text"
              value={form.gpuModel}
              onChange={(e) => setForm({ ...form, gpuModel: e.target.value })}
              className="w-full px-4 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white"
              placeholder="e.g. H100"
            />
          </Field>
          <Field label="GPU memory (GB)">
            <input
              type="number"
              min={0}
              value={form.gpuMemoryGb}
              onChange={(e) =>
                setForm({ ...form, gpuMemoryGb: parseInt(e.target.value) || 0 })
              }
              className="w-full px-4 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white"
            />
          </Field>
        </div>

        <Field label="Supported models (comma-separated)">
          <input
            type="text"
            value={form.supportedModels}
            onChange={(e) => setForm({ ...form, supportedModels: e.target.value })}
            className="w-full px-4 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white"
            placeholder="llama3-70b, mixtral-8x22b, ..."
          />
        </Field>

        <Field label="Regions (ISO 3166, comma-separated)">
          <input
            type="text"
            value={form.regions}
            onChange={(e) => setForm({ ...form, regions: e.target.value })}
            className="w-full px-4 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white"
            placeholder="US, DE, SG"
          />
        </Field>

        <Field label="Privacy tier">
          <select
            value={form.privacyTier}
            onChange={(e) =>
              setForm({ ...form, privacyTier: e.target.value as PrivacyTier })
            }
            className="w-full px-4 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white"
          >
            <option value="TRANSPORT_ONLY">Transport only (TLS, no TEE)</option>
            <option value="CONFIDENTIAL">
              Confidential (requires attested TEE)
            </option>
            <option value="FEDERATED">Federated (local-only execution)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Confidential tier requires a fresh VERIFIED attestation record.
            See{' '}
            <a
              href="/dashboard/attestation"
              className="underline text-indigo-400 hover:text-indigo-300"
            >
              attestation
            </a>
            .
          </p>
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Max concurrent">
            <input
              type="number"
              min={1}
              max={128}
              value={form.maxConcurrent}
              onChange={(e) =>
                setForm({
                  ...form,
                  maxConcurrent: Math.max(1, parseInt(e.target.value) || 1),
                })
              }
              className="w-full px-4 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white"
            />
          </Field>
          <Field label="Inference endpoint URL">
            <input
              type="url"
              value={form.apiEndpoint}
              onChange={(e) => setForm({ ...form, apiEndpoint: e.target.value })}
              className="w-full px-4 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white"
              placeholder="https://your-node.example/v1"
            />
          </Field>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-white text-black px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save capabilities'}
        </button>
        {saved && <span className="text-sm text-emerald-400">Saved.</span>}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
