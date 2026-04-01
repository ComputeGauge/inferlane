// All shared types for the InferLane SDK

export interface InferLaneConfig {
  apiKey: string;
  baseUrl?: string;        // default: 'https://inferlane.com'
  routing?: RoutingStrategy;  // default routing strategy
  timeout?: number;         // ms, default 30000
}

export type RoutingStrategy = 'direct' | 'cheapest' | 'fastest' | 'quality' | 'budget' | 'fallback';

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  routing?: RoutingStrategy;
  budget?: number;
  fallback?: boolean;
  [key: string]: any;       // pass-through for provider-specific params
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  [key: string]: any;
}

export interface ChatCompletion {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  _inferlane?: InferLaneMetadata;
}

export interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: Partial<ChatMessage>;
    finish_reason: string | null;
  }>;
  _inferlane?: boolean | InferLaneMetadata;
}

export interface InferLaneMetadata {
  costUsd?: number;
  provider?: string;
  routingReason?: string;
  latencyMs?: number;
  savings?: number;
  fallback?: boolean;
}

export interface CostEstimate {
  model: string;
  provider: string;
  tier: string | null;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCost: number;
  breakdown: { prefill: number; decode: number };
  alternatives: Array<{
    model: string;
    provider: string;
    estimatedCost: number;
    savings: string;
    qualityScore: number;
    latencyClass: string;
  }>;
  cheapestAlternative: {
    model: string;
    provider: string;
    estimatedCost: number;
    savings: string;
  } | null;
  activePromotion: any | null;
}

// Legacy ingest types (backward compat)
export interface UsageRecord {
  userRef?: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost?: number;
  latencyMs?: number;
  metadata?: Record<string, any>;
  timestamp?: string;
}

export interface IngestResponse {
  accepted: number;
  rejected: number;
  errors: string[];
  costSummary: Record<string, number>;
}

export interface PartnerStats {
  referredUsers: number;
  totalRequests: number;
  totalCostUsd: number;
  commissionEarned: number;
  revSharePct: number;
}
