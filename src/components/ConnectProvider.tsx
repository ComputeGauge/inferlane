'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTrack, EVENTS } from '@/hooks/useTrack';

interface ConnectableProvider {
  id: string;
  name: string;
  color: string;
  description: string;
  apiKeyPlaceholder: string;
  docsUrl: string;
}

const AVAILABLE_PROVIDERS: ConnectableProvider[] = [
  { id: 'ANTHROPIC', name: 'Anthropic', color: '#d4a27f', description: 'Claude Opus, Sonnet, Haiku', apiKeyPlaceholder: 'sk-ant-...', docsUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'OPENAI', name: 'OpenAI', color: '#10a37f', description: 'GPT-4o, o1, DALL-E', apiKeyPlaceholder: 'sk-...', docsUrl: 'https://platform.openai.com/api-keys' },
  { id: 'GOOGLE', name: 'Google AI', color: '#4285f4', description: 'Gemini Pro, Flash', apiKeyPlaceholder: 'AIza...', docsUrl: 'https://aistudio.google.com/apikey' },
  { id: 'TOGETHER', name: 'Together AI', color: '#ff6b35', description: 'Llama, Mixtral, open models', apiKeyPlaceholder: 'tog_...', docsUrl: 'https://api.together.ai/settings/api-keys' },
  { id: 'AWS_BEDROCK', name: 'AWS Bedrock', color: '#ff9900', description: 'Claude, Llama via AWS', apiKeyPlaceholder: 'AKIA...', docsUrl: 'https://console.aws.amazon.com/' },
  { id: 'AZURE_OPENAI', name: 'Azure OpenAI', color: '#0078d4', description: 'GPT-4o via Azure', apiKeyPlaceholder: 'azure-key...', docsUrl: 'https://portal.azure.com/' },
  { id: 'REPLICATE', name: 'Replicate', color: '#e44dba', description: 'Open source models', apiKeyPlaceholder: 'r8_...', docsUrl: 'https://replicate.com/account/api-tokens' },
  { id: 'FIREWORKS', name: 'Fireworks AI', color: '#ff4500', description: 'Fast open model inference', apiKeyPlaceholder: 'fw_...', docsUrl: 'https://fireworks.ai/account/api-keys' },
  { id: 'GROQ', name: 'Groq', color: '#f55036', description: 'Ultra-fast LPU inference', apiKeyPlaceholder: 'gsk_...', docsUrl: 'https://console.groq.com/keys' },
  { id: 'DEEPSEEK', name: 'DeepSeek', color: '#4a6cf7', description: 'DeepSeek R1, Coder', apiKeyPlaceholder: 'sk-...', docsUrl: 'https://platform.deepseek.com/api_keys' },
  { id: 'XAI', name: 'xAI (Grok)', color: '#1d9bf0', description: 'Grok-3, Grok-3 Mini', apiKeyPlaceholder: 'xai-...', docsUrl: 'https://console.x.ai/' },
  { id: 'PERPLEXITY', name: 'Perplexity', color: '#20b2aa', description: 'Sonar Pro, Deep Research', apiKeyPlaceholder: 'pplx-...', docsUrl: 'https://www.perplexity.ai/settings/api' },
  { id: 'CEREBRAS', name: 'Cerebras', color: '#ff6b6b', description: 'Ultra-fast Llama inference', apiKeyPlaceholder: 'cbs-...', docsUrl: 'https://cloud.cerebras.ai/' },
  { id: 'SAMBANOVA', name: 'SambaNova', color: '#7c3aed', description: 'Llama, Qwen at speed', apiKeyPlaceholder: 'snva-...', docsUrl: 'https://cloud.sambanova.ai/' },
  { id: 'MISTRAL', name: 'Mistral AI', color: '#ff7000', description: 'Mistral Large, Codestral', apiKeyPlaceholder: 'mist-...', docsUrl: 'https://console.mistral.ai/api-keys' },
  { id: 'COHERE', name: 'Cohere', color: '#39594d', description: 'Command R+, Embed, Rerank', apiKeyPlaceholder: 'co-...', docsUrl: 'https://dashboard.cohere.com/api-keys' },
  { id: 'MODAL', name: 'Modal', color: '#00c853', description: 'Serverless GPU inference', apiKeyPlaceholder: 'ak-...', docsUrl: 'https://modal.com/docs' },
  { id: 'LAMBDA', name: 'Lambda', color: '#6c3dab', description: 'GPU cloud inference', apiKeyPlaceholder: 'lambda-...', docsUrl: 'https://docs.lambdalabs.com' },
  { id: 'COREWEAVE', name: 'CoreWeave', color: '#00b4d8', description: 'GPU cloud compute', apiKeyPlaceholder: 'cw-...', docsUrl: 'https://docs.coreweave.com' },
];

export default function ConnectProvider() {
  const [showModal, setShowModal] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<ConnectableProvider | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [connectedProviders, setConnectedProviders] = useState<Set<string>>(new Set());
  // Metadata fields for AWS Bedrock and Azure OpenAI
  const [bedrockRegion, setBedrockRegion] = useState('us-east-1');
  const [bedrockEndpointUrl, setBedrockEndpointUrl] = useState('');
  const [azureResourceName, setAzureResourceName] = useState('');
  const [azureDeploymentId, setAzureDeploymentId] = useState('');
  const [azureApiVersion, setAzureApiVersion] = useState('2024-10-21');
  const track = useTrack();

  async function loadConnected() {
    try {
      const res = await fetch('/api/providers');
      if (res.ok) {
        const data = await res.json();
        setConnectedProviders(new Set(data.map((c: { provider: string }) => c.provider)));
      }
    } catch {
      // Not authenticated or demo mode
    }
  }

  const closeModal = useCallback(() => {
    setShowModal(false);
    setConnectingProvider(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!showModal) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showModal, closeModal]);

  function openModal() {
    setShowModal(true);
    loadConnected();
  }

  async function connectProvider() {
    if (!connectingProvider || !apiKeyInput.trim()) return;
    setSaving(true);
    setError(null);

    try {
      // Build provider-specific metadata
      let metadata: Record<string, string> | undefined;
      if (connectingProvider.id === 'AWS_BEDROCK') {
        metadata = { region: bedrockRegion };
        if (bedrockEndpointUrl.trim()) {
          metadata.endpointUrl = bedrockEndpointUrl.trim();
        }
      } else if (connectingProvider.id === 'AZURE_OPENAI') {
        metadata = {
          resourceName: azureResourceName,
          deploymentId: azureDeploymentId,
          apiVersion: azureApiVersion,
        };
      }

      const res = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: connectingProvider.id,
          apiKey: apiKeyInput,
          displayName: displayName || connectingProvider.name,
          ...(metadata && { metadata }),
        }),
      });

      if (res.ok) {
        track(EVENTS.PROVIDER_CONNECTED, { provider: connectingProvider.id, name: connectingProvider.name });
        setSuccess(`${connectingProvider.name} connected!`);
        setConnectedProviders(prev => new Set([...prev, connectingProvider.id]));
        setConnectingProvider(null);
        setApiKeyInput('');
        setDisplayName('');
        setBedrockRegion('us-east-1');
        setBedrockEndpointUrl('');
        setAzureResourceName('');
        setAzureDeploymentId('');
        setAzureApiVersion('2024-10-21');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to connect provider');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="flex items-center gap-2 px-4 py-2 bg-[#12121a] border border-[#1e1e2e] rounded-xl text-sm text-gray-300 hover:border-[#3a3a4a] hover:text-white transition-all"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Connect Provider
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Connect AI provider">
          <div className="bg-[#12121a] rounded-2xl border border-[#1e1e2e] w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-[#1e1e2e]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  {connectingProvider ? `Connect ${connectingProvider.name}` : 'Connect Providers'}
                </h2>
                <button
                  onClick={closeModal}
                  aria-label="Close provider dialog"
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {connectingProvider
                  ? 'Enter your API key. It will be encrypted with AES-256-GCM before storage.'
                  : 'Connect your AI provider API keys to track spend in real-time.'
                }
              </p>
            </div>

            {success && (
              <div className="mx-4 mt-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                <p className="text-sm text-green-400">{success}</p>
              </div>
            )}

            {error && (
              <div className="mx-4 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {connectingProvider ? (
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">
                    {connectingProvider.id === 'AWS_BEDROCK' ? 'API Gateway API Key or AWS Access Key'
                      : connectingProvider.id === 'AZURE_OPENAI' ? 'Azure API Key'
                      : 'API Key'}
                  </label>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={connectingProvider.apiKeyPlaceholder}
                    className="w-full mt-1 px-4 py-2.5 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 font-mono"
                    autoFocus
                  />
                </div>

                {/* AWS Bedrock metadata fields */}
                {connectingProvider.id === 'AWS_BEDROCK' && (
                  <>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Region</label>
                      <input
                        type="text"
                        value={bedrockRegion}
                        onChange={(e) => setBedrockRegion(e.target.value)}
                        placeholder="us-east-1"
                        className="w-full mt-1 px-4 py-2.5 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Custom Endpoint URL (optional)</label>
                      <input
                        type="text"
                        value={bedrockEndpointUrl}
                        onChange={(e) => setBedrockEndpointUrl(e.target.value)}
                        placeholder="https://your-api-gateway.execute-api.us-east-1.amazonaws.com"
                        className="w-full mt-1 px-4 py-2.5 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 font-mono"
                      />
                    </div>
                    <p className="text-xs text-gray-600">
                      Set up an API Gateway in your AWS account that proxies to Bedrock, then enter the endpoint URL here.
                    </p>
                  </>
                )}

                {/* Azure OpenAI metadata fields */}
                {connectingProvider.id === 'AZURE_OPENAI' && (
                  <>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Resource Name</label>
                      <input
                        type="text"
                        value={azureResourceName}
                        onChange={(e) => setAzureResourceName(e.target.value)}
                        placeholder="my-openai-resource"
                        className="w-full mt-1 px-4 py-2.5 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Deployment ID</label>
                      <input
                        type="text"
                        value={azureDeploymentId}
                        onChange={(e) => setAzureDeploymentId(e.target.value)}
                        placeholder="gpt-4o"
                        className="w-full mt-1 px-4 py-2.5 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">API Version</label>
                      <input
                        type="text"
                        value={azureApiVersion}
                        onChange={(e) => setAzureApiVersion(e.target.value)}
                        placeholder="2024-10-21"
                        className="w-full mt-1 px-4 py-2.5 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    <p className="text-xs text-gray-600">
                      Find these values in your Azure OpenAI resource settings.
                    </p>
                  </>
                )}

                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Display Name (optional)</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={connectingProvider.name}
                    className="w-full mt-1 px-4 py-2.5 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => { setConnectingProvider(null); setApiKeyInput(''); setError(null); setBedrockRegion('us-east-1'); setBedrockEndpointUrl(''); setAzureResourceName(''); setAzureDeploymentId(''); setAzureApiVersion('2024-10-21'); }}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={connectProvider}
                    disabled={saving || !apiKeyInput.trim() || (connectingProvider.id === 'AZURE_OPENAI' && (!azureResourceName.trim() || !azureDeploymentId.trim()))}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold rounded-xl hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    {saving ? 'Encrypting & Saving...' : 'Connect'}
                  </button>
                </div>
                <p className="text-xs text-gray-600 text-center">
                  <a href={connectingProvider.docsUrl} target="_blank" rel="noopener noreferrer" className="text-amber-400/60 hover:text-amber-400">
                    Get your {connectingProvider.name} API key
                  </a>
                </p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {AVAILABLE_PROVIDERS.map((p) => {
                  const isConnected = connectedProviders.has(p.id);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-[#1a1a2a] hover:border-[#2a2a3a] transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
                          style={{ backgroundColor: `${p.color}15`, color: p.color }}
                        >
                          {p.name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.description}</p>
                        </div>
                      </div>
                      {isConnected ? (
                        <span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded-lg flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                          Connected
                        </span>
                      ) : (
                        <button
                          onClick={() => setConnectingProvider(p)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#1e1e2e] text-gray-300 hover:bg-[#2a2a3a] hover:text-white transition-all"
                        >
                          Connect
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="p-4 border-t border-[#1e1e2e]">
              <p className="text-xs text-gray-600 text-center">
                API keys are encrypted with AES-256-GCM before storage.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
