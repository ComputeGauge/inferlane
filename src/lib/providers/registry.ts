// ============================================================================
// Provider Registry — Single source of truth for all AI provider metadata
// Consumed by: proxy, ConnectProvider, marketplace, Smart Router, MCP
// ============================================================================

export interface ProviderEntry {
  id: string;
  name: string;
  baseUrl: string | null;          // null for compute-only providers (Modal, Lambda, CoreWeave)
  color: string;
  apiKeyPlaceholder: string;
  docsUrl: string;
  signupUrl: string;
  affiliateUrl: string | null;     // tracked signup link (null if no affiliate program)
  affiliateNetwork: string | null; // "cj", "amazon_associates", "dub", "direct", null
  authStyle: 'bearer' | 'x-api-key' | 'query-param';
  authVersionHeader?: string;      // e.g. "anthropic-version: 2023-06-01"
  requestFormat: 'openai-compat' | 'anthropic' | 'google';
  isInferenceProvider: boolean;
  description: string;
  categories: ('compute' | 'inference' | 'platform' | 'fine-tuning')[];
}

export const PROVIDER_REGISTRY: Record<string, ProviderEntry> = {
  ANTHROPIC: {
    id: 'ANTHROPIC',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    color: '#d4a27f',
    apiKeyPlaceholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    signupUrl: 'https://console.anthropic.com/',
    affiliateUrl: null,
    affiliateNetwork: null,
    authStyle: 'x-api-key',
    authVersionHeader: 'anthropic-version: 2023-06-01',
    requestFormat: 'anthropic',
    isInferenceProvider: true,
    description: 'Claude Opus, Sonnet, Haiku',
    categories: ['inference'],
  },
  OPENAI: {
    id: 'OPENAI',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    color: '#10a37f',
    apiKeyPlaceholder: 'sk-...',
    docsUrl: 'https://platform.openai.com/api-keys',
    signupUrl: 'https://platform.openai.com/signup',
    affiliateUrl: null,
    affiliateNetwork: null,
    authStyle: 'bearer',
    requestFormat: 'openai-compat',
    isInferenceProvider: true,
    description: 'GPT-4o, o1, DALL-E',
    categories: ['inference'],
  },
  GOOGLE: {
    id: 'GOOGLE',
    name: 'Google AI',
    baseUrl: 'https://generativelanguage.googleapis.com',
    color: '#4285f4',
    apiKeyPlaceholder: 'AIza...',
    docsUrl: 'https://aistudio.google.com/apikey',
    signupUrl: 'https://aistudio.google.com/',
    affiliateUrl: null, // Google Cloud affiliate is via CJ, not Google AI Studio
    affiliateNetwork: 'cj',
    authStyle: 'query-param',
    requestFormat: 'google',
    isInferenceProvider: true,
    description: 'Gemini Pro, Flash, Gemma 4',
    categories: ['inference'],
  },
  OLLAMA: {
    id: 'OLLAMA',
    name: 'Ollama',
    baseUrl: 'http://localhost:11434',
    color: '#ffffff',
    apiKeyPlaceholder: '(none — local)',
    docsUrl: 'https://ollama.com/library',
    signupUrl: 'https://ollama.com/download',
    affiliateUrl: null,
    affiliateNetwork: null,
    authStyle: 'bearer',
    requestFormat: 'openai-compat',
    isInferenceProvider: true,
    description: 'Local inference — Gemma 4, Llama, DeepSeek, Qwen, Mistral (zero cost)',
    categories: ['inference'],
  },
  AWS_BEDROCK: {
    id: 'AWS_BEDROCK',
    name: 'AWS Bedrock',
    baseUrl: null, // Uses AWS SDK, not direct HTTP
    color: '#ff9900',
    apiKeyPlaceholder: 'AKIA...',
    docsUrl: 'https://console.aws.amazon.com/',
    signupUrl: 'https://aws.amazon.com/bedrock/',
    affiliateUrl: null, // Use Amazon Associates
    affiliateNetwork: 'amazon_associates',
    authStyle: 'bearer',
    requestFormat: 'openai-compat',
    isInferenceProvider: true,
    description: 'Claude, Llama via AWS',
    categories: ['compute', 'inference'],
  },
  AZURE_OPENAI: {
    id: 'AZURE_OPENAI',
    name: 'Azure OpenAI',
    baseUrl: null, // Uses Azure endpoint per deployment
    color: '#0078d4',
    apiKeyPlaceholder: 'azure-key...',
    docsUrl: 'https://portal.azure.com/',
    signupUrl: 'https://azure.microsoft.com/en-us/products/ai-services/openai-service',
    affiliateUrl: null,
    affiliateNetwork: null,
    authStyle: 'bearer',
    requestFormat: 'openai-compat',
    isInferenceProvider: true,
    description: 'GPT-4o via Azure',
    categories: ['compute', 'inference'],
  },
  TOGETHER: {
    id: 'TOGETHER',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz',
    color: '#ff6b35',
    apiKeyPlaceholder: 'tog_...',
    docsUrl: 'https://api.together.ai/settings/api-keys',
    signupUrl: 'https://api.together.xyz/',
    affiliateUrl: null,
    affiliateNetwork: null,
    authStyle: 'bearer',
    requestFormat: 'openai-compat',
    isInferenceProvider: true,
    description: 'Llama, Mixtral, open models',
    categories: ['inference'],
  },
  GROQ: {
    id: 'GROQ',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai',
    color: '#f55036',
    apiKeyPlaceholder: 'gsk_...',
    docsUrl: 'https://console.groq.com/keys',
    signupUrl: 'https://console.groq.com/',
    affiliateUrl: null,
    affiliateNetwork: null,
    authStyle: 'bearer',
    requestFormat: 'openai-compat',
    isInferenceProvider: true,
    description: 'Ultra-fast LPU inference',
    categories: ['inference'],
  },
  MISTRAL: {
    id: 'MISTRAL',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai',
    color: '#ff7000',
    apiKeyPlaceholder: 'mist_...',
    docsUrl: 'https://console.mistral.ai/api-keys',
    signupUrl: 'https://console.mistral.ai/',
    affiliateUrl: null,
    affiliateNetwork: null,
    authStyle: 'bearer',
    requestFormat: 'openai-compat',
    isInferenceProvider: true,
    description: 'Mistral Large, Codestral',
    categories: ['inference'],
  },
  COHERE: {
    id: 'COHERE',
    name: 'Cohere',
    baseUrl: 'https://api.cohere.com',
    color: '#39594d',
    apiKeyPlaceholder: 'co_...',
    docsUrl: 'https://dashboard.cohere.com/api-keys',
    signupUrl: 'https://dashboard.cohere.com/',
    affiliateUrl: null,
    affiliateNetwork: null,
    authStyle: 'bearer',
    requestFormat: 'openai-compat',
    isInferenceProvider: true,
    description: 'Command R+, Embed',
    categories: ['inference'],
  },
  REPLICATE: {
    id: 'REPLICATE',
    name: 'Replicate',
    baseUrl: 'https://api.replicate.com',
    color: '#e44dba',
    apiKeyPlaceholder: 'r8_...',
    docsUrl: 'https://replicate.com/account/api-tokens',
    signupUrl: 'https://replicate.com/',
    affiliateUrl: null,
    affiliateNetwork: null,
    authStyle: 'bearer',
    requestFormat: 'openai-compat',
    isInferenceProvider: true,
    description: 'Open source models',
    categories: ['platform', 'inference'],
  },
  DEEPSEEK: {
    id: 'DEEPSEEK',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    color: '#4a6cf7',
    apiKeyPlaceholder: 'sk-...',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    signupUrl: 'https://platform.deepseek.com/',
    affiliateUrl: null,
    affiliateNetwork: null,
    authStyle: 'bearer',
    requestFormat: 'openai-compat',
    isInferenceProvider: true,
    description: 'DeepSeek R1, Coder, V3',
    categories: ['inference'],
  },
  FIREWORKS: {
    id: 'FIREWORKS',
    name: 'Fireworks AI',
    baseUrl: 'https://api.fireworks.ai',
    color: '#ff4500',
    apiKeyPlaceholder: 'fw_...',
    docsUrl: 'https://fireworks.ai/account/api-keys',
    signupUrl: 'https://fireworks.ai/',
    affiliateUrl: null,
    affiliateNetwork: null,
    authStyle: 'bearer',
    requestFormat: 'openai-compat',
    isInferenceProvider: true,
    description: 'Fast open model inference',
    categories: ['inference'],
  },

  // ── New Providers ──────────────────────────────────────────────

  XAI: {
    id: 'XAI',
    name: 'xAI (Grok)',
    baseUrl: 'https://api.x.ai',
    color: '#1d9bf0',
    apiKeyPlaceholder: 'xai-...',
    docsUrl: 'https://console.x.ai/',
    signupUrl: 'https://console.x.ai/',
    affiliateUrl: null,
    affiliateNetwork: null,
    authStyle: 'bearer',
    requestFormat: 'openai-compat',
    isInferenceProvider: true,
    description: 'Grok-3, Grok-3 Mini',
    categories: ['inference'],
  },
  PERPLEXITY: {
    id: 'PERPLEXITY',
    name: 'Perplexity',
    baseUrl: 'https://api.perplexity.ai',
    color: '#20b2aa',
    apiKeyPlaceholder: 'pplx-...',
    docsUrl: 'https://www.perplexity.ai/settings/api',
    signupUrl: 'https://www.perplexity.ai/',
    affiliateUrl: 'https://partners.dub.co/perplexity',
    affiliateNetwork: 'dub',
    authStyle: 'bearer',
    requestFormat: 'openai-compat',
    isInferenceProvider: true,
    description: 'Sonar Pro, Sonar, Deep Research',
    categories: ['inference'],
  },
  CEREBRAS: {
    id: 'CEREBRAS',
    name: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai',
    color: '#ff6b6b',
    apiKeyPlaceholder: 'cbs-...',
    docsUrl: 'https://cloud.cerebras.ai/',
    signupUrl: 'https://cloud.cerebras.ai/',
    affiliateUrl: null,
    affiliateNetwork: null,
    authStyle: 'bearer',
    requestFormat: 'openai-compat',
    isInferenceProvider: true,
    description: 'Ultra-fast wafer-scale inference',
    categories: ['inference'],
  },
  SAMBANOVA: {
    id: 'SAMBANOVA',
    name: 'SambaNova',
    baseUrl: 'https://api.sambanova.ai',
    color: '#7c3aed',
    apiKeyPlaceholder: 'snva-...',
    docsUrl: 'https://cloud.sambanova.ai/',
    signupUrl: 'https://cloud.sambanova.ai/',
    affiliateUrl: null,
    affiliateNetwork: null,
    authStyle: 'bearer',
    requestFormat: 'openai-compat',
    isInferenceProvider: true,
    description: 'Llama, Qwen at speed',
    categories: ['inference'],
  },

  // ── Compute-Only Providers (no inference endpoint) ─────────────

  MODAL: {
    id: 'MODAL',
    name: 'Modal',
    baseUrl: null,
    color: '#00d4aa',
    apiKeyPlaceholder: '',
    docsUrl: 'https://modal.com/docs',
    signupUrl: 'https://modal.com/',
    affiliateUrl: null,
    affiliateNetwork: null,
    authStyle: 'bearer',
    requestFormat: 'openai-compat',
    isInferenceProvider: false,
    description: 'Serverless GPU compute',
    categories: ['compute'],
  },
  LAMBDA: {
    id: 'LAMBDA',
    name: 'Lambda Labs',
    baseUrl: null,
    color: '#6c2eb9',
    apiKeyPlaceholder: '',
    docsUrl: 'https://lambda.ai/docs',
    signupUrl: 'https://lambda.ai/',
    affiliateUrl: null,
    affiliateNetwork: null,
    authStyle: 'bearer',
    requestFormat: 'openai-compat',
    isInferenceProvider: false,
    description: 'GPU cloud for AI training',
    categories: ['compute'],
  },
  COREWEAVE: {
    id: 'COREWEAVE',
    name: 'CoreWeave',
    baseUrl: null,
    color: '#00b4d8',
    apiKeyPlaceholder: '',
    docsUrl: 'https://docs.coreweave.com/',
    signupUrl: 'https://coreweave.com/',
    affiliateUrl: null,
    affiliateNetwork: null,
    authStyle: 'bearer',
    requestFormat: 'openai-compat',
    isInferenceProvider: false,
    description: 'GPU-specialized cloud',
    categories: ['compute'],
  },
  DARKBLOOM: {
    id: 'DARKBLOOM',
    name: 'Darkbloom',
    baseUrl: 'https://api.darkbloom.dev',
    color: '#1a1a2e',
    apiKeyPlaceholder: 'dk_...',
    docsUrl: 'https://docs.darkbloom.dev/',
    signupUrl: 'https://darkbloom.dev/',
    affiliateUrl: null,
    affiliateNetwork: null,
    authStyle: 'bearer',
    requestFormat: 'openai-compat',
    isInferenceProvider: true,
    description: 'Decentralized inference on idle Apple Silicon Macs',
    categories: ['inference'],
  },
  AKASH: {
    id: 'AKASH',
    name: 'Akash (AkashML)',
    baseUrl: 'https://chatapi.akash.network',
    color: '#ff414c',
    apiKeyPlaceholder: 'ak_...',
    docsUrl: 'https://akash.network/docs/',
    signupUrl: 'https://akash.network/',
    affiliateUrl: null,
    affiliateNetwork: null,
    authStyle: 'bearer',
    requestFormat: 'openai-compat',
    isInferenceProvider: true,
    description: 'Decentralized GPU cloud with reverse auction pricing (Cosmos)',
    categories: ['inference', 'compute'],
  },
  NOSANA: {
    id: 'NOSANA',
    name: 'Nosana',
    baseUrl: 'https://api.nosana.io',
    color: '#00d181',
    apiKeyPlaceholder: 'nos_...',
    docsUrl: 'https://docs.nosana.com/',
    signupUrl: 'https://nosana.com/',
    affiliateUrl: null,
    affiliateNetwork: null,
    authStyle: 'bearer',
    requestFormat: 'openai-compat',
    isInferenceProvider: true,
    description: 'Solana-based decentralized GPU marketplace for AI inference',
    categories: ['inference', 'compute'],
  },
  CHUTES: {
    id: 'CHUTES',
    name: 'Chutes (Bittensor SN64)',
    baseUrl: 'https://api.chutes.ai',
    color: '#7c3aed',
    apiKeyPlaceholder: 'cpk_...',
    docsUrl: 'https://chutes.ai/docs',
    signupUrl: 'https://chutes.ai/',
    affiliateUrl: null,
    affiliateNetwork: null,
    authStyle: 'bearer',
    requestFormat: 'openai-compat',
    isInferenceProvider: true,
    description: 'Bittensor subnet 64 — serverless decentralized AI inference (5M+ req/day)',
    categories: ['inference'],
  },
};

/** Get all inference providers (those with a baseUrl for proxy routing) */
export function getInferenceProviders(): ProviderEntry[] {
  return Object.values(PROVIDER_REGISTRY).filter(p => p.isInferenceProvider && p.baseUrl);
}

/** Get all connectable providers (inference providers users can add API keys for) */
export function getConnectableProviders(): ProviderEntry[] {
  return Object.values(PROVIDER_REGISTRY).filter(p => p.isInferenceProvider);
}

/** Get all marketplace providers (everything including compute-only) */
export function getMarketplaceProviders(): ProviderEntry[] {
  return Object.values(PROVIDER_REGISTRY);
}

/** Get provider base URLs map for the proxy route */
export function getProxyUrlMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of Object.values(PROVIDER_REGISTRY)) {
    if (p.baseUrl) {
      map[p.id] = p.baseUrl;
    }
  }
  return map;
}

/** Get auth headers for a provider given the API key */
export function getProviderAuthHeaders(providerId: string, apiKey: string): Record<string, string> {
  const provider = PROVIDER_REGISTRY[providerId];
  if (!provider) return {};

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  switch (provider.authStyle) {
    case 'bearer':
      headers['Authorization'] = `Bearer ${apiKey}`;
      break;
    case 'x-api-key':
      headers['x-api-key'] = apiKey;
      if (provider.authVersionHeader) {
        const [key, value] = provider.authVersionHeader.split(': ');
        headers[key] = value;
      }
      break;
    case 'query-param':
      // Handled in URL construction, not headers
      break;
  }

  return headers;
}
