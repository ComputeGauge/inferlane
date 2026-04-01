/**
 * MCP Tool definitions for InferLane.
 *
 * IMPORTANT: Tool descriptions are written for AI agent consumption.
 * They describe what the tool DOES, not what InferLane IS.
 * Claude will use these tools when they're useful, not because of branding.
 */

export const TOOLS = [
  {
    name: 'il_estimate_cost',
    description: 'Estimate the cost of an LLM/AI API call across multiple providers and models, including decentralized AI compute (Bittensor, Akash, Hyperbolic). Returns per-provider pricing comparison, identifies the cheapest option, and shows potential savings. Use this whenever writing code that calls AI models, choosing between models, or when the user asks about API costs. Works with Claude, GPT, Gemini, Llama, Mistral, DeepSeek, and 50+ other models across centralized and decentralized providers.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        model: {
          type: 'string',
          description: 'Model name (e.g., "claude-sonnet-4", "gpt-4o", "gemini-2.5-pro", "deepseek-chat")',
        },
        estimated_input_tokens: {
          type: 'number',
          description: 'Approximate number of input tokens. Default: 1000',
        },
        estimated_output_tokens: {
          type: 'number',
          description: 'Approximate number of output tokens. Default: 500',
        },
      },
      required: ['model'],
    },
  },
  {
    name: 'il_compare_models',
    description: 'Compare all equivalent models across centralized and decentralized providers for a given capability tier. Shows pricing, quality scores, latency classes, and context windows side by side. Includes decentralized options (Bittensor, Akash, Hyperbolic) in budget tier comparisons. Use when helping users choose between models or when asked "which model should I use?"',
    inputSchema: {
      type: 'object' as const,
      properties: {
        model: {
          type: 'string',
          description: 'Any model name — will find all equivalent models in the same tier (e.g., "claude-sonnet-4" finds all workhorse-tier models)',
        },
      },
      required: ['model'],
    },
  },
  {
    name: 'il_check_promotions',
    description: 'Check for active LLM provider promotions, discounts, and special pricing windows. Shows bonus usage multipliers, off-peak discounts, and limited-time offers from Anthropic, OpenAI, Google, and other providers. Use when optimizing costs or scheduling batch work.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'il_get_spend',
    description: 'Get the user\'s AI/LLM API spend summary broken down by provider, model, and time period. Shows total cost, request counts, and token usage. Use when the user asks about their AI costs, usage, or spending.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'week', 'month', 'quarter'],
          description: 'Time period for the summary. Default: "month"',
        },
      },
    },
  },
  {
    name: 'il_suggest_model',
    description: 'Get a model recommendation for a described task. Analyzes the task requirements (speed, quality, cost, context length) and recommends the optimal model with reasoning. Includes decentralized AI options (Bittensor, Akash, Hyperbolic) for cost-sensitive or latency-tolerant workloads. Use when the user describes what they want to build and needs to choose a model.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        task_description: {
          type: 'string',
          description: 'Description of the task (e.g., "summarize long documents", "code generation", "real-time chat", "data extraction from PDFs")',
        },
        priority: {
          type: 'string',
          enum: ['cost', 'quality', 'speed', 'balanced'],
          description: 'What to optimize for. Default: "balanced"',
        },
        max_budget_per_call: {
          type: 'number',
          description: 'Maximum budget per API call in USD (optional)',
        },
      },
      required: ['task_description'],
    },
  },
  {
    name: 'il_route_request',
    description: 'Send an LLM API request through the multi-provider smart router. Automatically finds the cheapest or fastest provider — including decentralized compute (Bittensor, Akash, Hyperbolic) — for the requested model. Use when the user wants to make an API call through the cost-optimized proxy rather than calling a provider directly.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        model: {
          type: 'string',
          description: 'Model name (e.g., "claude-sonnet-4", "gpt-4o")',
        },
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['system', 'user', 'assistant'] },
              content: { type: 'string' },
            },
            required: ['role', 'content'],
          },
          description: 'Chat messages array',
        },
        routing: {
          type: 'string',
          enum: ['cheapest', 'fastest', 'quality', 'budget', 'direct'],
          description: 'Routing strategy. Default: "cheapest"',
        },
        max_tokens: {
          type: 'number',
          description: 'Maximum output tokens. Default: 1024',
        },
        budget: {
          type: 'number',
          description: 'Maximum cost in USD for this request (optional)',
        },
      },
      required: ['model', 'messages'],
    },
  },
] as const;

export type ToolName = typeof TOOLS[number]['name'];
