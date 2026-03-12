// ============================================================================
// SpendTracker — Core intelligence for the MCP server
// Aggregates data from all connected provider adapters
// ============================================================================

// Model pricing database (kept in sync with adapters)
interface ModelPrice {
  provider: string;
  model: string;
  inputPerMToken: number;
  outputPerMToken: number;
  context: number;
  category: 'chat' | 'embedding' | 'image';
}

// ============================================================================
// Model Capabilities — what each model is ACTUALLY good at
// This is the secret sauce. Raw pricing is a commodity. Knowing which model
// to pick for which task type? That's proprietary intelligence.
// ============================================================================
type TaskType =
  | 'complex_reasoning' | 'code_generation' | 'code_review'
  | 'simple_qa' | 'classification' | 'extraction'
  | 'summarization' | 'translation' | 'creative_writing'
  | 'data_analysis' | 'math' | 'conversation'
  | 'embedding' | 'general';

interface ModelCapability {
  // Quality scores per task type (0-100). Higher = better at this task.
  // These are derived from public benchmarks + community consensus.
  quality: Partial<Record<TaskType, number>>;
  // Relative speed score (0-100). 100 = fastest inference available.
  speed: number;
  // Capabilities flags
  toolUse: boolean;
  vision: boolean;
  // Provider tier for routing preferences
  tier: 'frontier' | 'premium' | 'value' | 'budget';
}

const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  // === FRONTIER TIER — Complex reasoning, novel problems, maximum quality ===
  'claude-opus-4': {
    quality: { complex_reasoning: 97, code_generation: 95, code_review: 96, creative_writing: 96, math: 94, data_analysis: 95, general: 95 },
    speed: 30, toolUse: true, vision: true, tier: 'frontier',
  },
  'o1': {
    quality: { complex_reasoning: 98, math: 99, code_generation: 93, data_analysis: 96, general: 92 },
    speed: 15, toolUse: false, vision: false, tier: 'frontier',
  },
  // === PREMIUM TIER — Best balance of quality and cost ===
  'claude-sonnet-4': {
    quality: { complex_reasoning: 90, code_generation: 93, code_review: 92, creative_writing: 88, simple_qa: 90, classification: 88, extraction: 90, summarization: 90, translation: 88, data_analysis: 90, math: 88, conversation: 90, general: 91 },
    speed: 55, toolUse: true, vision: true, tier: 'premium',
  },
  'claude-sonnet-3.5': {
    quality: { complex_reasoning: 88, code_generation: 91, code_review: 90, creative_writing: 86, simple_qa: 88, classification: 86, extraction: 88, summarization: 88, translation: 86, data_analysis: 88, math: 86, conversation: 88, general: 89 },
    speed: 55, toolUse: true, vision: true, tier: 'premium',
  },
  'gpt-4o': {
    quality: { complex_reasoning: 88, code_generation: 90, code_review: 89, creative_writing: 88, simple_qa: 90, classification: 88, extraction: 89, summarization: 88, translation: 90, data_analysis: 89, math: 87, conversation: 91, general: 89 },
    speed: 60, toolUse: true, vision: true, tier: 'premium',
  },
  'gemini-2.0-pro': {
    quality: { complex_reasoning: 86, code_generation: 87, code_review: 85, creative_writing: 84, simple_qa: 87, classification: 85, extraction: 86, summarization: 87, translation: 88, data_analysis: 87, math: 86, conversation: 86, general: 86 },
    speed: 50, toolUse: true, vision: true, tier: 'premium',
  },
  'mistral-large': {
    quality: { complex_reasoning: 82, code_generation: 84, code_review: 83, simple_qa: 85, classification: 83, extraction: 84, summarization: 83, translation: 86, data_analysis: 82, math: 80, conversation: 84, general: 83 },
    speed: 50, toolUse: true, vision: false, tier: 'premium',
  },
  // === VALUE TIER — Good quality at much lower cost ===
  'o3-mini': {
    quality: { complex_reasoning: 85, code_generation: 86, math: 92, data_analysis: 85, general: 82 },
    speed: 40, toolUse: true, vision: false, tier: 'value',
  },
  'deepseek-reasoner': {
    quality: { complex_reasoning: 86, code_generation: 88, math: 90, data_analysis: 84, general: 80 },
    speed: 35, toolUse: false, vision: false, tier: 'value',
  },
  'gemini-1.5-pro': {
    quality: { complex_reasoning: 83, code_generation: 84, code_review: 82, simple_qa: 85, classification: 83, extraction: 84, summarization: 85, translation: 86, data_analysis: 83, math: 82, conversation: 84, general: 84 },
    speed: 50, toolUse: true, vision: true, tier: 'value',
  },
  'llama-3.3-70b': {
    quality: { complex_reasoning: 78, code_generation: 80, code_review: 78, simple_qa: 82, classification: 80, extraction: 80, summarization: 80, translation: 78, data_analysis: 78, math: 76, conversation: 80, general: 79 },
    speed: 85, toolUse: true, vision: false, tier: 'value',
  },
  'qwen-2.5-72b-turbo': {
    quality: { complex_reasoning: 80, code_generation: 82, code_review: 79, simple_qa: 83, classification: 81, extraction: 81, summarization: 81, translation: 84, data_analysis: 80, math: 82, conversation: 81, general: 81 },
    speed: 70, toolUse: true, vision: false, tier: 'value',
  },
  'llama-3.3-70b-turbo': {
    quality: { complex_reasoning: 78, code_generation: 80, code_review: 78, simple_qa: 82, classification: 80, extraction: 80, summarization: 80, translation: 78, data_analysis: 78, math: 76, conversation: 80, general: 79 },
    speed: 75, toolUse: true, vision: false, tier: 'value',
  },
  // === BUDGET TIER — Cheapest options that still work well for simple tasks ===
  'claude-haiku-3.5': {
    quality: { complex_reasoning: 68, code_generation: 72, code_review: 70, simple_qa: 82, classification: 84, extraction: 83, summarization: 78, translation: 76, data_analysis: 72, math: 68, conversation: 80, general: 75 },
    speed: 90, toolUse: true, vision: true, tier: 'budget',
  },
  'gpt-4o-mini': {
    quality: { complex_reasoning: 65, code_generation: 70, code_review: 68, simple_qa: 83, classification: 85, extraction: 84, summarization: 80, translation: 82, data_analysis: 70, math: 65, conversation: 82, general: 75 },
    speed: 92, toolUse: true, vision: true, tier: 'budget',
  },
  'gemini-2.0-flash': {
    quality: { complex_reasoning: 70, code_generation: 72, code_review: 68, simple_qa: 82, classification: 82, extraction: 80, summarization: 78, translation: 80, data_analysis: 72, math: 70, conversation: 78, general: 75 },
    speed: 95, toolUse: true, vision: true, tier: 'budget',
  },
  'deepseek-chat': {
    quality: { complex_reasoning: 72, code_generation: 80, code_review: 75, simple_qa: 78, classification: 76, extraction: 76, summarization: 75, translation: 74, data_analysis: 74, math: 72, conversation: 74, general: 74 },
    speed: 60, toolUse: true, vision: false, tier: 'budget',
  },
  'llama-3.1-8b': {
    quality: { complex_reasoning: 45, code_generation: 50, code_review: 45, simple_qa: 72, classification: 75, extraction: 70, summarization: 65, translation: 60, data_analysis: 50, math: 45, conversation: 68, general: 58 },
    speed: 98, toolUse: false, vision: false, tier: 'budget',
  },
  'mistral-small': {
    quality: { complex_reasoning: 58, code_generation: 62, code_review: 58, simple_qa: 76, classification: 78, extraction: 76, summarization: 72, translation: 75, data_analysis: 62, math: 58, conversation: 74, general: 67 },
    speed: 88, toolUse: true, vision: false, tier: 'budget',
  },
};

const MODEL_PRICES: ModelPrice[] = [
  // Anthropic
  { provider: 'Anthropic', model: 'claude-opus-4', inputPerMToken: 15.0, outputPerMToken: 75.0, context: 200000, category: 'chat' },
  { provider: 'Anthropic', model: 'claude-sonnet-4', inputPerMToken: 3.0, outputPerMToken: 15.0, context: 200000, category: 'chat' },
  { provider: 'Anthropic', model: 'claude-haiku-3.5', inputPerMToken: 0.80, outputPerMToken: 4.0, context: 200000, category: 'chat' },
  { provider: 'Anthropic', model: 'claude-sonnet-3.5', inputPerMToken: 3.0, outputPerMToken: 15.0, context: 200000, category: 'chat' },
  // OpenAI
  { provider: 'OpenAI', model: 'gpt-4o', inputPerMToken: 2.50, outputPerMToken: 10.0, context: 128000, category: 'chat' },
  { provider: 'OpenAI', model: 'gpt-4o-mini', inputPerMToken: 0.15, outputPerMToken: 0.60, context: 128000, category: 'chat' },
  { provider: 'OpenAI', model: 'o1', inputPerMToken: 15.0, outputPerMToken: 60.0, context: 200000, category: 'chat' },
  { provider: 'OpenAI', model: 'o3-mini', inputPerMToken: 1.10, outputPerMToken: 4.40, context: 200000, category: 'chat' },
  { provider: 'OpenAI', model: 'text-embedding-3-small', inputPerMToken: 0.02, outputPerMToken: 0, context: 8191, category: 'embedding' },
  { provider: 'OpenAI', model: 'text-embedding-3-large', inputPerMToken: 0.13, outputPerMToken: 0, context: 8191, category: 'embedding' },
  // Google
  { provider: 'Google', model: 'gemini-2.0-flash', inputPerMToken: 0.10, outputPerMToken: 0.40, context: 1000000, category: 'chat' },
  { provider: 'Google', model: 'gemini-2.0-pro', inputPerMToken: 1.25, outputPerMToken: 10.0, context: 2000000, category: 'chat' },
  { provider: 'Google', model: 'gemini-1.5-pro', inputPerMToken: 1.25, outputPerMToken: 5.0, context: 2000000, category: 'chat' },
  // DeepSeek
  { provider: 'DeepSeek', model: 'deepseek-chat', inputPerMToken: 0.14, outputPerMToken: 0.28, context: 128000, category: 'chat' },
  { provider: 'DeepSeek', model: 'deepseek-reasoner', inputPerMToken: 0.55, outputPerMToken: 2.19, context: 128000, category: 'chat' },
  // Groq
  { provider: 'Groq', model: 'llama-3.3-70b', inputPerMToken: 0.59, outputPerMToken: 0.79, context: 128000, category: 'chat' },
  { provider: 'Groq', model: 'llama-3.1-8b', inputPerMToken: 0.05, outputPerMToken: 0.08, context: 128000, category: 'chat' },
  // Together
  { provider: 'Together', model: 'llama-3.3-70b-turbo', inputPerMToken: 0.88, outputPerMToken: 0.88, context: 128000, category: 'chat' },
  { provider: 'Together', model: 'qwen-2.5-72b-turbo', inputPerMToken: 1.20, outputPerMToken: 1.20, context: 128000, category: 'chat' },
  // Mistral
  { provider: 'Mistral', model: 'mistral-large', inputPerMToken: 2.0, outputPerMToken: 6.0, context: 128000, category: 'chat' },
  { provider: 'Mistral', model: 'mistral-small', inputPerMToken: 0.10, outputPerMToken: 0.30, context: 128000, category: 'chat' },
];

interface Config {
  connectedProviders: string[];
  dashboardUrl: string | null;
  apiKey: string | null;
  budgets: Record<string, number>;
}

export class SpendTracker {
  private config: Config;

  constructor() {
    // Read config from environment or config file
    this.config = {
      connectedProviders: this.detectProviders(),
      dashboardUrl: process.env.COMPUTEGAUGE_DASHBOARD_URL || null,
      apiKey: process.env.COMPUTEGAUGE_API_KEY || null,
      budgets: this.parseBudgets(),
    };
  }

  // ========================================================================
  // TOOL IMPLEMENTATIONS
  // ========================================================================

  async getSpendSummary(period: string, provider?: string): Promise<string> {
    // If dashboard API is configured, fetch real data
    if (this.config.dashboardUrl && this.config.apiKey) {
      return this.fetchFromDashboard('/api/mcp/spend-summary', { period, provider });
    }

    // Otherwise, provide pricing intelligence + config guidance
    const lines: string[] = [];
    lines.push('# AI Compute Spend Summary');
    lines.push('');

    if (this.config.connectedProviders.length === 0) {
      lines.push('⚠️ No provider API keys detected in environment.');
      lines.push('');
      lines.push('To track real spend, set these environment variables:');
      lines.push('- `ANTHROPIC_API_KEY` — Anthropic/Claude usage');
      lines.push('- `OPENAI_API_KEY` — OpenAI/GPT usage');
      lines.push('- `GOOGLE_API_KEY` — Google/Gemini usage');
      lines.push('');
      lines.push('Or connect to the ComputeGauge dashboard:');
      lines.push('- Set `COMPUTEGAUGE_DASHBOARD_URL` and `COMPUTEGAUGE_API_KEY`');
    } else {
      lines.push(`Connected providers: ${this.config.connectedProviders.join(', ')}`);
      lines.push(`Period: ${period}`);
      lines.push('');
      lines.push('💡 For detailed spend data, connect to the ComputeGauge dashboard.');
      lines.push('The MCP server can provide pricing intelligence and cost comparisons');
      lines.push('with just provider API keys configured.');
    }

    return lines.join('\n');
  }

  async getBudgetStatus(): Promise<string> {
    if (this.config.dashboardUrl && this.config.apiKey) {
      return this.fetchFromDashboard('/api/mcp/budget-status', {});
    }

    const lines: string[] = [];
    lines.push('# Budget Status');
    lines.push('');

    if (Object.keys(this.config.budgets).length === 0) {
      lines.push('No budgets configured.');
      lines.push('');
      lines.push('Set budgets with environment variables:');
      lines.push('- `COMPUTEGAUGE_BUDGET_ANTHROPIC=500` — $500/month Anthropic budget');
      lines.push('- `COMPUTEGAUGE_BUDGET_OPENAI=300` — $300/month OpenAI budget');
      lines.push('- `COMPUTEGAUGE_BUDGET_TOTAL=1000` — $1000/month total budget');
    } else {
      for (const [provider, budget] of Object.entries(this.config.budgets)) {
        lines.push(`**${provider}**: $${budget}/month budget set`);
      }
      lines.push('');
      lines.push('💡 Connect to the dashboard for real-time budget tracking with alerts.');
    }

    return lines.join('\n');
  }

  async getModelPricing(model?: string, category?: string): Promise<string> {
    let filtered = MODEL_PRICES;

    if (model) {
      const search = model.toLowerCase();
      filtered = filtered.filter(m =>
        m.model.toLowerCase().includes(search) ||
        m.provider.toLowerCase().includes(search)
      );
    }

    if (category && category !== 'all') {
      filtered = filtered.filter(m => m.category === category);
    }

    if (filtered.length === 0) {
      return `No pricing found for "${model || category}". Try a broader search.`;
    }

    const lines: string[] = [];
    lines.push('# Model Pricing (per million tokens)');
    lines.push('');
    lines.push('| Provider | Model | Input $/MT | Output $/MT | Context |');
    lines.push('|----------|-------|-----------|------------|---------|');

    for (const m of filtered.sort((a, b) => a.inputPerMToken - b.inputPerMToken)) {
      lines.push(
        `| ${m.provider} | ${m.model} | $${m.inputPerMToken.toFixed(2)} | $${m.outputPerMToken.toFixed(2)} | ${(m.context / 1000).toFixed(0)}K |`
      );
    }

    lines.push('');
    lines.push(`_${filtered.length} models shown. Prices as of Feb 2026._`);

    return lines.join('\n');
  }

  async getCostComparison(
    promptTokens: number,
    completionTokens: number,
    models?: string[]
  ): Promise<string> {
    let candidates = MODEL_PRICES.filter(m => m.category === 'chat');

    if (models && models.length > 0) {
      const search = models.map(m => m.toLowerCase());
      candidates = candidates.filter(m =>
        search.some(s => m.model.toLowerCase().includes(s) || m.provider.toLowerCase().includes(s))
      );
    }

    if (candidates.length === 0) {
      candidates = MODEL_PRICES.filter(m => m.category === 'chat');
    }

    const costs = candidates.map(m => {
      const inputCost = (promptTokens / 1_000_000) * m.inputPerMToken;
      const outputCost = (completionTokens / 1_000_000) * m.outputPerMToken;
      return {
        ...m,
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost,
      };
    }).sort((a, b) => a.totalCost - b.totalCost);

    const cheapest = costs[0];
    const mostExpensive = costs[costs.length - 1];

    const lines: string[] = [];
    lines.push(`# Cost Comparison: ${promptTokens.toLocaleString()} input + ${completionTokens.toLocaleString()} output tokens`);
    lines.push('');
    lines.push('| Provider | Model | Input Cost | Output Cost | **Total** |');
    lines.push('|----------|-------|-----------|------------|----------|');

    for (const c of costs) {
      const tag = c === cheapest ? ' 💚' : c === mostExpensive ? ' 🔴' : '';
      lines.push(
        `| ${c.provider} | ${c.model} | $${c.inputCost.toFixed(4)} | $${c.outputCost.toFixed(4)} | **$${c.totalCost.toFixed(4)}**${tag} |`
      );
    }

    lines.push('');
    const savings = mostExpensive.totalCost - cheapest.totalCost;
    const savingsPercent = ((savings / mostExpensive.totalCost) * 100).toFixed(0);
    lines.push(`💡 **Cheapest**: ${cheapest.provider} ${cheapest.model} at $${cheapest.totalCost.toFixed(4)}`);
    lines.push(`📉 **Potential savings**: $${savings.toFixed(4)} (${savingsPercent}%) vs most expensive option`);

    if (promptTokens > 50000) {
      lines.push('');
      lines.push(`⚡ At ${promptTokens.toLocaleString()} input tokens, consider batching or caching to reduce costs.`);
    }

    return lines.join('\n');
  }

  async suggestSavings(): Promise<string> {
    if (this.config.dashboardUrl && this.config.apiKey) {
      return this.fetchFromDashboard('/api/mcp/suggest-savings', {});
    }

    const lines: string[] = [];
    lines.push('# Cost Optimization Suggestions');
    lines.push('');
    lines.push('## General Recommendations');
    lines.push('');
    lines.push('1. **Use smaller models for simple tasks** — GPT-4o-mini and Claude Haiku are 10-50x cheaper than frontier models for classification, extraction, and simple Q&A');
    lines.push('');
    lines.push('2. **Batch API requests** — Anthropic offers 50% discount on batch API, OpenAI offers async batch processing at reduced rates');
    lines.push('');
    lines.push('3. **Cache common prompts** — If you send the same system prompts repeatedly, Anthropic Prompt Caching can reduce input costs by 90%');
    lines.push('');
    lines.push('4. **Reduce output tokens** — Ask for concise responses. Output tokens cost 3-5x more than input tokens on most providers');
    lines.push('');
    lines.push('5. **Consider DeepSeek for code** — DeepSeek-V3 matches GPT-4o on coding benchmarks at ~5% of the cost');
    lines.push('');
    lines.push('6. **Use Groq for speed-sensitive, cost-sensitive tasks** — Llama 3.1-8B on Groq: $0.05/MT input, fastest inference');
    lines.push('');
    lines.push('7. **Monitor for model deprecation** — Older models get deprecated but cheaper alternatives usually exist');
    lines.push('');
    lines.push('## Cost-Tier Quick Reference');
    lines.push('');
    lines.push('| Tier | Best For | Models | ~Cost/1M tokens |');
    lines.push('|------|----------|--------|-----------------|');
    lines.push('| 💎 Frontier | Complex reasoning | Claude Opus 4, o1 | $15-75 |');
    lines.push('| 🥇 Premium | General tasks | Claude Sonnet, GPT-4o | $2.50-15 |');
    lines.push('| 🥈 Value | Most workloads | Gemini Flash, o3-mini | $0.10-4.40 |');
    lines.push('| 🥉 Budget | Simple tasks | GPT-4o-mini, Haiku, DeepSeek | $0.05-0.80 |');
    lines.push('');
    lines.push('💡 Connect to the ComputeGauge dashboard for personalized recommendations based on your actual usage patterns.');

    return lines.join('\n');
  }

  async getUsageTrend(days: number, provider?: string): Promise<string> {
    if (this.config.dashboardUrl && this.config.apiKey) {
      return this.fetchFromDashboard('/api/mcp/usage-trend', { days, provider });
    }

    const lines: string[] = [];
    lines.push(`# Usage Trend (last ${days} days)`);
    lines.push('');
    lines.push('⚠️ Trend analysis requires connection to the ComputeGauge dashboard.');
    lines.push('');
    lines.push('To enable:');
    lines.push('1. Start the dashboard: `cd computegauge && npm run dev`');
    lines.push('2. Set `COMPUTEGAUGE_DASHBOARD_URL=http://localhost:3000`');
    lines.push('3. Set `COMPUTEGAUGE_API_KEY` to your ComputeGauge API key');
    lines.push('');
    lines.push('The dashboard tracks daily spend, identifies spikes, and detects anomalies.');

    return lines.join('\n');
  }

  // ========================================================================
  // AGENT DECISION ENGINE — pick_model
  // ========================================================================

  async pickModel(params: {
    task_type: TaskType;
    priority: 'cheapest' | 'balanced' | 'best_quality' | 'fastest';
    max_cost_per_call?: number;
    estimated_input_tokens?: number;
    estimated_output_tokens?: number;
    needs_tool_use: boolean;
    needs_vision: boolean;
    needs_long_context: boolean;
  }): Promise<string> {
    const {
      task_type,
      priority,
      max_cost_per_call,
      estimated_input_tokens = 2000,
      estimated_output_tokens = 1000,
      needs_tool_use,
      needs_vision,
      needs_long_context,
    } = params;

    // Handle embedding tasks separately
    if (task_type === 'embedding') {
      return this.pickEmbeddingModel(estimated_input_tokens);
    }

    // Score every model
    interface ScoredModel {
      model: string;
      provider: string;
      estimatedCost: number;
      qualityScore: number;
      speedScore: number;
      compositeScore: number;
      tier: string;
      reason: string;
      disqualified: boolean;
      disqualifyReason?: string;
    }

    const scored: ScoredModel[] = [];

    for (const price of MODEL_PRICES) {
      if (price.category !== 'chat') continue;

      const caps = MODEL_CAPABILITIES[price.model];
      if (!caps) continue;

      // Calculate estimated cost for this call
      const inputCost = (estimated_input_tokens / 1_000_000) * price.inputPerMToken;
      const outputCost = (estimated_output_tokens / 1_000_000) * price.outputPerMToken;
      const estimatedCost = inputCost + outputCost;

      // Get quality score for this task type
      const qualityScore = caps.quality[task_type] ?? caps.quality['general'] ?? 50;
      const speedScore = caps.speed;

      // Check disqualification criteria
      let disqualified = false;
      let disqualifyReason = '';

      if (needs_tool_use && !caps.toolUse) {
        disqualified = true;
        disqualifyReason = 'Does not support tool/function calling';
      }
      if (needs_vision && !caps.vision) {
        disqualified = true;
        disqualifyReason = 'Does not support vision/image input';
      }
      if (needs_long_context && price.context < 100000) {
        disqualified = true;
        disqualifyReason = `Context window too small (${(price.context / 1000).toFixed(0)}K)`;
      }
      if (max_cost_per_call && estimatedCost > max_cost_per_call) {
        disqualified = true;
        disqualifyReason = `Estimated cost $${estimatedCost.toFixed(4)} exceeds max $${max_cost_per_call.toFixed(4)}`;
      }

      // Calculate composite score based on priority
      // Cost score normalized using log scale — handles the 1000x range from
      // llama-3.1-8b ($0.0001) to claude-opus-4 ($1.50) gracefully.
      // Log scale ensures frontier models aren't completely zeroed out on cost.
      const costScore = Math.max(0, 100 - Math.log10(1 + estimatedCost * 1000) * 25);

      // Provider availability bonus: slightly prefer models the user can actually use
      // If user has ANTHROPIC_API_KEY, boost Anthropic models by 5 points, etc.
      const providerMap: Record<string, string> = {
        'Anthropic': 'anthropic', 'OpenAI': 'openai', 'Google': 'google',
        'DeepSeek': 'deepseek', 'Groq': 'groq', 'Together': 'together', 'Mistral': 'mistral',
      };
      const providerKey = providerMap[price.provider];
      const hasProviderKey = providerKey ? this.config.connectedProviders.includes(providerKey) : false;
      const availabilityBonus = hasProviderKey ? 5 : 0;

      let compositeScore: number;
      let reason: string;

      switch (priority) {
        case 'cheapest':
          compositeScore = costScore * 0.70 + qualityScore * 0.20 + speedScore * 0.10 + availabilityBonus;
          reason = `Cheapest viable: $${estimatedCost.toFixed(4)}, quality ${qualityScore}/100`;
          break;
        case 'best_quality':
          compositeScore = qualityScore * 0.70 + costScore * 0.10 + speedScore * 0.20 + availabilityBonus;
          reason = `Highest quality: ${qualityScore}/100 for ${task_type}`;
          break;
        case 'fastest':
          compositeScore = speedScore * 0.60 + qualityScore * 0.25 + costScore * 0.15 + availabilityBonus;
          reason = `Fastest: speed ${speedScore}/100, quality ${qualityScore}/100`;
          break;
        case 'balanced':
        default:
          compositeScore = qualityScore * 0.45 + costScore * 0.35 + speedScore * 0.20 + availabilityBonus;
          reason = `Balanced: quality ${qualityScore}/100, cost $${estimatedCost.toFixed(4)}`;
          break;
      }

      scored.push({
        model: price.model,
        provider: price.provider,
        estimatedCost,
        qualityScore,
        speedScore,
        compositeScore,
        tier: caps.tier,
        reason,
        disqualified,
        disqualifyReason,
      });
    }

    // Filter out disqualified models
    const eligible = scored.filter(s => !s.disqualified);
    const disqualified = scored.filter(s => s.disqualified);

    if (eligible.length === 0) {
      // Relax constraints and explain
      const lines: string[] = [];
      lines.push(`# No models match all requirements`);
      lines.push('');
      lines.push(`Task: ${task_type}, Priority: ${priority}`);
      lines.push(`Constraints: tool_use=${needs_tool_use}, vision=${needs_vision}, long_context=${needs_long_context}${max_cost_per_call ? `, max_cost=$${max_cost_per_call}` : ''}`);
      lines.push('');
      lines.push('## Why models were disqualified:');
      for (const d of disqualified.sort((a, b) => b.compositeScore - a.compositeScore).slice(0, 5)) {
        lines.push(`- **${d.provider}/${d.model}**: ${d.disqualifyReason}`);
      }
      lines.push('');
      lines.push('💡 Try relaxing constraints (e.g., drop vision requirement or increase max_cost_per_call).');
      return lines.join('\n');
    }

    // Sort by composite score
    eligible.sort((a, b) => b.compositeScore - a.compositeScore);
    const pick = eligible[0];
    const runnerUp = eligible.length > 1 ? eligible[1] : null;
    const cheapest = [...eligible].sort((a, b) => a.estimatedCost - b.estimatedCost)[0];

    // Check if user has the provider's API key
    const providerAvailMap: Record<string, string> = {
      'Anthropic': 'anthropic', 'OpenAI': 'openai', 'Google': 'google',
      'DeepSeek': 'deepseek', 'Groq': 'groq', 'Together': 'together', 'Mistral': 'mistral',
    };
    const pickProviderKey = providerAvailMap[pick.provider];
    const pickAvailable = pickProviderKey ? this.config.connectedProviders.includes(pickProviderKey) : false;

    // Build the response
    const lines: string[] = [];
    lines.push(`# ✅ Recommended: ${pick.provider} / ${pick.model}`);
    lines.push('');
    lines.push(`**Task**: ${task_type} | **Priority**: ${priority} | **Tier**: ${pick.tier}`);
    lines.push(`**Estimated cost**: $${pick.estimatedCost.toFixed(4)} (${estimated_input_tokens.toLocaleString()} in / ${estimated_output_tokens.toLocaleString()} out)`);
    lines.push(`**Quality**: ${pick.qualityScore}/100 for ${task_type} | **Speed**: ${pick.speedScore}/100`);
    if (pickAvailable) {
      lines.push(`**API Key**: ✅ ${pick.provider} API key detected — ready to use`);
    } else if (this.config.connectedProviders.length > 0) {
      lines.push(`**API Key**: ⚠️ No ${pick.provider} API key detected. Available providers: ${this.config.connectedProviders.join(', ')}`);
    }
    lines.push(`**Why**: ${pick.reason}`);

    // Show runner-up if meaningfully different
    if (runnerUp && runnerUp.model !== pick.model) {
      lines.push('');
      lines.push(`## Runner-up: ${runnerUp.provider} / ${runnerUp.model}`);
      lines.push(`Cost: $${runnerUp.estimatedCost.toFixed(4)} | Quality: ${runnerUp.qualityScore}/100 | Speed: ${runnerUp.speedScore}/100`);
    }

    // Show cheapest alternative if different from pick
    if (cheapest.model !== pick.model) {
      const savings = pick.estimatedCost - cheapest.estimatedCost;
      const savingsPct = ((savings / pick.estimatedCost) * 100).toFixed(0);
      lines.push('');
      lines.push(`## 💰 Cheapest alternative: ${cheapest.provider} / ${cheapest.model}`);
      lines.push(`Cost: $${cheapest.estimatedCost.toFixed(4)} (saves ${savingsPct}%) | Quality: ${cheapest.qualityScore}/100`);
      if (cheapest.qualityScore < pick.qualityScore - 15) {
        lines.push(`⚠️ Significant quality drop (${pick.qualityScore} → ${cheapest.qualityScore}) — use only if cost is critical.`);
      }
    }

    // Task-specific advice
    const advice = this.getTaskAdvice(task_type, pick.tier);
    if (advice) {
      lines.push('');
      lines.push(`## 💡 Tip`);
      lines.push(advice);
    }

    // Disqualified models note
    if (disqualified.length > 0) {
      lines.push('');
      lines.push(`_${disqualified.length} model(s) excluded due to missing capabilities._`);
    }

    return lines.join('\n');
  }

  private pickEmbeddingModel(estimatedTokens: number): string {
    const embeddingModels = MODEL_PRICES.filter(m => m.category === 'embedding');
    const lines: string[] = [];
    lines.push('# Embedding Model Recommendation');
    lines.push('');

    if (embeddingModels.length === 0) {
      lines.push('No embedding models in pricing database.');
      return lines.join('\n');
    }

    const scored = embeddingModels.map(m => ({
      ...m,
      cost: (estimatedTokens / 1_000_000) * m.inputPerMToken,
    })).sort((a, b) => a.cost - b.cost);

    const pick = scored[0];
    lines.push(`**Recommended**: ${pick.provider} / ${pick.model}`);
    lines.push(`**Cost**: $${pick.cost.toFixed(6)} for ${estimatedTokens.toLocaleString()} tokens`);

    if (scored.length > 1) {
      lines.push('');
      lines.push('| Model | Cost | $/M Tokens |');
      lines.push('|-------|------|-----------|');
      for (const m of scored) {
        lines.push(`| ${m.model} | $${m.cost.toFixed(6)} | $${m.inputPerMToken.toFixed(3)} |`);
      }
    }

    lines.push('');
    lines.push('💡 For embeddings, always use the cheapest option. Quality differences are minimal for most use cases.');
    return lines.join('\n');
  }

  private getTaskAdvice(taskType: TaskType, chosenTier: string): string | null {
    const advice: Record<string, string | null> = {
      'code_generation': chosenTier === 'frontier'
        ? 'Consider breaking large code generation into: (1) architecture planning (frontier) + (2) implementation (premium/value). The implementation step rarely needs frontier quality.'
        : 'For code generation, quality matters more than speed. If this is production-critical code, consider upgrading to a premium model.',
      'simple_qa': chosenTier !== 'budget'
        ? 'Simple Q&A rarely needs a premium model. Budget models (Haiku, GPT-4o-mini, Gemini Flash) handle this well at 10-50x less cost.'
        : null,
      'classification': chosenTier !== 'budget'
        ? 'Classification is a solved problem for budget models. Consider downgrading — Haiku and GPT-4o-mini achieve 95%+ accuracy on most classification tasks.'
        : null,
      'extraction': chosenTier !== 'budget'
        ? 'Structured extraction (JSON, entities, fields) works well with budget models. Save premium models for ambiguous extraction tasks.'
        : null,
      'complex_reasoning': chosenTier === 'budget'
        ? 'Warning: Budget models struggle with complex multi-step reasoning. Consider upgrading if accuracy is critical.'
        : null,
      'math': 'For math-heavy tasks, o3-mini and DeepSeek-Reasoner offer exceptional quality at value-tier pricing.',
      'summarization': 'For long documents, consider Gemini models — they offer the largest context windows (1-2M tokens) at competitive prices.',
    };

    const result = advice[taskType];
    if (typeof result === 'string') return result;
    return null;
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  getConfig(): Record<string, unknown> {
    return {
      version: '0.3.0',
      connectedProviders: this.config.connectedProviders,
      hasDashboard: !!this.config.dashboardUrl,
      budgetsConfigured: Object.keys(this.config.budgets).length,
      totalModelsTracked: MODEL_PRICES.length,
      modelsWithCapabilities: Object.keys(MODEL_CAPABILITIES).length,
      providers: [...new Set(MODEL_PRICES.map(m => m.provider))],
      agentFeatures: ['pick_model', 'log_request', 'session_cost', 'cost_aware_prompts'],
    };
  }

  private detectProviders(): string[] {
    const providers: string[] = [];
    if (process.env.ANTHROPIC_API_KEY) providers.push('anthropic');
    if (process.env.OPENAI_API_KEY) providers.push('openai');
    if (process.env.GOOGLE_API_KEY) providers.push('google');
    if (process.env.TOGETHER_API_KEY) providers.push('together');
    if (process.env.GROQ_API_KEY) providers.push('groq');
    if (process.env.MISTRAL_API_KEY) providers.push('mistral');
    if (process.env.DEEPSEEK_API_KEY) providers.push('deepseek');
    return providers;
  }

  private parseBudgets(): Record<string, number> {
    const budgets: Record<string, number> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith('COMPUTEGAUGE_BUDGET_') && value) {
        const provider = key.replace('COMPUTEGAUGE_BUDGET_', '').toLowerCase();
        budgets[provider] = parseFloat(value);
      }
    }
    return budgets;
  }

  private async fetchFromDashboard(path: string, params: Record<string, unknown>): Promise<string> {
    try {
      const url = new URL(path, this.config.dashboardUrl!);
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(params),
      });

      if (res.ok) {
        const data = await res.json();
        return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      }

      return `Dashboard API error: ${res.status} ${res.statusText}`;
    } catch (error) {
      return `Could not reach dashboard at ${this.config.dashboardUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}
