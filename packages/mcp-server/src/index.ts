#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TOOLS } from './tools.js';
import { InferLaneClient } from './client.js';

// Model equivalence data (embedded for offline use — no network call needed)
const MODEL_TIERS: Record<string, Array<{ provider: string; model: string; inputPerMToken: number; outputPerMToken: number; qualityScore: number; latencyClass: string; contextWindow: number }>> = {
  frontier: [
    { provider: 'ANTHROPIC', model: 'claude-opus-4', inputPerMToken: 15, outputPerMToken: 75, qualityScore: 95, latencyClass: 'slow', contextWindow: 200000 },
    { provider: 'OPENAI', model: 'gpt-4o', inputPerMToken: 2.5, outputPerMToken: 10, qualityScore: 88, latencyClass: 'medium', contextWindow: 128000 },
    { provider: 'OPENAI', model: 'gpt-4-turbo', inputPerMToken: 10, outputPerMToken: 30, qualityScore: 86, latencyClass: 'medium', contextWindow: 128000 },
    { provider: 'GOOGLE', model: 'gemini-2.5-pro', inputPerMToken: 1.25, outputPerMToken: 10, qualityScore: 90, latencyClass: 'medium', contextWindow: 1048576 },
    { provider: 'XAI', model: 'grok-3', inputPerMToken: 3, outputPerMToken: 15, qualityScore: 87, latencyClass: 'medium', contextWindow: 131072 },
  ],
  workhorse: [
    { provider: 'ANTHROPIC', model: 'claude-sonnet-4', inputPerMToken: 3, outputPerMToken: 15, qualityScore: 92, latencyClass: 'medium', contextWindow: 200000 },
    { provider: 'OPENAI', model: 'gpt-4o-mini', inputPerMToken: 0.15, outputPerMToken: 0.6, qualityScore: 80, latencyClass: 'fast', contextWindow: 128000 },
    { provider: 'GOOGLE', model: 'gemini-2.0-flash', inputPerMToken: 0.1, outputPerMToken: 0.4, qualityScore: 78, latencyClass: 'fast', contextWindow: 1048576 },
    { provider: 'DEEPSEEK', model: 'deepseek-chat', inputPerMToken: 0.27, outputPerMToken: 1.1, qualityScore: 82, latencyClass: 'medium', contextWindow: 64000 },
    { provider: 'MISTRAL', model: 'mistral-large', inputPerMToken: 2, outputPerMToken: 6, qualityScore: 83, latencyClass: 'medium', contextWindow: 128000 },
  ],
  speed: [
    { provider: 'ANTHROPIC', model: 'claude-haiku-3.5', inputPerMToken: 0.25, outputPerMToken: 1.25, qualityScore: 85, latencyClass: 'fast', contextWindow: 200000 },
    { provider: 'OPENAI', model: 'gpt-4o-mini', inputPerMToken: 0.15, outputPerMToken: 0.6, qualityScore: 80, latencyClass: 'fast', contextWindow: 128000 },
    { provider: 'GOOGLE', model: 'gemini-2.0-flash-lite', inputPerMToken: 0.075, outputPerMToken: 0.3, qualityScore: 70, latencyClass: 'fast', contextWindow: 1048576 },
    { provider: 'GROQ', model: 'groq/llama-3.3-70b', inputPerMToken: 0.59, outputPerMToken: 0.79, qualityScore: 75, latencyClass: 'fast', contextWindow: 128000 },
    { provider: 'XAI', model: 'grok-3-mini', inputPerMToken: 0.3, outputPerMToken: 0.5, qualityScore: 74, latencyClass: 'fast', contextWindow: 131072 },
  ],
  reasoning: [
    { provider: 'ANTHROPIC', model: 'claude-opus-4', inputPerMToken: 15, outputPerMToken: 75, qualityScore: 95, latencyClass: 'slow', contextWindow: 200000 },
    { provider: 'OPENAI', model: 'o1', inputPerMToken: 15, outputPerMToken: 60, qualityScore: 93, latencyClass: 'slow', contextWindow: 200000 },
    { provider: 'OPENAI', model: 'o3-mini', inputPerMToken: 1.1, outputPerMToken: 4.4, qualityScore: 82, latencyClass: 'medium', contextWindow: 200000 },
    { provider: 'DEEPSEEK', model: 'deepseek-reasoner', inputPerMToken: 0.55, outputPerMToken: 2.19, qualityScore: 85, latencyClass: 'medium', contextWindow: 64000 },
    { provider: 'GOOGLE', model: 'gemini-2.5-pro', inputPerMToken: 1.25, outputPerMToken: 10, qualityScore: 90, latencyClass: 'medium', contextWindow: 1048576 },
  ],
  budget: [
    { provider: 'TOGETHER', model: 'together/llama-3.3-70b', inputPerMToken: 0.88, outputPerMToken: 0.88, qualityScore: 72, latencyClass: 'medium', contextWindow: 128000 },
    { provider: 'GROQ', model: 'groq/llama-3.3-70b', inputPerMToken: 0.59, outputPerMToken: 0.79, qualityScore: 75, latencyClass: 'fast', contextWindow: 128000 },
    { provider: 'CEREBRAS', model: 'cerebras/llama-3.3-70b', inputPerMToken: 0.6, outputPerMToken: 0.6, qualityScore: 71, latencyClass: 'fast', contextWindow: 128000 },
    { provider: 'SAMBANOVA', model: 'sambanova/llama-3.3-70b', inputPerMToken: 0.6, outputPerMToken: 0.6, qualityScore: 70, latencyClass: 'fast', contextWindow: 128000 },
    { provider: 'FIREWORKS', model: 'fireworks/llama-3.3-70b', inputPerMToken: 0.9, outputPerMToken: 0.9, qualityScore: 72, latencyClass: 'medium', contextWindow: 128000 },
  ],
};

// Alias map: common model names agents might type → canonical name in MODEL_TIERS
const MODEL_ALIASES: Record<string, string> = {
  // Anthropic aliases
  'claude-3.5-sonnet': 'claude-sonnet-4',
  'claude-3-sonnet': 'claude-sonnet-4',
  'claude-3-opus': 'claude-opus-4',
  'claude-3.5-haiku': 'claude-haiku-3.5',
  'claude-3-haiku': 'claude-haiku-3.5',
  'sonnet': 'claude-sonnet-4',
  'opus': 'claude-opus-4',
  'haiku': 'claude-haiku-3.5',
  // OpenAI aliases
  'gpt4o': 'gpt-4o',
  'gpt4': 'gpt-4o',
  'gpt-4': 'gpt-4o',
  'gpt-4-turbo-preview': 'gpt-4-turbo',
  'gpt4-mini': 'gpt-4o-mini',
  'gpt-4o-mini-2024-07-18': 'gpt-4o-mini',
  'chatgpt': 'gpt-4o',
  'o1-preview': 'o1',
  'o1-mini': 'o3-mini',
  // Google aliases
  'gemini-pro': 'gemini-2.5-pro',
  'gemini': 'gemini-2.5-pro',
  'gemini-flash': 'gemini-2.0-flash',
  // DeepSeek aliases
  'deepseek-v3': 'deepseek-chat',
  'deepseek': 'deepseek-chat',
  'deepseek-r1': 'deepseek-reasoner',
  // Open source aliases
  'llama-3.3-70b': 'groq/llama-3.3-70b',
  'llama-70b': 'groq/llama-3.3-70b',
  'llama3': 'groq/llama-3.3-70b',
  'llama': 'groq/llama-3.3-70b',
  'mixtral': 'mistral-large',
  // xAI aliases
  'grok': 'grok-3',
  'grok-mini': 'grok-3-mini',
};

// Normalize model name: resolve aliases, then find in tiers
function resolveModel(input: string): string {
  const q = input.toLowerCase().trim();
  // Check aliases first
  if (MODEL_ALIASES[q]) return MODEL_ALIASES[q];
  // Return as-is if no alias found
  return q;
}

// Find tier for a model — uses exact match after alias resolution
function findModelTier(model: string): string | null {
  const resolved = resolveModel(model);
  // Exact match (case-insensitive)
  for (const [tier, models] of Object.entries(MODEL_TIERS)) {
    for (const m of models) {
      if (m.model.toLowerCase() === resolved) {
        return tier;
      }
    }
  }
  // Partial match — input is substring of a tier model name, or vice versa
  // But only if there's a single unambiguous match
  const matches: Array<{ tier: string; model: string }> = [];
  for (const [tier, models] of Object.entries(MODEL_TIERS)) {
    for (const m of models) {
      const mLower = m.model.toLowerCase();
      if (mLower.includes(resolved) || resolved.includes(mLower)) {
        matches.push({ tier, model: m.model });
      }
    }
  }
  // Only return if all partial matches are in the same tier
  if (matches.length > 0) {
    const tiers = new Set(matches.map(m => m.tier));
    if (tiers.size === 1) return matches[0].tier;
    // Ambiguous — prefer the match where the model name is closest in length
    const sorted = matches.sort((a, b) =>
      Math.abs(a.model.length - resolved.length) - Math.abs(b.model.length - resolved.length)
    );
    return sorted[0].tier;
  }
  return null;
}

// Find the specific model entry after alias resolution
function findModelEntry(model: string): { provider: string; model: string; inputPerMToken: number; outputPerMToken: number; qualityScore: number; latencyClass: string; contextWindow: number } | null {
  const resolved = resolveModel(model);
  for (const models of Object.values(MODEL_TIERS)) {
    for (const m of models) {
      if (m.model.toLowerCase() === resolved) return m;
    }
  }
  // Partial match fallback
  for (const models of Object.values(MODEL_TIERS)) {
    for (const m of models) {
      if (m.model.toLowerCase().includes(resolved) || resolved.includes(m.model.toLowerCase())) {
        return m;
      }
    }
  }
  return null;
}

// All known model names for error messages
function getKnownModels(): string[] {
  const seen = new Set<string>();
  for (const models of Object.values(MODEL_TIERS)) {
    for (const m of models) {
      seen.add(m.model);
    }
  }
  return [...seen].sort();
}

// Task-to-model recommendation logic
function suggestModel(taskDescription: string, priority: string): { model: string; provider: string; reasoning: string; alternatives: string[] } {
  const task = taskDescription.toLowerCase();

  // Detect task characteristics — score-based to handle overlapping keywords
  let speedScore = 0;
  let qualityScore = 0;
  let costScore = 0;
  let contextScore = 0;
  let codingScore = 0;

  // Speed indicators
  if (task.includes('real-time')) speedScore += 3;
  if (task.includes('autocomplete')) speedScore += 3;
  if (task.includes('low latency') || task.includes('low-latency')) speedScore += 3;
  if (task.includes('chat') && !task.includes('chatbot')) speedScore += 2; // "chat" alone suggests speed
  if (task.includes('fast')) speedScore += 1; // weak signal — could mean anything
  if (task.includes('streaming')) speedScore += 1;
  if (priority === 'speed') speedScore += 5;

  // Quality indicators
  if (task.includes('research')) qualityScore += 3;
  if (task.includes('analysis') || task.includes('analyze')) qualityScore += 3;
  if (task.includes('complex')) qualityScore += 3;
  if (task.includes('reasoning') || task.includes('reason')) qualityScore += 3;
  if (task.includes('math') || task.includes('mathematics')) qualityScore += 3;
  if (task.includes('accurate') || task.includes('accuracy')) qualityScore += 2;
  if (task.includes('careful')) qualityScore += 2;
  if (priority === 'quality') qualityScore += 5;

  // Cost indicators
  if (task.includes('batch')) costScore += 3;
  if (task.includes('bulk')) costScore += 3;
  if (task.includes('large volume')) costScore += 3;
  if (task.includes('classify') || task.includes('classification')) costScore += 3;
  if (task.includes('cheap') || task.includes('cheapest')) costScore += 3;
  if (task.includes('budget')) costScore += 2;
  if (priority === 'cost') costScore += 5;

  // Long context indicators
  if (task.includes('document')) contextScore += 2;
  if (task.includes('book')) contextScore += 3;
  if (task.includes('long context') || task.includes('long-context')) contextScore += 3;
  if (task.includes('summarize') || task.includes('summarization')) contextScore += 2;
  if (task.includes('pdf')) contextScore += 2;
  if (task.includes('transcript')) contextScore += 2;

  // Coding indicators
  if (task.includes('code') || task.includes('coding')) codingScore += 3;
  if (task.includes('programming')) codingScore += 3;
  if (task.includes('debug') || task.includes('debugging')) codingScore += 3;
  if (task.includes('refactor')) codingScore += 3;
  if (task.includes('typescript') || task.includes('python') || task.includes('javascript')) codingScore += 2;
  if (task.includes('api')) codingScore += 1;

  // Find dominant need
  const scores = { speed: speedScore, quality: qualityScore, cost: costScore, context: contextScore, coding: codingScore };
  const dominant = Object.entries(scores).sort(([, a], [, b]) => b - a)[0];

  if (dominant[1] === 0) {
    // No clear signal — balanced default
    return {
      model: 'claude-sonnet-4',
      provider: 'ANTHROPIC',
      reasoning: 'Best overall balance of quality (92/100), cost ($3/$15 per million tokens), and capability. Strong at both coding and general tasks.',
      alternatives: ['gpt-4o-mini ($0.15/$0.60 — cheaper, slightly lower quality)', 'deepseek-chat ($0.27/$1.10 — great value)', 'gemini-2.0-flash ($0.10/$0.40 — fastest)'],
    };
  }

  switch (dominant[0]) {
    case 'speed':
      return {
        model: 'gemini-2.0-flash',
        provider: 'GOOGLE',
        reasoning: 'Fast inference with low cost. Gemini 2.0 Flash offers the best speed/cost ratio for real-time applications at $0.10/$0.40 per million tokens.',
        alternatives: ['gpt-4o-mini ($0.15/$0.60)', 'groq/llama-3.3-70b ($0.59/$0.79)', 'claude-haiku-3.5 ($0.25/$1.25)'],
      };

    case 'quality':
    case 'coding':
      return {
        model: 'claude-sonnet-4',
        provider: 'ANTHROPIC',
        reasoning: 'Best quality/cost ratio for complex tasks and coding. Claude Sonnet 4 scores 92/100 quality at $3/$15 per million tokens — significantly cheaper than frontier models while maintaining excellent performance.',
        alternatives: ['gpt-4o ($2.50/$10.00)', 'gemini-2.5-pro ($1.25/$10.00)', 'deepseek-chat ($0.27/$1.10)'],
      };

    case 'cost':
      return {
        model: 'gemini-2.0-flash-lite',
        provider: 'GOOGLE',
        reasoning: 'Cheapest option at $0.075/$0.30 per million tokens. For bulk/batch workloads, this offers 40-200x savings vs frontier models with acceptable quality for classification and extraction tasks.',
        alternatives: ['gpt-4o-mini ($0.15/$0.60)', 'groq/llama-3.3-70b ($0.59/$0.79)', 'deepseek-chat ($0.27/$1.10)'],
      };

    case 'context':
      return {
        model: 'gemini-2.5-pro',
        provider: 'GOOGLE',
        reasoning: 'Largest context window at 1M tokens, excellent for document processing. At $1.25/$10.00 per million tokens, it\'s cost-effective for long-context workloads.',
        alternatives: ['claude-sonnet-4 (200K context, $3/$15)', 'gpt-4o (128K context, $2.50/$10)'],
      };

    default:
      return {
        model: 'claude-sonnet-4',
        provider: 'ANTHROPIC',
        reasoning: 'Best overall balance of quality (92/100), cost ($3/$15 per million tokens), and capability. Strong at both coding and general tasks.',
        alternatives: ['gpt-4o-mini ($0.15/$0.60 — cheaper, slightly lower quality)', 'deepseek-chat ($0.27/$1.10 — great value)', 'gemini-2.0-flash ($0.10/$0.40 — fastest)'],
      };
  }
}

// Tools that work offline (no API key needed)
const OFFLINE_TOOLS = new Set(['il_estimate_cost', 'il_compare_models', 'il_suggest_model']);

async function main() {
  const apiKey = process.env.INFERLANE_API_KEY;
  const baseUrl = process.env.INFERLANE_BASE_URL;

  // API key is optional — offline tools (estimate, compare, suggest) work without it
  const client = apiKey ? new InferLaneClient(apiKey, baseUrl) : null;

  if (!apiKey) {
    console.error('Note: INFERLANE_API_KEY not set. Running in offline mode.');
    console.error('Tools available: il_estimate_cost, il_compare_models, il_suggest_model');
    console.error('Set API key to unlock: il_check_promotions, il_get_spend, il_route_request');
  }

  const server = new Server(
    { name: 'inferlane', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      // Gate tools that require an API key
      if (!client && !OFFLINE_TOOLS.has(name)) {
        return {
          content: [{
            type: 'text',
            text: `Tool "${name}" requires a InferLane API key. Set INFERLANE_API_KEY in your MCP server config.\n\nFree tools available without API key: il_estimate_cost, il_compare_models, il_suggest_model\n\nGet an API key at https://inferlane.com/dashboard/settings`,
          }],
          isError: true,
        };
      }

      switch (name) {
        case 'il_estimate_cost': {
          const model = (args as any).model as string;
          const inputTokens = (args as any).estimated_input_tokens || 1000;
          const outputTokens = (args as any).estimated_output_tokens || 500;

          try {
            if (!client) throw new Error('offline');
            // Try API first for most accurate data
            const result = await client.estimateCost(model, inputTokens, outputTokens);

            let text = `## Cost Estimate: ${model}\n\n`;
            text += `| Metric | Value |\n|---|---|\n`;
            text += `| Provider | ${result.provider} |\n`;
            text += `| Input tokens | ${result.estimatedInputTokens.toLocaleString()} |\n`;
            text += `| Output tokens | ${result.estimatedOutputTokens.toLocaleString()} |\n`;
            text += `| **Estimated cost** | **$${result.estimatedCost.toFixed(6)}** |\n`;
            text += `| Prefill cost | $${result.breakdown.prefill.toFixed(6)} |\n`;
            text += `| Decode cost | $${result.breakdown.decode.toFixed(6)} |\n\n`;

            if (result.alternatives && result.alternatives.length > 0) {
              text += `### Cheaper Alternatives\n\n`;
              text += `| Model | Provider | Cost | Savings | Quality |\n|---|---|---|---|---|\n`;
              for (const alt of result.alternatives.slice(0, 5)) {
                text += `| ${alt.model} | ${alt.provider} | $${alt.estimatedCost.toFixed(6)} | ${alt.savings} | ${alt.qualityScore}/100 |\n`;
              }
            }

            if (result.activePromotion) {
              const promoDesc = result.activePromotion.rawDescription || result.activePromotion.title || `${result.activePromotion.multiplier}x on ${result.activePromotion.provider}`;
              text += `\n**Active promotion**: ${promoDesc}\n`;
            }

            return { content: [{ type: 'text', text }] };
          } catch {
            // Fallback to local calculation if API is unreachable
            const resolved = resolveModel(model);
            const tier = findModelTier(model);
            if (!tier) {
              const known = getKnownModels().slice(0, 10).join(', ');
              return { content: [{ type: 'text', text: `Unknown model: "${model}". Known models include: ${known}` }] };
            }

            const models = MODEL_TIERS[tier];
            let text = `## Cost Estimate: ${model} (${tier} tier)\n\n`;
            text += `| Model | Provider | Input $/M | Output $/M | Est. Cost | Quality |\n|---|---|---|---|---|---|\n`;
            for (const m of models) {
              const cost = (inputTokens * m.inputPerMToken / 1_000_000) + (outputTokens * m.outputPerMToken / 1_000_000);
              const isMatch = m.model.toLowerCase() === resolved || m.model.toLowerCase().includes(resolved) || resolved.includes(m.model.toLowerCase());
              const marker = isMatch ? ' **\u2190**' : '';
              text += `| ${m.model}${marker} | ${m.provider} | $${m.inputPerMToken} | $${m.outputPerMToken} | $${cost.toFixed(6)} | ${m.qualityScore}/100 |\n`;
            }
            text += `\n_Estimates from local pricing data. Connect to InferLane for real-time pricing._`;
            return { content: [{ type: 'text', text }] };
          }
        }

        case 'il_compare_models': {
          const model = (args as any).model as string;
          const tier = findModelTier(model);

          if (!tier) {
            const known = getKnownModels().slice(0, 10).join(', ');
            return { content: [{ type: 'text', text: `Model "${model}" not found. Known models include: ${known}\n\nYou can also try aliases like: sonnet, opus, haiku, gpt4, gemini, deepseek, llama, grok` }] };
          }

          const models = MODEL_TIERS[tier];
          let text = `## ${tier.charAt(0).toUpperCase() + tier.slice(1)} Tier — Model Comparison\n\n`;
          text += `| Model | Provider | Input $/M | Output $/M | Quality | Latency | Context |\n|---|---|---|---|---|---|---|\n`;

          for (const m of models) {
            text += `| ${m.model} | ${m.provider} | $${m.inputPerMToken} | $${m.outputPerMToken} | ${m.qualityScore}/100 | ${m.latencyClass} | ${(m.contextWindow / 1000).toFixed(0)}K |\n`;
          }

          // Add recommendation
          const cheapest = [...models].sort((a, b) => (a.inputPerMToken + 3 * a.outputPerMToken) - (b.inputPerMToken + 3 * b.outputPerMToken))[0];
          const best = [...models].sort((a, b) => b.qualityScore - a.qualityScore)[0];

          text += `\n**Cheapest**: ${cheapest.model} (${cheapest.provider})\n`;
          text += `**Highest quality**: ${best.model} (${best.provider})\n`;

          return { content: [{ type: 'text', text }] };
        }

        case 'il_check_promotions': {
          try {
            const result = await client!.getPromotions();
            const promos = result.promotions || [];

            if (promos.length === 0) {
              return { content: [{ type: 'text', text: 'No active promotions detected across providers. Check back later — promotions are scanned every 30 minutes.' }] };
            }

            let text = `## Active LLM Provider Promotions\n\n`;
            for (const p of promos) {
              text += `### ${p.provider} — ${p.title || p.type}\n`;
              text += `- **Multiplier**: ${p.multiplier}x\n`;
              if (p.rawDescription) text += `- **Details**: ${p.rawDescription}\n`;
              if (p.endsAt) text += `- **Expires**: ${new Date(p.endsAt).toLocaleDateString()}\n`;
              text += `\n`;
            }

            return { content: [{ type: 'text', text }] };
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            return { content: [{ type: 'text', text: `Unable to fetch promotions: ${msg}` }] };
          }
        }

        case 'il_get_spend': {
          const period = ((args as any).period as string) || 'month';

          try {
            const result = await client!.getSpendSummary(period);

            // Format as markdown table like other tools
            let text = `## Spend Summary (${result.period || period})\n\n`;
            text += `| Metric | Value |\n|---|---|\n`;
            text += `| **Total cost** | **$${(result.totalCost ?? 0).toFixed(4)}** |\n`;
            text += `| Total requests | ${(result.requestCount ?? 0).toLocaleString()} |\n`;
            text += `| Input tokens | ${(result.tokenUsage?.input ?? 0).toLocaleString()} |\n`;
            text += `| Output tokens | ${(result.tokenUsage?.output ?? 0).toLocaleString()} |\n\n`;

            if (result.byProvider && result.byProvider.length > 0) {
              text += `### By Provider\n\n`;
              text += `| Provider | Cost | Requests |\n|---|---|---|\n`;
              for (const p of result.byProvider) {
                text += `| ${p.provider || p._id} | $${(p.totalCost ?? p._sum?.costUsd ?? 0).toFixed(4)} | ${(p.requestCount ?? p._count ?? 0).toLocaleString()} |\n`;
              }
              text += `\n`;
            }

            if (result.byModel && result.byModel.length > 0) {
              text += `### By Model\n\n`;
              text += `| Model | Cost | Requests |\n|---|---|---|\n`;
              for (const m of result.byModel) {
                text += `| ${m.model || m._id} | $${(m.totalCost ?? m._sum?.costUsd ?? 0).toFixed(4)} | ${(m.requestCount ?? m._count ?? 0).toLocaleString()} |\n`;
              }
            }

            return { content: [{ type: 'text', text }] };
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            return { content: [{ type: 'text', text: `Unable to fetch spend data for "${period}": ${msg}` }] };
          }
        }

        case 'il_suggest_model': {
          const taskDescription = (args as any).task_description as string;
          const priority = ((args as any).priority as string) || 'balanced';

          const suggestion = suggestModel(taskDescription, priority);

          let text = `## Model Recommendation\n\n`;
          text += `**Recommended**: ${suggestion.model} (${suggestion.provider})\n\n`;
          text += `${suggestion.reasoning}\n\n`;
          text += `### Alternatives\n`;
          for (const alt of suggestion.alternatives) {
            text += `- ${alt}\n`;
          }

          if ((args as any).max_budget_per_call) {
            const budget = (args as any).max_budget_per_call as number;
            const entry = findModelEntry(suggestion.model);
            if (entry) {
              // Use token estimates from args if available, otherwise sensible defaults
              const estInput = (args as any).estimated_input_tokens || 1000;
              const estOutput = (args as any).estimated_output_tokens || 500;
              const cost = (estInput * entry.inputPerMToken / 1_000_000) + (estOutput * entry.outputPerMToken / 1_000_000);
              text += `\n### Budget Check ($${budget}/call)\n`;
              text += cost <= budget
                ? `${suggestion.model} fits within budget (~$${cost.toFixed(6)}/call at ${estInput.toLocaleString()} input, ${estOutput.toLocaleString()} output tokens)`
                : `${suggestion.model} may exceed budget (~$${cost.toFixed(6)}/call at ${estInput.toLocaleString()} input, ${estOutput.toLocaleString()} output tokens). Consider a cheaper alternative.`;
            }
          }

          return { content: [{ type: 'text', text }] };
        }

        case 'il_route_request': {
          const model = (args as any).model as string;
          const messages = (args as any).messages as any[];
          const routing = (args as any).routing || 'cheapest';
          const maxTokens = (args as any).max_tokens || 1024;
          const budget = (args as any).budget;

          try {
            const result = await client!.chatCompletion(model, messages, { routing, max_tokens: maxTokens, budget });

            let text = '';

            // Handle OpenAI-format responses (OpenAI, DeepSeek, Together, Groq, etc.)
            if (result.choices?.[0]?.message?.content) {
              text = result.choices[0].message.content;
            }
            // Handle Anthropic-format responses
            else if (result.content && Array.isArray(result.content)) {
              text = result.content
                .filter((c: any) => c.type === 'text')
                .map((c: any) => c.text)
                .join('\n');
            }
            // Handle Google Gemini-format responses
            else if (result.candidates?.[0]?.content?.parts) {
              text = result.candidates[0].content.parts
                .filter((p: any) => p.text)
                .map((p: any) => p.text)
                .join('\n');
            }
            // Unknown format — dump as JSON
            else {
              text = JSON.stringify(result, null, 2);
            }

            // Add routing metadata from headers (client stores them on result)
            if (result._il_routed_to || result._il_cost || result._il_routing_reason) {
              text += `\n\n---\n_Routed via InferLane | Provider: ${result._il_routed_to || 'N/A'} | Cost: $${result._il_cost || 'N/A'} | Routing: ${result._il_routing_reason || routing}_`;
            }

            return { content: [{ type: 'text', text }] };
          } catch (error) {
            return { content: [{ type: 'text', text: `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}` }] };
          }
        }

        default:
          return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
      }
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        isError: true,
      };
    }
  });

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
