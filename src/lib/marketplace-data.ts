export interface MarketplaceListing {
  id: string;
  name: string;
  logo: string;
  color: string;
  category: 'compute' | 'platform' | 'tooling' | 'inference' | 'fine-tuning';
  tagline: string;
  description: string;
  tier: 'featured' | 'partner' | 'standard';
  pricing: string;
  promoOffer?: string;
  promoExpiry?: string;
  affiliateCommission: AffiliateCommission;
  stats: {
    users?: string;
    rating?: number;
    uptime?: string;
  };
  features: string[];
  url: string;
  isNew?: boolean;
  isTrending?: boolean;
}

export interface AffiliateCommission {
  type: 'one-time' | 'recurring' | 'hybrid';
  signupBonus: number;        // $ per signup
  recurringPercent: number;   // % of monthly spend
  recurringDuration: string;  // e.g. "12 months", "lifetime"
  topUpPercent: number;       // % commission on top-ups/renewals
  cookieDays: number;         // attribution window
  payoutMinimum: number;
  payoutSchedule: string;
}

export interface AffiliateEarnings {
  providerId: string;
  providerName: string;
  signups: number;
  signupRevenue: number;
  recurringUsers: number;
  recurringRevenue: number;
  topUpRevenue: number;
  totalRevenue: number;
  pendingPayout: number;
  lifetimeEarnings: number;
}

export const marketplaceListings: MarketplaceListing[] = [
  {
    id: 'aws-bedrock',
    name: 'AWS Bedrock',
    logo: '🟠',
    color: '#ff9900',
    category: 'compute',
    tagline: 'Enterprise AI at scale',
    tier: 'featured',
    description: 'Access Claude, Llama, Mistral and more through AWS. Unified billing, VPC endpoints, and enterprise security. Best for teams already on AWS.',
    pricing: 'Pay-as-you-go, Provisioned Throughput, or Savings Plans',
    promoOffer: '30-day free trial + $300 credits for new accounts',
    promoExpiry: 'Mar 31, 2026',
    affiliateCommission: {
      type: 'recurring',
      signupBonus: 50,
      recurringPercent: 12,
      recurringDuration: '24 months',
      topUpPercent: 8,
      cookieDays: 90,
      payoutMinimum: 100,
      payoutSchedule: 'Monthly, NET-30',
    },
    stats: { users: '100K+', rating: 4.6, uptime: '99.99%' },
    features: ['Claude, Llama, Mistral models', 'VPC private endpoints', 'Fine-tuning support', 'Guardrails built-in', 'SOC2 / HIPAA compliant'],
    url: 'https://aws.amazon.com/bedrock/',
    isTrending: true,
  },
  {
    id: 'azure-openai',
    name: 'Azure OpenAI Service',
    logo: '🔷',
    color: '#0078d4',
    category: 'compute',
    tagline: 'GPT-4o with enterprise compliance',
    tier: 'featured',
    description: 'Run OpenAI models within Azure\'s compliance boundary. Data never leaves your tenant. Best for regulated industries.',
    pricing: 'Pay-as-you-go or Reserved Capacity (up to 15% off)',
    promoOffer: '$200 Azure credits for new ComputeGauge users',
    promoExpiry: 'Apr 15, 2026',
    affiliateCommission: {
      type: 'recurring',
      signupBonus: 40,
      recurringPercent: 10,
      recurringDuration: '12 months',
      topUpPercent: 6,
      cookieDays: 60,
      payoutMinimum: 100,
      payoutSchedule: 'Monthly, NET-30',
    },
    stats: { users: '80K+', rating: 4.5, uptime: '99.95%' },
    features: ['GPT-4o, o1, DALL-E', 'Content filtering', 'Azure AD integration', 'Regional deployment', 'GDPR compliant'],
    url: 'https://azure.microsoft.com/en-us/products/ai-services/openai-service',
  },
  {
    id: 'gcp-vertex',
    name: 'GCP Vertex AI',
    logo: '🔵',
    color: '#4285f4',
    category: 'compute',
    tagline: 'Gemini + Claude on Google Cloud',
    tier: 'featured',
    description: 'Access Gemini, Claude, and open models. Tight integration with BigQuery, Cloud Storage, and Google\'s AI ecosystem.',
    pricing: 'Pay-as-you-go or Committed Use Discounts (up to 20% off)',
    promoOffer: '$500 Vertex AI credits with annual commit',
    affiliateCommission: {
      type: 'recurring',
      signupBonus: 45,
      recurringPercent: 10,
      recurringDuration: '12 months',
      topUpPercent: 7,
      cookieDays: 60,
      payoutMinimum: 100,
      payoutSchedule: 'Monthly, NET-30',
    },
    stats: { users: '60K+', rating: 4.4, uptime: '99.95%' },
    features: ['Gemini 2.0, Claude models', 'BigQuery ML integration', 'Model Garden', 'Vertex AI Search', 'Grounding with Google Search'],
    url: 'https://cloud.google.com/vertex-ai',
  },
  {
    id: 'together-ai',
    name: 'Together AI',
    logo: '🟧',
    color: '#ff6b35',
    category: 'inference',
    tagline: 'Fastest open-source inference',
    tier: 'partner',
    description: 'Lightning-fast inference for Llama, Mixtral, and 100+ open models. Up to 3x cheaper than closed APIs for many tasks.',
    pricing: 'Pay-as-you-go from $0.10/M tokens',
    promoOffer: '$25 free credits for new signups via ComputeGauge',
    affiliateCommission: {
      type: 'hybrid',
      signupBonus: 15,
      recurringPercent: 15,
      recurringDuration: 'lifetime',
      topUpPercent: 10,
      cookieDays: 30,
      payoutMinimum: 50,
      payoutSchedule: 'Monthly, NET-15',
    },
    stats: { users: '30K+', rating: 4.7, uptime: '99.9%' },
    features: ['100+ open models', 'Serverless & dedicated', 'Custom fine-tuning', 'Function calling', 'JSON mode'],
    url: 'https://api.together.xyz/',
    isTrending: true,
  },
  {
    id: 'fireworks-ai',
    name: 'Fireworks AI',
    logo: '🎆',
    color: '#ff4500',
    category: 'inference',
    tagline: 'Blazing fast AI inference',
    tier: 'partner',
    description: 'Purpose-built inference engine. Fastest Llama and Mixtral serving, with compound AI system support.',
    pricing: 'Pay-as-you-go from $0.05/M tokens',
    promoOffer: '$20 free credits via ComputeGauge',
    affiliateCommission: {
      type: 'hybrid',
      signupBonus: 10,
      recurringPercent: 12,
      recurringDuration: 'lifetime',
      topUpPercent: 8,
      cookieDays: 30,
      payoutMinimum: 50,
      payoutSchedule: 'Monthly, NET-15',
    },
    stats: { users: '15K+', rating: 4.6, uptime: '99.9%' },
    features: ['Sub-200ms latency', 'Compound AI systems', 'Grammar mode', 'Custom deployments', 'On-prem option'],
    url: 'https://fireworks.ai/',
    isNew: true,
  },
  {
    id: 'replicate',
    name: 'Replicate',
    logo: '🔁',
    color: '#e44dba',
    category: 'platform',
    tagline: 'Run any model with one line of code',
    tier: 'partner',
    description: 'Deploy ML models without managing infrastructure. Huge community of models for text, image, audio, and video.',
    pricing: 'Pay-per-prediction, starting at $0.000025/sec',
    promoOffer: 'First $10 of predictions free',
    affiliateCommission: {
      type: 'recurring',
      signupBonus: 10,
      recurringPercent: 15,
      recurringDuration: 'lifetime',
      topUpPercent: 10,
      cookieDays: 30,
      payoutMinimum: 25,
      payoutSchedule: 'Monthly, NET-15',
    },
    stats: { users: '50K+', rating: 4.5, uptime: '99.9%' },
    features: ['One-line deploys', 'Community models', 'Image generation', 'Video models', 'Custom training'],
    url: 'https://replicate.com/',
  },
  {
    id: 'modal',
    name: 'Modal',
    logo: '⚡',
    color: '#00d4aa',
    category: 'compute',
    tagline: 'Cloud compute for AI teams',
    tier: 'standard',
    description: 'Serverless GPU compute. Define your environment in Python, deploy in seconds. No Docker, no Kubernetes.',
    pricing: 'Pay-per-second GPU time, from $0.03/min (T4)',
    promoOffer: '$30/month free compute',
    affiliateCommission: {
      type: 'hybrid',
      signupBonus: 20,
      recurringPercent: 10,
      recurringDuration: '12 months',
      topUpPercent: 5,
      cookieDays: 30,
      payoutMinimum: 50,
      payoutSchedule: 'Monthly, NET-30',
    },
    stats: { users: '20K+', rating: 4.8 },
    features: ['Serverless GPUs', 'Python-native', 'Web endpoints', 'Cron scheduling', 'A100/H100 access'],
    url: 'https://modal.com/',
    isNew: true,
    isTrending: true,
  },
  {
    id: 'anyscale',
    name: 'Anyscale',
    logo: '🔆',
    color: '#5b7fff',
    category: 'fine-tuning',
    tagline: 'Fine-tune & serve open models',
    tier: 'standard',
    description: 'Fine-tune Llama and open models with your data. Managed Ray clusters for training and serving at scale.',
    pricing: 'Custom pricing based on compute',
    affiliateCommission: {
      type: 'recurring',
      signupBonus: 25,
      recurringPercent: 8,
      recurringDuration: '12 months',
      topUpPercent: 5,
      cookieDays: 60,
      payoutMinimum: 100,
      payoutSchedule: 'Monthly, NET-30',
    },
    stats: { users: '10K+', rating: 4.3 },
    features: ['Fine-tuning platform', 'Managed Ray', 'Multi-model serving', 'Auto-scaling', 'Enterprise support'],
    url: 'https://anyscale.com/',
  },
  {
    id: 'deepinfra',
    name: 'DeepInfra',
    logo: '🧊',
    color: '#6366f1',
    category: 'inference',
    tagline: 'Cheapest open-model inference',
    tier: 'standard',
    description: 'Ultra-low-cost inference for popular open models. OpenAI-compatible API with the lowest per-token pricing.',
    pricing: 'From $0.03/M tokens (Llama 3.1 8B)',
    promoOffer: '$5 free credits on signup',
    affiliateCommission: {
      type: 'recurring',
      signupBonus: 5,
      recurringPercent: 18,
      recurringDuration: 'lifetime',
      topUpPercent: 12,
      cookieDays: 30,
      payoutMinimum: 25,
      payoutSchedule: 'Monthly, NET-15',
    },
    stats: { users: '25K+', rating: 4.4 },
    features: ['Lowest token prices', 'OpenAI-compatible', '50+ models', 'Embeddings', 'Function calling'],
    url: 'https://deepinfra.com/',
    isTrending: true,
  },
  {
    id: 'lamini',
    name: 'Lamini',
    logo: '🦙',
    color: '#10b981',
    category: 'fine-tuning',
    tagline: 'Enterprise LLM fine-tuning',
    tier: 'standard',
    description: 'Turn your data into a custom LLM. Memory-tuning technology for guaranteed factual accuracy on your domain.',
    pricing: 'Free tier available, Enterprise from $499/mo',
    promoOffer: 'Extended free tier for ComputeGauge users',
    affiliateCommission: {
      type: 'hybrid',
      signupBonus: 30,
      recurringPercent: 12,
      recurringDuration: '12 months',
      topUpPercent: 8,
      cookieDays: 60,
      payoutMinimum: 100,
      payoutSchedule: 'Monthly, NET-30',
    },
    stats: { users: '5K+', rating: 4.2 },
    features: ['Memory tuning', 'Guaranteed accuracy', 'Enterprise deploy', 'HIPAA ready', 'Custom models'],
    url: 'https://lamini.ai/',
    isNew: true,
  },
];

export const affiliateEarnings: AffiliateEarnings[] = [
  {
    providerId: 'aws-bedrock',
    providerName: 'AWS Bedrock',
    signups: 23,
    signupRevenue: 1150,
    recurringUsers: 18,
    recurringRevenue: 432,
    topUpRevenue: 186,
    totalRevenue: 1768,
    pendingPayout: 432,
    lifetimeEarnings: 4250,
  },
  {
    providerId: 'together-ai',
    providerName: 'Together AI',
    signups: 47,
    signupRevenue: 705,
    recurringUsers: 31,
    recurringRevenue: 290,
    topUpRevenue: 155,
    totalRevenue: 1150,
    pendingPayout: 290,
    lifetimeEarnings: 2800,
  },
  {
    providerId: 'azure-openai',
    providerName: 'Azure OpenAI',
    signups: 15,
    signupRevenue: 600,
    recurringUsers: 12,
    recurringRevenue: 310,
    topUpRevenue: 120,
    totalRevenue: 1030,
    pendingPayout: 310,
    lifetimeEarnings: 2100,
  },
  {
    providerId: 'fireworks-ai',
    providerName: 'Fireworks AI',
    signups: 31,
    signupRevenue: 310,
    recurringUsers: 22,
    recurringRevenue: 198,
    topUpRevenue: 88,
    totalRevenue: 596,
    pendingPayout: 198,
    lifetimeEarnings: 1400,
  },
  {
    providerId: 'replicate',
    providerName: 'Replicate',
    signups: 38,
    signupRevenue: 380,
    recurringUsers: 25,
    recurringRevenue: 185,
    topUpRevenue: 95,
    totalRevenue: 660,
    pendingPayout: 185,
    lifetimeEarnings: 1600,
  },
  {
    providerId: 'deepinfra',
    providerName: 'DeepInfra',
    signups: 52,
    signupRevenue: 260,
    recurringUsers: 40,
    recurringRevenue: 220,
    topUpRevenue: 130,
    totalRevenue: 610,
    pendingPayout: 220,
    lifetimeEarnings: 1450,
  },
];

export type MarketplaceCategory = 'all' | 'compute' | 'platform' | 'tooling' | 'inference' | 'fine-tuning';

export function getTotalAffiliateRevenue(): number {
  return affiliateEarnings.reduce((sum, e) => sum + e.totalRevenue, 0);
}

export function getTotalRecurringRevenue(): number {
  return affiliateEarnings.reduce((sum, e) => sum + e.recurringRevenue, 0);
}

export function getTotalTopUpRevenue(): number {
  return affiliateEarnings.reduce((sum, e) => sum + e.topUpRevenue, 0);
}

export function getTotalPendingPayout(): number {
  return affiliateEarnings.reduce((sum, e) => sum + e.pendingPayout, 0);
}
