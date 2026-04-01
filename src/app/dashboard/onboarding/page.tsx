'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Provider definitions
// ---------------------------------------------------------------------------

interface ProviderInfo {
  id: string;
  name: string;
  color: string;
  emoji: string;
  keyPlaceholder: string;
  keyUrl: string;
  freeTier: string | null; // null = paid
  freeAmount: string | null;
  hasExtraFields?: 'bedrock' | 'azure';
}

const RECOMMENDED: ProviderInfo[] = [
  { id: 'GOOGLE', name: 'Google AI', color: '#4285f4', emoji: 'G', keyPlaceholder: 'AIza...', keyUrl: 'https://aistudio.google.com/apikey', freeTier: 'free', freeAmount: 'Generous free tier' },
  { id: 'GROQ', name: 'Groq', color: '#f55036', emoji: 'G', keyPlaceholder: 'gsk_...', keyUrl: 'https://console.groq.com/keys', freeTier: 'free', freeAmount: 'Generous free tier' },
  { id: 'XAI', name: 'xAI (Grok)', color: '#1d9bf0', emoji: 'X', keyPlaceholder: 'xai-...', keyUrl: 'https://console.x.ai', freeTier: 'free', freeAmount: '$25/mo free' },
  { id: 'CEREBRAS', name: 'Cerebras', color: '#ff6b6b', emoji: 'C', keyPlaceholder: 'cbs-...', keyUrl: 'https://cloud.cerebras.ai', freeTier: 'free', freeAmount: 'Generous free tier' },
  { id: 'SAMBANOVA', name: 'SambaNova', color: '#7c3aed', emoji: 'S', keyPlaceholder: 'snva-...', keyUrl: 'https://cloud.sambanova.ai', freeTier: 'free', freeAmount: 'Generous free tier' },
  { id: 'DEEPSEEK', name: 'DeepSeek', color: '#4a6cf7', emoji: 'D', keyPlaceholder: 'sk-...', keyUrl: 'https://platform.deepseek.com/api_keys', freeTier: 'free', freeAmount: '$5 free credit' },
  { id: 'TOGETHER', name: 'Together AI', color: '#ff6b35', emoji: 'T', keyPlaceholder: 'tog_...', keyUrl: 'https://api.together.ai/settings/api-keys', freeTier: 'free', freeAmount: '$5 free credit' },
  { id: 'FIREWORKS', name: 'Fireworks AI', color: '#ff4500', emoji: 'F', keyPlaceholder: 'fw_...', keyUrl: 'https://fireworks.ai/account/api-keys', freeTier: 'free', freeAmount: '$1 free credit' },
];

const POPULAR: ProviderInfo[] = [
  { id: 'ANTHROPIC', name: 'Anthropic', color: '#d4a27f', emoji: 'A', keyPlaceholder: 'sk-ant-api03-...', keyUrl: 'https://console.anthropic.com/settings/keys', freeTier: null, freeAmount: null },
  { id: 'OPENAI', name: 'OpenAI', color: '#10a37f', emoji: 'O', keyPlaceholder: 'sk-...', keyUrl: 'https://platform.openai.com/api-keys', freeTier: null, freeAmount: '$5 free on signup' },
  { id: 'MISTRAL', name: 'Mistral AI', color: '#ff7000', emoji: 'M', keyPlaceholder: 'mist-...', keyUrl: 'https://console.mistral.ai/api-keys', freeTier: 'free', freeAmount: 'Free tier' },
  { id: 'COHERE', name: 'Cohere', color: '#39594d', emoji: 'C', keyPlaceholder: 'co-...', keyUrl: 'https://dashboard.cohere.com/api-keys', freeTier: 'free', freeAmount: 'Free, rate limited' },
  { id: 'REPLICATE', name: 'Replicate', color: '#e44dba', emoji: 'R', keyPlaceholder: 'r8_...', keyUrl: 'https://replicate.com/account/api-tokens', freeTier: null, freeAmount: 'Some free models' },
  { id: 'PERPLEXITY', name: 'Perplexity', color: '#20b2aa', emoji: 'P', keyPlaceholder: 'pplx-...', keyUrl: 'https://perplexity.ai/settings/api', freeTier: null, freeAmount: null },
];

const ADVANCED: ProviderInfo[] = [
  { id: 'AWS_BEDROCK', name: 'AWS Bedrock', color: '#ff9900', emoji: 'A', keyPlaceholder: 'AKIA...', keyUrl: 'https://console.aws.amazon.com/bedrock', freeTier: null, freeAmount: null, hasExtraFields: 'bedrock' },
  { id: 'AZURE_OPENAI', name: 'Azure OpenAI', color: '#0078d4', emoji: 'A', keyPlaceholder: 'azure-key...', keyUrl: 'https://portal.azure.com/#view/Microsoft_Azure_ProjectOxford/CognitiveServicesHub/~/OpenAI', freeTier: null, freeAmount: null, hasExtraFields: 'azure' },
  { id: 'MODAL', name: 'Modal', color: '#00c853', emoji: 'M', keyPlaceholder: 'ak-...', keyUrl: 'https://modal.com/settings', freeTier: 'free', freeAmount: '$30/mo free' },
  { id: 'LAMBDA', name: 'Lambda', color: '#6c3dab', emoji: 'L', keyPlaceholder: 'lambda-...', keyUrl: 'https://cloud.lambdalabs.com', freeTier: null, freeAmount: null },
  { id: 'COREWEAVE', name: 'CoreWeave', color: '#00b4d8', emoji: 'C', keyPlaceholder: 'cw-...', keyUrl: 'https://cloud.coreweave.com', freeTier: null, freeAmount: null },
];

const ALL_PROVIDERS = [...RECOMMENDED, ...POPULAR, ...ADVANCED];
const TOTAL_PROVIDERS = ALL_PROVIDERS.length;

// ---------------------------------------------------------------------------
// Provider Card
// ---------------------------------------------------------------------------

function ProviderCard({
  provider,
  status,
  onVerify,
  verifying,
}: {
  provider: ProviderInfo;
  status: 'disconnected' | 'connected' | 'invalid';
  onVerify: (provider: ProviderInfo, apiKey: string, meta?: Record<string, string>) => void;
  verifying: boolean;
}) {
  const [apiKey, setApiKey] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bedrock extra fields
  const [bedrockRegion, setBedrockRegion] = useState('us-east-1');
  const [bedrockEndpoint, setBedrockEndpoint] = useState('');

  // Azure extra fields
  const [azureResource, setAzureResource] = useState('');
  const [azureDeployment, setAzureDeployment] = useState('');
  const [azureVersion, setAzureVersion] = useState('2024-10-21');

  const isConnected = status === 'connected';
  const isInvalid = status === 'invalid';

  const canSubmit = apiKey.trim().length > 0 && !verifying &&
    (provider.hasExtraFields !== 'azure' || (azureResource.trim() && azureDeployment.trim()));

  function handleSubmit() {
    setError(null);
    let meta: Record<string, string> | undefined;
    if (provider.hasExtraFields === 'bedrock') {
      meta = { region: bedrockRegion };
      if (bedrockEndpoint.trim()) meta.endpointUrl = bedrockEndpoint.trim();
    } else if (provider.hasExtraFields === 'azure') {
      meta = { resourceName: azureResource, deploymentId: azureDeployment, apiVersion: azureVersion };
    }
    onVerify(provider, apiKey, meta);
  }

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        isConnected
          ? 'border-green-500/30 bg-[#12121a]'
          : isInvalid
            ? 'border-red-500/30 bg-[#12121a]'
            : 'border-[#1e1e2e] bg-[#12121a] hover:border-[#2a2a3a]'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
            style={{ backgroundColor: `${provider.color}15`, color: provider.color }}
          >
            {provider.emoji}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{provider.name}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {provider.freeTier ? (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                  Free tier
                </span>
              ) : (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#1e1e2e] text-gray-500 border border-[#2a2a3a]">
                  Pay-as-you-go
                </span>
              )}
              {provider.freeAmount && (
                <span className="text-[10px] text-gray-500">{provider.freeAmount}</span>
              )}
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="shrink-0">
          {isConnected ? (
            <span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded-lg flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              Connected
            </span>
          ) : isInvalid ? (
            <span className="text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded-lg flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
              Invalid key
            </span>
          ) : (
            <span className="text-xs text-gray-500 bg-[#1e1e2e] px-2 py-1 rounded-lg">
              Not connected
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      {!isConnected && (
        <div className="mt-3">
          {!expanded ? (
            <div className="flex items-center gap-2">
              <a
                href={provider.keyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#1e1e2e] text-gray-300 hover:bg-[#2a2a3a] hover:text-white transition-all"
              >
                Get Key
              </a>
              <button
                onClick={() => setExpanded(true)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all"
              >
                Connect
              </button>
            </div>
          ) : (
            <div className="space-y-2.5 mt-1">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider.keyPlaceholder}
                className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 font-mono"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) handleSubmit(); }}
              />

              {/* Bedrock extra fields */}
              {provider.hasExtraFields === 'bedrock' && (
                <>
                  <input
                    type="text"
                    value={bedrockRegion}
                    onChange={(e) => setBedrockRegion(e.target.value)}
                    placeholder="us-east-1"
                    className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
                  />
                  <input
                    type="text"
                    value={bedrockEndpoint}
                    onChange={(e) => setBedrockEndpoint(e.target.value)}
                    placeholder="Custom endpoint URL (optional)"
                    className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 font-mono"
                  />
                </>
              )}

              {/* Azure extra fields */}
              {provider.hasExtraFields === 'azure' && (
                <>
                  <input
                    type="text"
                    value={azureResource}
                    onChange={(e) => setAzureResource(e.target.value)}
                    placeholder="Resource Name (required)"
                    className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
                  />
                  <input
                    type="text"
                    value={azureDeployment}
                    onChange={(e) => setAzureDeployment(e.target.value)}
                    placeholder="Deployment ID (required)"
                    className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
                  />
                  <input
                    type="text"
                    value={azureVersion}
                    onChange={(e) => setAzureVersion(e.target.value)}
                    placeholder="API Version"
                    className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
                  />
                </>
              )}

              {error && (
                <p className="text-xs text-red-400">{error}</p>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setExpanded(false); setApiKey(''); setError(null); }}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1.5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="flex-1 text-xs font-semibold px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {verifying ? (
                    <>
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Verifying...
                    </>
                  ) : (
                    'Connect & Verify'
                  )}
                </button>
              </div>

              <p className="text-[10px] text-gray-600 text-center">
                <a href={provider.keyUrl} target="_blank" rel="noopener noreferrer" className="text-amber-400/60 hover:text-amber-400">
                  Get your {provider.name} API key
                </a>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

function ProviderSection({
  title,
  description,
  providers,
  connectedSet,
  invalidSet,
  onVerify,
  verifyingId,
  highlight,
}: {
  title: string;
  description: string;
  providers: ProviderInfo[];
  connectedSet: Set<string>;
  invalidSet: Set<string>;
  onVerify: (provider: ProviderInfo, apiKey: string, meta?: Record<string, string>) => void;
  verifyingId: string | null;
  highlight?: boolean;
}) {
  return (
    <section className={`rounded-2xl border p-6 ${highlight ? 'border-amber-500/20 bg-amber-500/5' : 'border-[#1e1e2e] bg-[#0a0a0f]'}`}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {providers.map((p) => (
          <ProviderCard
            key={p.id}
            provider={p}
            status={connectedSet.has(p.id) ? 'connected' : invalidSet.has(p.id) ? 'invalid' : 'disconnected'}
            onVerify={onVerify}
            verifying={verifyingId === p.id}
          />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const [connectedProviders, setConnectedProviders] = useState<Set<string>>(new Set());
  const [invalidProviders, setInvalidProviders] = useState<Set<string>>(new Set());
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  // Load existing connections on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/providers');
        if (res.ok) {
          const data = await res.json();
          setConnectedProviders(new Set(data.map((c: { provider: string }) => c.provider)));
        }
      } catch {
        // Ignore — user may not be authenticated
      }
    }
    load();
  }, []);

  // Trigger celebration when 3+ connected
  useEffect(() => {
    if (connectedProviders.size >= 3 && !showCelebration) {
      setShowCelebration(true);
    }
  }, [connectedProviders.size, showCelebration]);

  async function handleVerify(provider: ProviderInfo, apiKey: string, meta?: Record<string, string>) {
    setVerifyingId(provider.id);
    setGlobalError(null);

    // Remove from invalid set if retrying
    setInvalidProviders((prev) => {
      const next = new Set(prev);
      next.delete(provider.id);
      return next;
    });

    try {
      const res = await fetch('/api/providers/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provider.id, apiKey, ...(meta && { metadata: meta }) }),
      });

      const data = await res.json();

      if (!res.ok) {
        setGlobalError(data.error || 'Verification failed');
        return;
      }

      if (data.valid) {
        setConnectedProviders((prev) => new Set([...prev, provider.id]));
      } else {
        setInvalidProviders((prev) => new Set([...prev, provider.id]));
        setGlobalError(`Key rejected by ${provider.name}. ${data.error || 'Please check and try again.'}`);
      }
    } catch {
      setGlobalError('Network error. Please check your connection and try again.');
    } finally {
      setVerifyingId(null);
    }
  }

  const connectedCount = connectedProviders.size;
  const progressPct = Math.min(100, (connectedCount / TOTAL_PROVIDERS) * 100);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Provider Setup</h1>
          <p className="text-gray-500 mt-1">
            Connect your LLM providers so InferLane can auto-route across them for best price, speed, and quality.
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">
              <span className="text-white font-semibold">{connectedCount}</span> of {TOTAL_PROVIDERS} providers connected
            </span>
            <span className="text-gray-500">{Math.round(progressPct)}%</span>
          </div>
          <div className="h-2 rounded-full bg-[#1e1e2e] overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Celebration */}
        {showCelebration && (
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-400 text-lg shrink-0">
              &#10003;
            </div>
            <div>
              <p className="text-sm font-semibold text-green-400">
                {"You're set! InferLane can now auto-route across " + connectedCount + " providers."}
              </p>
              <p className="text-xs text-green-400/60 mt-0.5">
                Connect more to unlock even better routing options.
              </p>
            </div>
          </div>
        )}

        {/* Global error */}
        {globalError && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
            <p className="text-sm text-red-400">{globalError}</p>
          </div>
        )}

        {/* Sections */}
        <ProviderSection
          title="Recommended (Free Tier)"
          description="These providers offer generous free tiers — connect them first to get started at no cost."
          providers={RECOMMENDED}
          connectedSet={connectedProviders}
          invalidSet={invalidProviders}
          onVerify={handleVerify}
          verifyingId={verifyingId}
          highlight
        />

        <ProviderSection
          title="Popular (Paid)"
          description="Industry-leading models. Most offer free signup credits."
          providers={POPULAR}
          connectedSet={connectedProviders}
          invalidSet={invalidProviders}
          onVerify={handleVerify}
          verifyingId={verifyingId}
        />

        <ProviderSection
          title="Advanced"
          description="Enterprise cloud providers and specialized GPU compute platforms."
          providers={ADVANCED}
          connectedSet={connectedProviders}
          invalidSet={invalidProviders}
          onVerify={handleVerify}
          verifyingId={verifyingId}
        />

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-[#1e1e2e]">
          <p className="text-xs text-gray-600">
            All API keys are encrypted with AES-256-GCM before storage.
          </p>
          <Link
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-white transition-colors"
          >
            Skip for now
          </Link>
        </div>
      </div>
    </div>
  );
}
