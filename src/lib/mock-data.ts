import { ProviderConfig, SpendSnapshot, Alert } from './types';

// Generate realistic daily spend data
function generateDailySpend(avg: number, days: number): number[] {
  return Array.from({ length: days }, () =>
    Math.max(0, avg + (Math.random() - 0.5) * avg * 0.6)
  );
}

export const providers: ProviderConfig[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: '/anthropic.svg',
    color: '#d4a27f',
    gradientFrom: '#d4a27f',
    gradientTo: '#a67c5b',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    monthlyBudget: 100,
    currentSpend: 67.42,
    dailySpend: generateDailySpend(4.5, 30),
    topUpUrl: 'https://console.anthropic.com/settings/billing',
    partnerUrl: 'https://aws.amazon.com/bedrock/claude/',
    models: [
      {
        name: 'Claude Opus 4',
        inputTokens: 2_150_000,
        outputTokens: 890_000,
        cost: 38.20,
        inputPricePer1M: 15,
        outputPricePer1M: 75,
      },
      {
        name: 'Claude Sonnet 4',
        inputTokens: 5_400_000,
        outputTokens: 2_100_000,
        cost: 22.80,
        inputPricePer1M: 3,
        outputPricePer1M: 15,
      },
      {
        name: 'Claude Haiku 3.5',
        inputTokens: 12_000_000,
        outputTokens: 4_500_000,
        cost: 6.42,
        inputPricePer1M: 0.25,
        outputPricePer1M: 1.25,
      },
    ],
    cloudAlternatives: [
      { provider: 'AWS Bedrock', name: 'Claude via Bedrock', savingsPercent: 0, url: 'https://aws.amazon.com/bedrock/', logo: '🟠' },
      { provider: 'GCP Vertex', name: 'Claude via Vertex', savingsPercent: 0, url: 'https://cloud.google.com/vertex-ai', logo: '🔵' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '/openai.svg',
    color: '#10a37f',
    gradientFrom: '#10a37f',
    gradientTo: '#0d8c6d',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    monthlyBudget: 80,
    currentSpend: 43.18,
    dailySpend: generateDailySpend(3.2, 30),
    topUpUrl: 'https://platform.openai.com/account/billing',
    partnerUrl: 'https://azure.microsoft.com/en-us/products/ai-services/openai-service',
    models: [
      {
        name: 'GPT-4o',
        inputTokens: 8_200_000,
        outputTokens: 3_100_000,
        cost: 26.50,
        inputPricePer1M: 2.5,
        outputPricePer1M: 10,
      },
      {
        name: 'GPT-4o-mini',
        inputTokens: 22_000_000,
        outputTokens: 8_500_000,
        cost: 10.78,
        inputPricePer1M: 0.15,
        outputPricePer1M: 0.6,
      },
      {
        name: 'o1',
        inputTokens: 500_000,
        outputTokens: 200_000,
        cost: 5.90,
        inputPricePer1M: 15,
        outputPricePer1M: 60,
      },
    ],
    cloudAlternatives: [
      { provider: 'Azure OpenAI', name: 'GPT-4o via Azure', savingsPercent: 5, url: 'https://azure.microsoft.com/en-us/products/ai-services/openai-service', logo: '🔷' },
    ],
  },
  {
    id: 'google',
    name: 'Google AI',
    icon: '/google.svg',
    color: '#4285f4',
    gradientFrom: '#4285f4',
    gradientTo: '#2b6ce0',
    apiKeyEnvVar: 'GOOGLE_AI_API_KEY',
    monthlyBudget: 50,
    currentSpend: 18.55,
    dailySpend: generateDailySpend(1.8, 30),
    topUpUrl: 'https://aistudio.google.com/',
    partnerUrl: 'https://cloud.google.com/vertex-ai',
    models: [
      {
        name: 'Gemini 2.0 Pro',
        inputTokens: 4_800_000,
        outputTokens: 1_900_000,
        cost: 12.45,
        inputPricePer1M: 1.25,
        outputPricePer1M: 5,
      },
      {
        name: 'Gemini 2.0 Flash',
        inputTokens: 18_000_000,
        outputTokens: 7_200_000,
        cost: 6.10,
        inputPricePer1M: 0.075,
        outputPricePer1M: 0.3,
      },
    ],
    cloudAlternatives: [
      { provider: 'GCP Vertex', name: 'Gemini via Vertex', savingsPercent: 10, url: 'https://cloud.google.com/vertex-ai', logo: '🔵' },
    ],
  },
  {
    id: 'together',
    name: 'Together AI',
    icon: '/together.svg',
    color: '#ff6b35',
    gradientFrom: '#ff6b35',
    gradientTo: '#e55a2b',
    apiKeyEnvVar: 'TOGETHER_API_KEY',
    monthlyBudget: 30,
    currentSpend: 8.90,
    dailySpend: generateDailySpend(0.9, 30),
    topUpUrl: 'https://api.together.xyz/settings/billing',
    partnerUrl: 'https://api.together.xyz/',
    models: [
      {
        name: 'Llama 3.1 405B',
        inputTokens: 6_000_000,
        outputTokens: 2_400_000,
        cost: 5.40,
        inputPricePer1M: 0.88,
        outputPricePer1M: 0.88,
      },
      {
        name: 'Mixtral 8x22B',
        inputTokens: 8_000_000,
        outputTokens: 3_200_000,
        cost: 3.50,
        inputPricePer1M: 0.6,
        outputPricePer1M: 0.6,
      },
    ],
    cloudAlternatives: [],
  },
];

export const spendHistory: SpendSnapshot[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - i));
  return {
    date: date.toISOString().split('T')[0],
    anthropic: providers[0].dailySpend[i],
    openai: providers[1].dailySpend[i],
    google: providers[2].dailySpend[i],
    other: providers[3].dailySpend[i],
    total: providers[0].dailySpend[i] + providers[1].dailySpend[i] + providers[2].dailySpend[i] + providers[3].dailySpend[i],
  };
});

export const alerts: Alert[] = [
  {
    id: '1',
    providerId: 'anthropic',
    providerName: 'Anthropic',
    type: 'warning',
    message: 'Anthropic spend at 67% of monthly budget',
    threshold: 60,
    triggered: true,
    timestamp: new Date(Date.now() - 3600000),
  },
  {
    id: '2',
    providerId: 'openai',
    providerName: 'OpenAI',
    type: 'info',
    message: 'OpenAI spend at 54% of monthly budget',
    threshold: 50,
    triggered: true,
    timestamp: new Date(Date.now() - 7200000),
  },
  {
    id: '3',
    providerId: 'anthropic',
    providerName: 'Anthropic',
    type: 'critical',
    message: 'Projected to exceed Anthropic budget by Feb 28',
    threshold: 90,
    triggered: true,
    timestamp: new Date(Date.now() - 1800000),
  },
];

// costComparisons data lives in pricing-data.ts (single source of truth)

export function getTotalSpend(): number {
  return providers.reduce((sum, p) => sum + p.currentSpend, 0);
}

export function getTotalBudget(): number {
  return providers.reduce((sum, p) => sum + p.monthlyBudget, 0);
}

export function getProjectedMonthlySpend(): number {
  const today = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const dailyRate = getTotalSpend() / today;
  return dailyRate * daysInMonth;
}
