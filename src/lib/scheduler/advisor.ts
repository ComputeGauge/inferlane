// Stream Z3 — AI Prompt Advisor
// Analyses user proxy history and generates prompt suggestions optimised for
// active promotions and off-peak windows.

import { prisma } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SuggestionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PromptSuggestion {
  id: string;
  title: string;
  category: SuggestionCategory;
  description: string;
  model: string;
  systemPrompt: string;
  messages: SuggestionMessage[];
  estimatedTokens: number;
  estimatedCostCents: number;
  whyDuringBonus: string;
  /** Multi-step chain spec (if applicable) */
  chainSteps?: ChainStep[];
  /** Tags for filtering */
  tags: string[];
}

export interface ChainStep {
  index: number;
  title: string;
  model: string;
  systemPrompt: string;
  userPromptTemplate: string;
  estimatedTokens: number;
}

export interface ActivePromotion {
  id: string;
  provider: string;
  title: string;
  multiplier: number;
  startsAt: Date;
  endsAt: Date;
  eligiblePlans: string[];
  offPeakOnly: boolean;
}

export type SuggestionCategory =
  | 'CODEBASE_ANALYSIS'
  | 'DOCUMENT_PROCESSING'
  | 'MODEL_COMPARISON'
  | 'KNOWLEDGE_EXTRACTION'
  | 'CREATIVE_GENERATION'
  | 'DATA_PIPELINE';

// ---------------------------------------------------------------------------
// Usage stats (queried from ProxyRequest)
// ---------------------------------------------------------------------------

interface UsageStats {
  model: string;
  count: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  totalCostCents: number;
}

async function getUserUsageStats(userId: string): Promise<UsageStats[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    // ProxyRequest links to user via ApiKey.userId
    const userKeys = await prisma.apiKey.findMany({
      where: { userId, isActive: true },
      select: { id: true },
    });

    const keyIds = userKeys.map((k) => k.id);
    if (keyIds.length === 0) return [];

    const rows = await prisma.proxyRequest.groupBy({
      by: ['routedModel'] as const,
      where: {
        apiKeyId: { in: keyIds },
        timestamp: { gte: thirtyDaysAgo },
      },
      _count: true,
      _avg: { inputTokens: true, outputTokens: true },
      _sum: { costUsd: true },
    });

    // Sort by count descending, take top 20
    const sorted = rows
      .map((r) => ({
        model: r.routedModel,
        count: typeof r._count === 'number' ? r._count : 0,
        avgInputTokens: Math.round(r._avg?.inputTokens ?? 0),
        avgOutputTokens: Math.round(r._avg?.outputTokens ?? 0),
        totalCostCents: Number(r._sum?.costUsd ?? 0) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return sorted;
  } catch {
    // Table may not exist yet in dev — return empty
    return [];
  }
}

// ---------------------------------------------------------------------------
// Suggestion templates
// ---------------------------------------------------------------------------

interface SuggestionTemplate {
  id: string;
  title: string;
  category: SuggestionCategory;
  description: string;
  defaultModel: string;
  systemPrompt: string;
  userPromptTemplate: string;
  baseTokens: number;
  tags: string[];
  whyDuringBonus: string;
  chain?: Omit<ChainStep, 'index'>[];
}

const SUGGESTION_TEMPLATES: SuggestionTemplate[] = [
  // --- CODEBASE_ANALYSIS ---
  {
    id: 'sec-audit',
    title: 'Security audit your most-changed files',
    category: 'CODEBASE_ANALYSIS',
    description:
      'Run a comprehensive security review on your most frequently modified source files, identifying vulnerabilities, dependency risks, and hardening recommendations.',
    defaultModel: 'claude-sonnet-4-20250514',
    systemPrompt:
      'You are a senior application security engineer. Analyse the provided source code for OWASP Top 10 vulnerabilities, insecure patterns, and dependency risks. Output a structured report with severity ratings.',
    userPromptTemplate:
      'Please perform a security audit on the following code. Identify vulnerabilities, rate their severity (Critical/High/Medium/Low), and provide remediation guidance.\n\n{{code}}',
    baseTokens: 8000,
    tags: ['security', 'code-review', 'audit'],
    whyDuringBonus:
      'Security audits are token-heavy — running during a bonus period can save 40-60% on a full codebase scan.',
  },
  {
    id: 'api-docs',
    title: 'Generate API documentation from code',
    category: 'CODEBASE_ANALYSIS',
    description:
      'Automatically generate OpenAPI-style documentation from your route handlers and type definitions.',
    defaultModel: 'claude-sonnet-4-20250514',
    systemPrompt:
      'You are a technical writer specialising in API documentation. Given source code for API route handlers, generate clear, accurate OpenAPI 3.1-compatible documentation in YAML format.',
    userPromptTemplate:
      'Generate comprehensive API documentation for the following route handlers. Include request/response schemas, error codes, and example payloads.\n\n{{code}}',
    baseTokens: 6000,
    tags: ['documentation', 'api', 'openapi'],
    whyDuringBonus:
      'Documentation generation across many endpoints adds up fast — bonus multipliers reduce per-endpoint cost significantly.',
  },

  // --- DOCUMENT_PROCESSING ---
  {
    id: 'meeting-notes',
    title: 'Summarise meeting notes into action items',
    category: 'DOCUMENT_PROCESSING',
    description:
      'Convert raw meeting transcripts or notes into structured action items with owners, deadlines, and priority levels.',
    defaultModel: 'claude-sonnet-4-20250514',
    systemPrompt:
      'You are a project management assistant. Extract action items from meeting notes. For each item include: description, owner, deadline (if mentioned), and priority (P0-P3).',
    userPromptTemplate:
      'Extract action items from these meeting notes:\n\n{{notes}}',
    baseTokens: 3000,
    tags: ['meetings', 'action-items', 'productivity'],
    whyDuringBonus:
      'Batch-processing a week of meeting notes during bonus windows keeps your team aligned at a fraction of the cost.',
  },
  {
    id: 'report-extract',
    title: 'Extract key data from reports',
    category: 'DOCUMENT_PROCESSING',
    description:
      'Pull structured data points, KPIs, and insights from lengthy reports, whitepapers, or PDFs.',
    defaultModel: 'claude-sonnet-4-20250514',
    systemPrompt:
      'You are a data analyst. Extract the key metrics, findings, and recommendations from the provided document. Output as a structured JSON object with sections for metrics, findings, and recommendations.',
    userPromptTemplate:
      'Extract key data from this report. Focus on quantitative metrics, main findings, and actionable recommendations.\n\n{{document}}',
    baseTokens: 5000,
    tags: ['data-extraction', 'reports', 'analysis'],
    whyDuringBonus:
      'Report processing uses large input contexts — bonus periods let you process more documents per dollar.',
  },

  // --- MODEL_COMPARISON ---
  {
    id: 'model-compare',
    title: 'Compare Opus vs Sonnet on your common prompts',
    category: 'MODEL_COMPARISON',
    description:
      'Run your most frequent prompts through both Claude Opus and Sonnet, comparing quality, latency, and cost to find the optimal model for each use case.',
    defaultModel: 'claude-sonnet-4-20250514',
    systemPrompt:
      'You are an AI model evaluation specialist. Given a prompt and responses from different models, evaluate them on: accuracy, completeness, reasoning quality, and cost-effectiveness. Provide a recommendation.',
    userPromptTemplate:
      'Compare the quality of responses from different models for this prompt:\n\nPrompt: {{prompt}}\n\nModel A response: {{response_a}}\nModel B response: {{response_b}}',
    baseTokens: 10000,
    tags: ['comparison', 'evaluation', 'optimization'],
    whyDuringBonus:
      'Model comparisons require running the same prompt twice — bonus periods effectively halve the cost of each comparison run.',
    chain: [
      {
        title: 'Run prompt on Model A',
        model: 'claude-opus-4-20250514',
        systemPrompt: '{{original_system}}',
        userPromptTemplate: '{{original_prompt}}',
        estimatedTokens: 4000,
      },
      {
        title: 'Run prompt on Model B',
        model: 'claude-sonnet-4-20250514',
        systemPrompt: '{{original_system}}',
        userPromptTemplate: '{{original_prompt}}',
        estimatedTokens: 3000,
      },
      {
        title: 'Compare and evaluate',
        model: 'claude-sonnet-4-20250514',
        systemPrompt:
          'You are an AI evaluation expert. Compare these two model outputs objectively.',
        userPromptTemplate:
          'Compare these outputs:\n\nOpus: {{step_0.response}}\nSonnet: {{step_1.response}}',
        estimatedTokens: 3000,
      },
    ],
  },
  {
    id: 'model-benchmark',
    title: 'Benchmark model accuracy on your domain',
    category: 'MODEL_COMPARISON',
    description:
      'Create a test suite from your real-world prompts and systematically measure model performance across providers.',
    defaultModel: 'claude-sonnet-4-20250514',
    systemPrompt:
      'You are a benchmarking specialist. Design evaluation criteria and score model outputs on accuracy, relevance, formatting, and adherence to instructions.',
    userPromptTemplate:
      'Create a benchmark evaluation for these domain-specific prompts and expected outputs:\n\n{{test_cases}}',
    baseTokens: 12000,
    tags: ['benchmark', 'accuracy', 'testing'],
    whyDuringBonus:
      'Benchmarks involve many sequential API calls — running during promotions can cut total evaluation costs by 50% or more.',
  },

  // --- KNOWLEDGE_EXTRACTION ---
  {
    id: 'qa-dataset',
    title: 'Build Q&A dataset from documentation',
    category: 'KNOWLEDGE_EXTRACTION',
    description:
      'Generate question-answer pairs from your documentation to build a knowledge base, FAQ, or fine-tuning dataset.',
    defaultModel: 'claude-sonnet-4-20250514',
    systemPrompt:
      'You are a knowledge engineer. Given documentation text, generate diverse, high-quality question-answer pairs that cover all key concepts. Output as JSON array of {question, answer, category} objects.',
    userPromptTemplate:
      'Generate comprehensive Q&A pairs from this documentation:\n\n{{documentation}}',
    baseTokens: 8000,
    tags: ['knowledge-base', 'qa', 'dataset'],
    whyDuringBonus:
      'Dataset generation from large docs is token-intensive — bonus periods make it economical to process entire knowledge bases.',
  },
  {
    id: 'training-data',
    title: 'Create training data from examples',
    category: 'KNOWLEDGE_EXTRACTION',
    description:
      'Generate synthetic training examples based on a few seed examples, maintaining consistent format and quality.',
    defaultModel: 'claude-sonnet-4-20250514',
    systemPrompt:
      'You are a data augmentation specialist. Given seed examples, generate additional high-quality training examples that maintain the same format, style, and difficulty distribution. Ensure diversity and avoid exact copies.',
    userPromptTemplate:
      'Generate 20 additional training examples in the same format as these seed examples:\n\n{{examples}}',
    baseTokens: 6000,
    tags: ['training-data', 'augmentation', 'ml'],
    whyDuringBonus:
      'Synthetic data generation is a batch workload — scheduling it during bonus windows maximises output per dollar.',
  },

  // --- CREATIVE_GENERATION ---
  {
    id: 'marketing-copy',
    title: 'Generate marketing copy variations',
    category: 'CREATIVE_GENERATION',
    description:
      'Create multiple variations of marketing copy for A/B testing — headlines, descriptions, CTAs, and social media posts.',
    defaultModel: 'claude-sonnet-4-20250514',
    systemPrompt:
      'You are a senior copywriter. Generate multiple variations of marketing copy optimised for different channels and audiences. Each variation should have a unique angle while maintaining brand voice.',
    userPromptTemplate:
      'Generate 5 variations of marketing copy for: {{product_description}}\n\nTarget audience: {{audience}}\nTone: {{tone}}\nChannels: {{channels}}',
    baseTokens: 4000,
    tags: ['marketing', 'copywriting', 'ab-testing'],
    whyDuringBonus:
      'Generating many copy variations is perfect for bonus windows — more A/B test options at lower cost.',
  },
  {
    id: 'email-templates',
    title: 'Create email templates for sequences',
    category: 'CREATIVE_GENERATION',
    description:
      'Generate a full email sequence — welcome, onboarding, engagement, re-engagement — tailored to your product.',
    defaultModel: 'claude-sonnet-4-20250514',
    systemPrompt:
      'You are an email marketing specialist. Create professional email templates with subject lines, preview text, and body copy. Optimise for open rates and click-through rates.',
    userPromptTemplate:
      'Create a {{sequence_length}}-email sequence for {{purpose}}.\n\nProduct: {{product}}\nAudience: {{audience}}',
    baseTokens: 5000,
    tags: ['email', 'sequences', 'templates'],
    whyDuringBonus:
      'Email sequences involve multiple long-form outputs — bonus periods make generating full sequences cost-effective.',
  },

  // --- DATA_PIPELINE ---
  {
    id: 'csv-clean',
    title: 'Clean and categorise CSV data',
    category: 'DATA_PIPELINE',
    description:
      'Parse messy CSV data, fix formatting issues, fill missing values, and add category labels based on content analysis.',
    defaultModel: 'claude-sonnet-4-20250514',
    systemPrompt:
      'You are a data cleaning specialist. Process the provided CSV data: fix formatting inconsistencies, standardise values, handle missing data, and add category labels. Output clean CSV.',
    userPromptTemplate:
      'Clean and categorise this CSV data. Fix inconsistencies, standardise formats, and add a "category" column:\n\n{{csv_data}}',
    baseTokens: 6000,
    tags: ['data-cleaning', 'csv', 'categorisation'],
    whyDuringBonus:
      'Data cleaning large files burns through tokens — scheduling during bonuses lets you process bigger datasets affordably.',
  },
  {
    id: 'structured-extract',
    title: 'Extract structured data from unstructured text',
    category: 'DATA_PIPELINE',
    description:
      'Convert unstructured text (emails, support tickets, reviews) into structured JSON with entities, sentiment, and categories.',
    defaultModel: 'claude-sonnet-4-20250514',
    systemPrompt:
      'You are a data extraction specialist. Parse unstructured text and extract structured data including: entities (people, orgs, dates, amounts), sentiment, category, and key facts. Output as JSON.',
    userPromptTemplate:
      'Extract structured data from these texts. For each, provide entities, sentiment, category, and key facts as JSON:\n\n{{texts}}',
    baseTokens: 5000,
    tags: ['extraction', 'nlp', 'structured-data'],
    whyDuringBonus:
      'Batch extraction jobs are ideal for promotion windows — process your backlog of unstructured data at reduced rates.',
  },
];

// ---------------------------------------------------------------------------
// Cost estimation helpers
// ---------------------------------------------------------------------------

/** Rough per-1k-token pricing (cents) by model family.
 *  NOTE: This is intentionally separate from src/lib/pricing/model-prices.ts
 *  which uses per-million-token units. This is a fast estimation for suggestions. */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-20250514': { input: 1.5, output: 7.5 },
  'claude-sonnet-4-20250514': { input: 0.3, output: 1.5 },
  'claude-haiku-3-20240307': { input: 0.025, output: 0.125 },
  'gpt-4o': { input: 0.25, output: 1.0 },
  'gpt-4o-mini': { input: 0.015, output: 0.06 },
  default: { input: 0.3, output: 1.5 },
};

function getModelPricing(model: string) {
  return MODEL_PRICING[model] ?? MODEL_PRICING['default'];
}

function estimateCostCents(model: string, tokens: number): number {
  const pricing = getModelPricing(model);
  // Assume ~60% input, ~40% output split
  const inputTokens = tokens * 0.6;
  const outputTokens = tokens * 0.4;
  return (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate prompt suggestions based on a user's proxy history.
 * Returns up to 10 suggestions sorted by estimated savings.
 */
export async function generateSuggestions(
  userId: string,
  categoryFilter?: SuggestionCategory,
): Promise<PromptSuggestion[]> {
  const usageStats = await getUserUsageStats(userId);

  // Determine which models the user actually uses
  const usedModels = new Set(usageStats.map((s) => s.model));
  const primaryModel =
    usageStats.length > 0 ? usageStats[0].model : 'claude-sonnet-4-20250514';

  let templates = SUGGESTION_TEMPLATES;
  if (categoryFilter) {
    templates = templates.filter((t) => t.category === categoryFilter);
  }

  const suggestions: PromptSuggestion[] = templates.map((template) => {
    // Use the user's most-used model if compatible, otherwise default
    const model = usedModels.has(template.defaultModel)
      ? template.defaultModel
      : primaryModel;

    const estimatedTokens = template.baseTokens;
    const estimatedCostCents = estimateCostCents(model, estimatedTokens);

    const chainSteps: ChainStep[] | undefined = template.chain?.map((step, i) => ({
      index: i,
      title: step.title,
      model: step.model,
      systemPrompt: step.systemPrompt,
      userPromptTemplate: step.userPromptTemplate,
      estimatedTokens: step.estimatedTokens,
    }));

    return {
      id: template.id,
      title: template.title,
      category: template.category,
      description: template.description,
      model,
      systemPrompt: template.systemPrompt,
      messages: [{ role: 'user' as const, content: template.userPromptTemplate }],
      estimatedTokens,
      estimatedCostCents: Math.round(estimatedCostCents * 100) / 100,
      whyDuringBonus: template.whyDuringBonus,
      chainSteps,
      tags: template.tags,
    };
  });

  // Sort by estimated cost (highest savings potential first)
  suggestions.sort((a, b) => b.estimatedCostCents - a.estimatedCostCents);

  return suggestions.slice(0, 10);
}

/**
 * Calculate savings for running a suggestion during a promotion.
 */
export function estimateSavings(
  suggestion: PromptSuggestion,
  activePromotion: ActivePromotion | null,
): { normalCostCents: number; bonusCostCents: number; savingsCents: number; savingsPercent: number } {
  const normalCost = suggestion.estimatedCostCents;

  if (!activePromotion || activePromotion.multiplier <= 1) {
    return {
      normalCostCents: normalCost,
      bonusCostCents: normalCost,
      savingsCents: 0,
      savingsPercent: 0,
    };
  }

  // With a usage multiplier, you get more value per dollar
  // Effective cost = normalCost / multiplier
  const bonusCost = normalCost / activePromotion.multiplier;
  const savings = normalCost - bonusCost;

  return {
    normalCostCents: Math.round(normalCost * 100) / 100,
    bonusCostCents: Math.round(bonusCost * 100) / 100,
    savingsCents: Math.round(savings * 100) / 100,
    savingsPercent: Math.round((savings / normalCost) * 100),
  };
}

/**
 * Convert a suggestion into a multi-step chain specification
 * suitable for POST /api/scheduler/batches.
 */
export function buildChainFromSuggestion(suggestion: PromptSuggestion): {
  title: string;
  steps: {
    title: string;
    model: string;
    systemPrompt: string;
    userPrompt: string;
    estimatedTokens: number;
    dependsOnIndex: number | null;
  }[];
} {
  if (suggestion.chainSteps && suggestion.chainSteps.length > 0) {
    return {
      title: suggestion.title,
      steps: suggestion.chainSteps.map((step, i) => ({
        title: step.title,
        model: step.model,
        systemPrompt: step.systemPrompt,
        userPrompt: step.userPromptTemplate,
        estimatedTokens: step.estimatedTokens,
        dependsOnIndex: i > 0 ? i - 1 : null,
      })),
    };
  }

  // Single-step fallback
  return {
    title: suggestion.title,
    steps: [
      {
        title: suggestion.title,
        model: suggestion.model,
        systemPrompt: suggestion.systemPrompt,
        userPrompt: suggestion.messages[0]?.content ?? '',
        estimatedTokens: suggestion.estimatedTokens,
        dependsOnIndex: null,
      },
    ],
  };
}

export { SUGGESTION_TEMPLATES };
export type { SuggestionTemplate };
