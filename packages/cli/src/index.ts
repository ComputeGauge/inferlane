#!/usr/bin/env node
// ============================================================================
// @computegauge/cli — AI Compute Cost Tracker
//
// Usage:
//   computegauge status          Show current spend across providers
//   computegauge spend           Monthly spend breakdown
//   computegauge pricing         Model pricing comparison
//   computegauge compare         Compare cost for token counts
//   computegauge budget          Show/set budget status
//   computegauge savings         Get cost optimization tips
//   computegauge version         Show version
//   computegauge help            Show this help
//
// License: Apache-2.0
// ============================================================================

const VERSION = '0.1.0';
const BRAND = '\x1b[33m⚡\x1b[0m'; // Yellow lightning bolt

// ANSI color helpers
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

// Model pricing database
interface ModelPrice {
  provider: string;
  model: string;
  input: number;
  output: number;
  context: number;
}

const MODELS: ModelPrice[] = [
  { provider: 'Anthropic', model: 'claude-opus-4', input: 15.0, output: 75.0, context: 200000 },
  { provider: 'Anthropic', model: 'claude-sonnet-4', input: 3.0, output: 15.0, context: 200000 },
  { provider: 'Anthropic', model: 'claude-haiku-3.5', input: 0.80, output: 4.0, context: 200000 },
  { provider: 'OpenAI', model: 'gpt-4o', input: 2.50, output: 10.0, context: 128000 },
  { provider: 'OpenAI', model: 'gpt-4o-mini', input: 0.15, output: 0.60, context: 128000 },
  { provider: 'OpenAI', model: 'o1', input: 15.0, output: 60.0, context: 200000 },
  { provider: 'OpenAI', model: 'o3-mini', input: 1.10, output: 4.40, context: 200000 },
  { provider: 'Google', model: 'gemini-2.0-flash', input: 0.10, output: 0.40, context: 1000000 },
  { provider: 'Google', model: 'gemini-2.0-pro', input: 1.25, output: 10.0, context: 2000000 },
  { provider: 'DeepSeek', model: 'deepseek-chat', input: 0.14, output: 0.28, context: 128000 },
  { provider: 'DeepSeek', model: 'deepseek-reasoner', input: 0.55, output: 2.19, context: 128000 },
  { provider: 'Groq', model: 'llama-3.3-70b', input: 0.59, output: 0.79, context: 128000 },
  { provider: 'Groq', model: 'llama-3.1-8b', input: 0.05, output: 0.08, context: 128000 },
  { provider: 'Mistral', model: 'mistral-large', input: 2.0, output: 6.0, context: 128000 },
  { provider: 'Mistral', model: 'mistral-small', input: 0.10, output: 0.30, context: 128000 },
  { provider: 'Together', model: 'llama-3.3-70b-turbo', input: 0.88, output: 0.88, context: 128000 },
];

// Detect connected providers from environment
function detectProviders(): string[] {
  const providers: string[] = [];
  if (process.env.ANTHROPIC_API_KEY) providers.push('Anthropic');
  if (process.env.OPENAI_API_KEY) providers.push('OpenAI');
  if (process.env.GOOGLE_API_KEY) providers.push('Google');
  if (process.env.TOGETHER_API_KEY) providers.push('Together');
  if (process.env.GROQ_API_KEY) providers.push('Groq');
  if (process.env.MISTRAL_API_KEY) providers.push('Mistral');
  if (process.env.DEEPSEEK_API_KEY) providers.push('DeepSeek');
  return providers;
}

// Commands
function showHelp(): void {
  console.log(`
${BRAND} ${c.bold}ComputeGauge${c.reset} ${c.dim}v${VERSION}${c.reset}
${c.dim}AI compute cost tracking from your terminal${c.reset}

${c.bold}Commands:${c.reset}
  ${c.cyan}status${c.reset}                     Current spend overview
  ${c.cyan}spend${c.reset} ${c.dim}[--month|--week]${c.reset}     Spend breakdown by provider/model
  ${c.cyan}pricing${c.reset} ${c.dim}[model]${c.reset}            Model pricing comparison
  ${c.cyan}compare${c.reset} ${c.dim}<in> <out>${c.reset}         Compare cost for token counts
  ${c.cyan}budget${c.reset}                     Budget status
  ${c.cyan}savings${c.reset}                    Cost optimization suggestions
  ${c.cyan}version${c.reset}                    Show version
  ${c.cyan}help${c.reset}                       This help message

${c.bold}Environment:${c.reset}
  ${c.dim}Set provider API keys to enable tracking:${c.reset}
  ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, etc.

  ${c.dim}Connect to dashboard for full features:${c.reset}
  COMPUTEGAUGE_DASHBOARD_URL, COMPUTEGAUGE_API_KEY
`);
}

function showStatus(): void {
  const providers = detectProviders();

  console.log(`\n${BRAND} ${c.bold}ComputeGauge Status${c.reset}\n`);

  if (providers.length === 0) {
    console.log(`  ${c.yellow}⚠  No provider API keys detected${c.reset}`);
    console.log(`  ${c.dim}Set ANTHROPIC_API_KEY, OPENAI_API_KEY, etc. in your environment${c.reset}\n`);
  } else {
    console.log(`  ${c.green}●${c.reset} Connected providers: ${providers.map(p => `${c.cyan}${p}${c.reset}`).join(', ')}`);
    console.log(`  ${c.dim}${providers.length} provider${providers.length > 1 ? 's' : ''} configured${c.reset}\n`);
  }

  const dashboardUrl = process.env.COMPUTEGAUGE_DASHBOARD_URL;
  if (dashboardUrl) {
    console.log(`  ${c.green}●${c.reset} Dashboard: ${c.cyan}${dashboardUrl}${c.reset}`);
  } else {
    console.log(`  ${c.gray}○${c.reset} Dashboard: ${c.dim}not connected${c.reset}`);
    console.log(`    ${c.dim}Set COMPUTEGAUGE_DASHBOARD_URL for real-time tracking${c.reset}`);
  }

  console.log(`\n  ${c.dim}Models tracked: ${MODELS.length}${c.reset}`);
  console.log(`  ${c.dim}Providers in database: ${[...new Set(MODELS.map(m => m.provider))].join(', ')}${c.reset}\n`);
}

function showPricing(filter?: string): void {
  let models = MODELS;
  if (filter) {
    const search = filter.toLowerCase();
    models = models.filter(m =>
      m.model.toLowerCase().includes(search) ||
      m.provider.toLowerCase().includes(search)
    );
  }

  if (models.length === 0) {
    console.log(`\n  ${c.red}No models found matching "${filter}"${c.reset}\n`);
    return;
  }

  console.log(`\n${BRAND} ${c.bold}Model Pricing${c.reset} ${c.dim}(per million tokens)${c.reset}\n`);

  // Header
  const header = `  ${c.dim}${'Provider'.padEnd(12)}${'Model'.padEnd(24)}${'Input $/MT'.padEnd(14)}${'Output $/MT'.padEnd(14)}Context${c.reset}`;
  console.log(header);
  console.log(`  ${c.dim}${'─'.repeat(75)}${c.reset}`);

  for (const m of models.sort((a, b) => a.input - b.input)) {
    const inputColor = m.input < 1 ? c.green : m.input < 5 ? c.yellow : c.red;
    const outputColor = m.output < 5 ? c.green : m.output < 20 ? c.yellow : c.red;

    console.log(
      `  ${c.white}${m.provider.padEnd(12)}${c.reset}` +
      `${m.model.padEnd(24)}` +
      `${inputColor}$${m.input.toFixed(2).padStart(7)}${c.reset}${''.padEnd(6)}` +
      `${outputColor}$${m.output.toFixed(2).padStart(7)}${c.reset}${''.padEnd(6)}` +
      `${c.dim}${(m.context / 1000).toFixed(0)}K${c.reset}`
    );
  }

  console.log(`\n  ${c.dim}${models.length} models shown. Prices as of Feb 2026.${c.reset}\n`);
}

function showCompare(inputTokens: number, outputTokens: number): void {
  const costs = MODELS
    .filter(m => m.output > 0) // Exclude embedding-only models
    .map(m => ({
      ...m,
      inputCost: (inputTokens / 1_000_000) * m.input,
      outputCost: (outputTokens / 1_000_000) * m.output,
      totalCost: (inputTokens / 1_000_000) * m.input + (outputTokens / 1_000_000) * m.output,
    }))
    .sort((a, b) => a.totalCost - b.totalCost);

  const cheapest = costs[0];
  const expensive = costs[costs.length - 1];

  console.log(`\n${BRAND} ${c.bold}Cost Comparison${c.reset}`);
  console.log(`  ${c.dim}${inputTokens.toLocaleString()} input + ${outputTokens.toLocaleString()} output tokens${c.reset}\n`);

  const header = `  ${c.dim}${'Provider'.padEnd(12)}${'Model'.padEnd(24)}${'Total Cost'.padEnd(14)}${c.reset}`;
  console.log(header);
  console.log(`  ${c.dim}${'─'.repeat(50)}${c.reset}`);

  for (const cost of costs) {
    const tag = cost === cheapest ? ` ${c.green}← cheapest${c.reset}` :
                cost === expensive ? ` ${c.red}← most expensive${c.reset}` : '';
    const color = cost === cheapest ? c.green : cost === expensive ? c.red : c.white;

    console.log(
      `  ${c.white}${cost.provider.padEnd(12)}${c.reset}` +
      `${cost.model.padEnd(24)}` +
      `${color}$${cost.totalCost.toFixed(4).padStart(10)}${c.reset}${tag}`
    );
  }

  const savings = expensive.totalCost - cheapest.totalCost;
  const pct = ((savings / expensive.totalCost) * 100).toFixed(0);
  console.log(`\n  ${c.green}💰 Save $${savings.toFixed(4)} (${pct}%) by using ${cheapest.provider} ${cheapest.model}${c.reset}\n`);
}

function showBudget(): void {
  const budgets: Record<string, number> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('COMPUTEGAUGE_BUDGET_') && value) {
      const provider = key.replace('COMPUTEGAUGE_BUDGET_', '');
      budgets[provider] = parseFloat(value);
    }
  }

  console.log(`\n${BRAND} ${c.bold}Budget Status${c.reset}\n`);

  if (Object.keys(budgets).length === 0) {
    console.log(`  ${c.yellow}No budgets configured${c.reset}`);
    console.log(`  ${c.dim}Set budgets with environment variables:${c.reset}`);
    console.log(`  ${c.dim}  COMPUTEGAUGE_BUDGET_ANTHROPIC=500${c.reset}`);
    console.log(`  ${c.dim}  COMPUTEGAUGE_BUDGET_OPENAI=300${c.reset}`);
    console.log(`  ${c.dim}  COMPUTEGAUGE_BUDGET_TOTAL=1000${c.reset}`);
  } else {
    for (const [provider, budget] of Object.entries(budgets)) {
      console.log(`  ${c.cyan}${provider.padEnd(15)}${c.reset} $${budget}/month`);
    }
  }

  console.log(`\n  ${c.dim}Connect to dashboard for real-time budget tracking & alerts${c.reset}\n`);
}

function showSavings(): void {
  console.log(`\n${BRAND} ${c.bold}Cost Optimization Tips${c.reset}\n`);

  const tips = [
    { icon: '🔄', title: 'Use smaller models for simple tasks', desc: 'GPT-4o-mini & Haiku are 10-50x cheaper for classification, extraction, Q&A' },
    { icon: '📦', title: 'Batch API requests', desc: 'Anthropic: 50% discount. OpenAI: async batch at reduced rates' },
    { icon: '💾', title: 'Cache common prompts', desc: 'Anthropic Prompt Caching: 90% reduction on repeated system prompts' },
    { icon: '✂️', title: 'Reduce output tokens', desc: 'Ask for concise responses. Output costs 3-5x more than input' },
    { icon: '🐉', title: 'DeepSeek for code tasks', desc: 'Matches GPT-4o on coding benchmarks at ~5% of the cost' },
    { icon: '⚡', title: 'Groq for speed + cost', desc: 'Llama 3.1-8B: $0.05/MT input, fastest inference available' },
  ];

  for (const tip of tips) {
    console.log(`  ${tip.icon} ${c.bold}${tip.title}${c.reset}`);
    console.log(`     ${c.dim}${tip.desc}${c.reset}\n`);
  }
}

// Main
function main(): void {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  switch (command) {
    case 'status':
      showStatus();
      break;
    case 'spend':
      showStatus(); // TODO: wire to real spend data
      break;
    case 'pricing':
      showPricing(args[1]);
      break;
    case 'compare': {
      const input = parseInt(args[1]);
      const output = parseInt(args[2]);
      if (isNaN(input) || isNaN(output)) {
        console.log(`\n  ${c.red}Usage: computegauge compare <input_tokens> <output_tokens>${c.reset}`);
        console.log(`  ${c.dim}Example: computegauge compare 10000 2000${c.reset}\n`);
        break;
      }
      showCompare(input, output);
      break;
    }
    case 'budget':
      showBudget();
      break;
    case 'savings':
    case 'optimize':
      showSavings();
      break;
    case 'version':
    case '-v':
    case '--version':
      console.log(`${BRAND} ComputeGauge CLI v${VERSION}`);
      break;
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      showHelp();
      break;
    default:
      console.log(`\n  ${c.red}Unknown command: ${command}${c.reset}`);
      console.log(`  ${c.dim}Run 'computegauge help' for available commands${c.reset}\n`);
  }
}

main();
