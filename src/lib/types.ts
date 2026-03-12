export interface ProviderConfig {
  id: string;
  name: string;
  icon: string;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  apiKeyEnvVar: string;
  monthlyBudget: number;
  currentSpend: number;
  dailySpend: number[];
  topUpUrl: string;
  partnerUrl: string; // Affiliate / cloud marketplace partner link
  models: ModelUsage[];
  cloudAlternatives: CloudAlternative[];
}

export interface ModelUsage {
  name: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  inputPricePer1M: number;
  outputPricePer1M: number;
}

export interface CloudAlternative {
  provider: string; // AWS Bedrock, Azure, GCP Vertex
  name: string;
  savingsPercent: number;
  url: string;
  logo: string;
}

export interface Alert {
  id: string;
  providerId: string;
  providerName: string;
  type: 'warning' | 'critical' | 'info';
  message: string;
  threshold: number;
  triggered: boolean;
  timestamp: Date;
}

export interface SpendSnapshot {
  date: string;
  anthropic: number;
  openai: number;
  google: number;
  other: number;
  total: number;
}

export interface CostComparison {
  model: string;
  task: string;
  providers: {
    name: string;
    cost: number;
    speed: string;
    quality: number;
  }[];
}

export type TimeRange = '24h' | '7d' | '30d' | '90d';
