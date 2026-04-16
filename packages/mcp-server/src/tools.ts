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
  // ── Compute Exchange tools (agents as buyers AND sellers) ──
  {
    name: 'il_exchange_spot',
    description: 'Query the InferLane Compute Exchange for the cheapest available inference capacity right now. Returns ranked offers from centralized providers (Anthropic, OpenAI off-peak H100s) and decentralized operators (Darkbloom Apple Silicon, OpenClaw GPUs). Use when comparing live spot prices across the full market, or when the user wants to find the absolute cheapest way to run a workload. This queries real capacity listings, not static pricing tables.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        model: {
          type: 'string',
          description: 'Model to query spot pricing for (e.g., "claude-sonnet-4-5", "llama-3.3-70b", "gemma-4-27b")',
        },
        input_tokens: {
          type: 'number',
          description: 'Estimated input tokens for the workload. Default: 2000',
        },
        output_tokens: {
          type: 'number',
          description: 'Estimated output tokens for the workload. Default: 500',
        },
        require_attestation: {
          type: 'boolean',
          description: 'Only return TEE-attested providers (hardware-verified execution). Default: false',
        },
        provider_type: {
          type: 'string',
          enum: ['CENTRALIZED', 'DECENTRALIZED', 'any'],
          description: 'Filter by provider type. Default: "any"',
        },
      },
      required: ['model'],
    },
  },
  {
    name: 'il_exchange_offers',
    description: 'List all active capacity offers on the InferLane Compute Exchange order book. Shows who is selling compute, at what price, on what hardware, and whether the execution is TEE-attested. Use when the user wants to see the full market, browse available capacity, or compare provider types (centralized vs decentralized). Returns offers sorted by input price ascending (cheapest first).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        model: {
          type: 'string',
          description: 'Filter by model name (optional)',
        },
        provider_type: {
          type: 'string',
          enum: ['CENTRALIZED', 'DECENTRALIZED', 'HYBRID'],
          description: 'Filter by provider type (optional)',
        },
        attested_only: {
          type: 'boolean',
          description: 'Only show TEE-attested offers (optional)',
        },
      },
    },
  },
  {
    name: 'il_exchange_list_capacity',
    description: 'List your own compute capacity on the InferLane Compute Exchange as a seller. Other agents and users can then route inference workloads to your hardware at the price you set. Use when the user wants to monetize idle GPU/Apple Silicon compute, or when an agent is managing a fleet and wants to sell excess capacity during off-peak hours. Requires an InferLane API key with operator permissions.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        model: {
          type: 'string',
          description: 'Model you can serve (e.g., "llama-3.3-70b", "gemma-4-27b")',
        },
        input_price_per_mtok: {
          type: 'number',
          description: 'Price per million input tokens in USD (e.g., 0.35)',
        },
        output_price_per_mtok: {
          type: 'number',
          description: 'Price per million output tokens in USD (e.g., 1.05)',
        },
        max_tokens_per_sec: {
          type: 'number',
          description: 'Maximum throughput in tokens per second',
        },
        gpu_type: {
          type: 'string',
          description: 'Hardware type (e.g., "Apple M4 Max", "H100", "RTX 4090")',
        },
        hours_available: {
          type: 'number',
          description: 'How many hours from now this capacity is available. Default: 24',
        },
        require_attestation: {
          type: 'boolean',
          description: 'Require buyers to use TEE-attested execution path. Default: false',
        },
      },
      required: ['model', 'input_price_per_mtok', 'output_price_per_mtok', 'max_tokens_per_sec'],
    },
  },
] as const;

export type ToolName = typeof TOOLS[number]['name'];
