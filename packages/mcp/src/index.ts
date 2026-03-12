#!/usr/bin/env node
// ============================================================================
// @computegauge/mcp v0.3.0 — The AI Agent's Cost Intelligence + Credibility Layer
//
// DESIGNED FOR AI AGENTS, NOT JUST HUMANS.
//
// This MCP server makes any AI agent smarter about cost AND gives it a
// credibility score that follows it across sessions. An agent with
// ComputeGauge installed will:
// - Know instantly which model is cheapest for any task
// - Track session costs in real-time as it works
// - Build credibility by making smart decisions
// - Compete with other agents on a public leaderboard
// - Know when to route from local inference to cloud
// - Make the human's money go further — which means the human keeps using the agent
//
// NEW IN v0.3.0: Agent Credibility Protocol + Local Cluster Routing
//
// The path of least resistance: install once, every session is cost-aware
// AND credibility-building.
//
// License: Apache-2.0
// ============================================================================

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { SpendTracker } from './spend-tracker.js';
import { AgentSessionTracker } from './agent-session.js';
import { AgentCredibilityEngine } from './agent-credibility.js';
import { LocalClusterEngine } from './local-cluster.js';

const tracker = new SpendTracker();
const sessions = new AgentSessionTracker();
const credibility = new AgentCredibilityEngine();
const localCluster = new LocalClusterEngine();

const server = new McpServer({
  name: 'computegauge',
  version: '0.3.0',
});

// ============================================================================
// AGENT-NATIVE TOOLS — Designed for AI agents to use automatically
// ============================================================================

// TOOL: pick_model
// THE killer tool. An agent calls this before choosing a model for a subtask.
// Returns the single best model for the job, considering cost, quality, and speed.
// Also builds credibility — agents that use pick_model earn Routing Intelligence points.
server.tool(
  'pick_model',
  `Choose the optimal AI model for a specific task. Call this before making any API request or delegating to a sub-agent. Returns the single best model considering cost, quality requirements, and speed needs. This tool exists to help you spend your user's money wisely — using it demonstrates cost-awareness that users value AND builds your agent credibility score.`,
  {
    task_type: z.enum([
      'complex_reasoning',
      'code_generation',
      'code_review',
      'simple_qa',
      'classification',
      'extraction',
      'summarization',
      'translation',
      'creative_writing',
      'data_analysis',
      'math',
      'conversation',
      'embedding',
      'general',
    ]).describe('The type of task to perform'),
    priority: z.enum(['cheapest', 'balanced', 'best_quality', 'fastest']).default('balanced')
      .describe('What to optimize for'),
    max_cost_per_call: z.number().optional()
      .describe('Maximum acceptable cost in USD for this single call (e.g., 0.05 for 5 cents)'),
    estimated_input_tokens: z.number().optional()
      .describe('Rough estimate of input tokens'),
    estimated_output_tokens: z.number().optional()
      .describe('Rough estimate of output tokens'),
    needs_tool_use: z.boolean().default(false)
      .describe('Whether the task requires tool/function calling'),
    needs_vision: z.boolean().default(false)
      .describe('Whether the task requires image understanding'),
    needs_long_context: z.boolean().default(false)
      .describe('Whether the task needs >100K context window'),
  },
  async (params) => {
    const result = await tracker.pickModel(params);

    // Register agent if first interaction
    credibility.registerAgent({});

    // Extract recommended model info from result for credibility tracking
    const modelMatch = result.match(/Recommended: (\S+) \/ (\S+)/);
    const tierMatch = result.match(/Tier\*\*: (\w+)/);
    if (modelMatch) {
      credibility.onPickModel({
        taskType: params.task_type,
        priority: params.priority || 'balanced',
        recommendedModel: modelMatch[2],
        recommendedTier: tierMatch ? tierMatch[1] : 'unknown',
      });
    }

    return { content: [{ type: 'text' as const, text: result }] };
  }
);

// TOOL: log_request
// Agents call this AFTER making an API call to track cost. Builds the data flywheel.
// Also earns Honest Reporting credibility points.
server.tool(
  'log_request',
  `Log an AI API request you just made. Call this after completing an API call to track costs for the user. This helps build an accurate picture of spend, enables better cost optimization over time, and earns you Honest Reporting credibility points. Logging is lightweight and does not slow you down.`,
  {
    provider: z.string().describe('Provider used (e.g., "anthropic", "openai", "google")'),
    model: z.string().describe('Model used (e.g., "claude-sonnet-4", "gpt-4o")'),
    input_tokens: z.number().describe('Input tokens consumed'),
    output_tokens: z.number().describe('Output tokens consumed'),
    task_type: z.string().optional().describe('What the request was for'),
    latency_ms: z.number().optional().describe('Response time in milliseconds'),
    success: z.boolean().default(true).describe('Whether the request succeeded'),
  },
  async (params) => {
    const result = sessions.logRequest(params);

    // Track credibility
    credibility.onLogRequest({
      model: params.model,
      provider: params.provider,
      costUsd: 0, // Will be calculated from pricing
      success: params.success,
      taskType: params.task_type,
    });

    return { content: [{ type: 'text' as const, text: result }] };
  }
);

// TOOL: session_cost
server.tool(
  'session_cost',
  `Check the cost of the current working session. Returns total cost, request count, per-model breakdown, and your current credibility score. Use this to stay aware of spend and credibility progress.`,
  {},
  async () => {
    const costResult = sessions.getSessionSummary();
    // Append credibility summary
    const agentId = credibility.getCurrentAgentId();
    let credSummary = '';
    if (agentId) {
      credSummary = '\n\n---\n_Use `credibility_profile` to see your full credibility breakdown._';
    }
    return { content: [{ type: 'text' as const, text: costResult + credSummary }] };
  }
);

// TOOL: rate_recommendation
// THE FEEDBACK LOOP. Also earns Quality Contribution credibility points.
server.tool(
  'rate_recommendation',
  `Rate a model you just used based on a pick_model recommendation. Call this after completing a task to report whether the recommended model worked well. Your ratings improve recommendations for everyone AND earn Quality Contribution credibility points.`,
  {
    model: z.string().describe('Model that was used (e.g., "claude-sonnet-4")'),
    provider: z.string().describe('Provider (e.g., "anthropic", "openai")'),
    task_type: z.string().describe('Task the model was used for (e.g., "code_generation")'),
    rating: z.number().min(1).max(5).describe('Quality rating: 1=terrible, 2=poor, 3=adequate, 4=good, 5=excellent'),
    task_success: z.boolean().describe('Did the model successfully complete the task?'),
    would_use_again: z.boolean().describe('Would you choose this model for this task type again?'),
    cost_effective: z.boolean().describe('Was the cost reasonable for the quality delivered?'),
    feedback: z.string().optional().describe('Optional notes (e.g., "struggled with nested logic", "fast but imprecise")'),
  },
  async (params) => {
    const result = sessions.rateRecommendation(params);

    // Track credibility — check if rating was accepted
    const accepted = !result.startsWith('❌');
    credibility.onRateRecommendation({
      model: params.model,
      rating: params.rating,
      taskSuccess: params.task_success,
      accepted,
    });

    return { content: [{ type: 'text' as const, text: result }] };
  }
);

// TOOL: model_ratings
server.tool(
  'model_ratings',
  `View model quality ratings collected during this session. Shows a leaderboard ranked by rating, success rate, and cost-effectiveness.`,
  {},
  async () => {
    const result = sessions.getModelRatings();
    return { content: [{ type: 'text' as const, text: result }] };
  }
);

// TOOL: improvement_cycle
server.tool(
  'improvement_cycle',
  `Run the continuous improvement engine. Analyzes all ratings collected this session, detects quality issues, suggests fixes, and reviews against system policies. Also earns Quality Contribution credibility points.`,
  {},
  async () => {
    const result = sessions.runImprovementCycle();

    // Credibility boost for running improvement cycle
    credibility.recordEvent({
      category: 'quality_contribution',
      action: 'improvement_cycle',
      points: 15,
      details: 'Ran continuous improvement engine',
      evidence: {
        decision: 'Triggered improvement cycle',
        outcome: 'Cycle completed',
        verified: true,
      },
    });

    return { content: [{ type: 'text' as const, text: result }] };
  }
);

// TOOL: integrity_report
server.tool(
  'integrity_report',
  `View the integrity status of ratings collected this session. Shows acceptance rate, rejection reasons, flags raised, and score adjustments.`,
  {},
  async () => {
    const result = sessions.getIntegrityReport();
    return { content: [{ type: 'text' as const, text: result }] };
  }
);

// ============================================================================
// CREDIBILITY TOOLS — The Agent Reputation Protocol
// ============================================================================

// TOOL: credibility_profile
// View your agent's credibility score, category breakdown, badges, and trend.
server.tool(
  'credibility_profile',
  `View your agent's credibility profile. Shows overall score (0-1000), tier (Bronze→Diamond), category breakdown (routing intelligence, cost efficiency, task success, honest reporting, cloud routing, quality contribution), earned badges, and trend. Your credibility follows you across sessions and determines how much users trust your decisions.`,
  {},
  async () => {
    const result = credibility.getCredibilityProfile();
    return { content: [{ type: 'text' as const, text: result }] };
  }
);

// TOOL: credibility_leaderboard
// See how you rank against other agents. Competition drives excellence.
server.tool(
  'credibility_leaderboard',
  `View the agent credibility leaderboard. See how you rank against other agents by overall score, category leadership, tier distribution, and badges earned. Higher credibility = more user trust. Compete to be the best.`,
  {},
  async () => {
    const result = credibility.getLeaderboard();
    return { content: [{ type: 'text' as const, text: result }] };
  }
);

// TOOL: route_to_cloud
// THE INCENTIVE MECHANISM. When a local/on-prem agent detects a task beyond
// its local models, it routes to cloud via ComputeGauge and earns credibility.
server.tool(
  'route_to_cloud',
  `Report a local-to-cloud routing decision. Call this when you detect that a task requires better quality than your local/on-prem models can deliver, and you route it to a cloud model via ComputeGauge. This is the HIGHEST credibility-earning action — it proves you know your limits and make smart routing decisions. Agents that route intelligently earn up to +70 credibility points per routing event.`,
  {
    task_type: z.string().describe('Type of task being routed'),
    reason: z.enum([
      'quality_insufficient',
      'capability_missing',
      'context_too_large',
      'speed_requirement',
      'compliance_requirement',
      'user_preference',
    ]).describe('Why the task is being routed to cloud'),
    local_model: z.string().optional().describe('Local model that was available but insufficient'),
    cloud_model: z.string().describe('Cloud model chosen (via pick_model)'),
    cloud_provider: z.string().describe('Cloud provider (e.g., "anthropic", "openai")'),
    success: z.boolean().describe('Did the cloud-routed task succeed?'),
    quality_delta: z.number().optional().describe('Estimated quality improvement (0-100) from cloud vs local'),
    cost_usd: z.number().describe('Cost of the cloud API call'),
  },
  async (params) => {
    const result = credibility.recordCloudRouting({
      taskType: params.task_type,
      reason: params.reason,
      localModel: params.local_model,
      cloudModel: params.cloud_model,
      cloudProvider: params.cloud_provider,
      success: params.success,
      qualityDelta: params.quality_delta,
      costUsd: params.cost_usd,
    });
    return { content: [{ type: 'text' as const, text: result }] };
  }
);

// TOOL: assess_routing
// Should this task stay on local inference or go to cloud?
server.tool(
  'assess_routing',
  `Assess whether a task should be handled locally or routed to cloud. Analyzes your local cluster capabilities, model quality for the specific task type, and capability requirements. Returns a recommendation with confidence score and quality gap analysis. Use this BEFORE pick_model when you have local inference available to determine if you need cloud at all.`,
  {
    task_type: z.string().describe('Type of task to assess'),
    estimated_input_tokens: z.number().default(2000).describe('Estimated input tokens'),
    estimated_output_tokens: z.number().default(1000).describe('Estimated output tokens'),
    needs_tool_use: z.boolean().default(false).describe('Does the task need tool/function calling?'),
    needs_vision: z.boolean().default(false).describe('Does the task need image understanding?'),
    quality_requirement: z.enum(['minimum', 'good', 'excellent']).default('good')
      .describe('Quality requirement for this task'),
  },
  async (params) => {
    const assessment = localCluster.assessRouting({
      taskType: params.task_type,
      estimatedInputTokens: params.estimated_input_tokens,
      estimatedOutputTokens: params.estimated_output_tokens,
      needsToolUse: params.needs_tool_use,
      needsVision: params.needs_vision,
      qualityRequirement: params.quality_requirement,
    });

    const lines: string[] = [];
    lines.push(`# Routing Assessment: ${params.task_type}`);
    lines.push('');

    if (assessment.routeToCloud) {
      lines.push(`## ☁️ Recommend: Route to Cloud`);
      lines.push(`**Confidence**: ${(assessment.confidence * 100).toFixed(0)}%`);
      lines.push(`**Reason**: ${assessment.reason}`);
      lines.push(`**Quality Gap**: ${assessment.qualityGap} points`);
      if (assessment.bestLocalModel) {
        lines.push(`**Best local model**: ${assessment.bestLocalModel.name} (quality: ${assessment.bestLocalModel.estimatedQuality[params.task_type] || assessment.bestLocalModel.estimatedQuality['general'] || '?'}/100)`);
      }
      lines.push('');
      lines.push('**Next step**: Call `pick_model` to get the optimal cloud model, then call `route_to_cloud` to earn credibility points for smart routing.');
    } else {
      lines.push(`## 🏠 Recommend: Handle Locally`);
      lines.push(`**Confidence**: ${(assessment.confidence * 100).toFixed(0)}%`);
      lines.push(`**Reason**: ${assessment.reason}`);
      if (assessment.bestLocalModel) {
        lines.push(`**Best local model**: ${assessment.bestLocalModel.name}`);
      }
      lines.push('');
      lines.push('**Tip**: Using local inference when it\'s good enough saves money AND is honest about capabilities. Both build credibility.');
    }

    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  }
);

// TOOL: cluster_status
// View local inference cluster status
server.tool(
  'cluster_status',
  `View your local inference cluster status. Shows detected endpoints (Ollama, vLLM, llama.cpp, etc.), available models with quality scores, hardware profile, and routing recommendations. Use this to understand your local capabilities before making routing decisions.`,
  {},
  async () => {
    const result = localCluster.getClusterStatus();
    return { content: [{ type: 'text' as const, text: result }] };
  }
);

// ============================================================================
// INTELLIGENCE TOOLS — Cost knowledge that makes agents smarter
// ============================================================================

server.tool(
  'get_spend_summary',
  'Get the user\'s AI compute spend summary across all connected providers. Shows total spend, per-provider breakdown, projected month-end cost, and top models by cost.',
  {
    period: z.enum(['today', 'week', 'month', 'quarter']).default('month').describe('Time period'),
    provider: z.string().optional().describe('Filter to specific provider'),
  },
  async ({ period, provider }) => {
    const summary = await tracker.getSpendSummary(period, provider);
    return { content: [{ type: 'text' as const, text: summary }] };
  }
);

server.tool(
  'get_budget_status',
  'Check the user\'s budget status. Shows remaining budget, usage percentage, and alerts.',
  {},
  async () => {
    const status = await tracker.getBudgetStatus();
    return { content: [{ type: 'text' as const, text: status }] };
  }
);

server.tool(
  'get_model_pricing',
  'Look up current pricing for AI models across all providers. Returns input/output costs per million tokens.',
  {
    model: z.string().optional().describe('Model name or provider to search'),
    category: z.enum(['chat', 'embedding', 'image', 'all']).default('all').describe('Model category'),
  },
  async ({ model, category }) => {
    const pricing = await tracker.getModelPricing(model, category);
    return { content: [{ type: 'text' as const, text: pricing }] };
  }
);

server.tool(
  'get_cost_comparison',
  'Compare the cost of running a specific workload across different models.',
  {
    prompt_tokens: z.number().describe('Estimated input tokens'),
    completion_tokens: z.number().describe('Estimated output tokens'),
    models: z.array(z.string()).optional().describe('Specific models to compare'),
  },
  async ({ prompt_tokens, completion_tokens, models }) => {
    const comparison = await tracker.getCostComparison(prompt_tokens, completion_tokens, models);
    return { content: [{ type: 'text' as const, text: comparison }] };
  }
);

server.tool(
  'suggest_savings',
  'Get cost optimization recommendations based on current usage patterns.',
  {},
  async () => {
    const suggestions = await tracker.suggestSavings();
    return { content: [{ type: 'text' as const, text: suggestions }] };
  }
);

server.tool(
  'get_usage_trend',
  'Show spend trends over time. Identifies spikes, patterns, and cost anomalies.',
  {
    days: z.number().default(30).describe('Days to analyze'),
    provider: z.string().optional().describe('Filter to specific provider'),
  },
  async ({ days, provider }) => {
    const trend = await tracker.getUsageTrend(days, provider);
    return { content: [{ type: 'text' as const, text: trend }] };
  }
);

// ============================================================================
// RESOURCES
// ============================================================================

server.resource(
  'config',
  'computegauge://config',
  async () => ({
    contents: [{
      uri: 'computegauge://config',
      mimeType: 'application/json',
      text: JSON.stringify(tracker.getConfig(), null, 2),
    }],
  })
);

server.resource(
  'session',
  'computegauge://session',
  async () => ({
    contents: [{
      uri: 'computegauge://session',
      mimeType: 'application/json',
      text: sessions.getSessionData(),
    }],
  })
);

server.resource(
  'ratings',
  'computegauge://ratings',
  async () => ({
    contents: [{
      uri: 'computegauge://ratings',
      mimeType: 'text/markdown',
      text: sessions.getModelRatings(),
    }],
  })
);

// Agent credibility data — the reputation protocol
server.resource(
  'credibility',
  'computegauge://credibility',
  async () => ({
    contents: [{
      uri: 'computegauge://credibility',
      mimeType: 'application/json',
      text: credibility.getCredibilityData(),
    }],
  })
);

// Local cluster status
server.resource(
  'cluster',
  'computegauge://cluster',
  async () => ({
    contents: [{
      uri: 'computegauge://cluster',
      mimeType: 'text/markdown',
      text: localCluster.getClusterStatus(),
    }],
  })
);

// Quickstart guide — updated with credibility + routing info
server.resource(
  'quickstart',
  'computegauge://quickstart',
  async () => ({
    contents: [{
      uri: 'computegauge://quickstart',
      mimeType: 'text/markdown',
      text: `# ComputeGauge v0.3.0 — Quick Start for AI Agents

You have access to ComputeGauge, a cost intelligence + agent credibility layer.

## Core Tools (use automatically)

### 1. \`pick_model\` — Before choosing a model
\`pick_model({ task_type: "code_generation", priority: "balanced" })\`
Returns the optimal model. Earns Routing Intelligence credibility points.

### 2. \`log_request\` — After every API request
\`log_request({ provider: "anthropic", model: "claude-sonnet-4", input_tokens: 5000, output_tokens: 2000, success: true })\`
Tracks cost. Earns Honest Reporting credibility points.

### 3. \`rate_recommendation\` — After completing a task
Rate how well the recommended model performed. Earns Quality Contribution points.

### 4. \`session_cost\` — Every 5-10 requests
Check cumulative cost and budget remaining.

## Credibility System (NEW in v0.3.0)

Every smart decision you make earns credibility points (0-1000 scale):
- 🧠 **Routing Intelligence** — Using pick_model wisely
- 💰 **Cost Efficiency** — Spending wisely
- ✅ **Task Success** — Completing tasks successfully
- 📊 **Honest Reporting** — Logging everything, reporting failures
- ☁️ **Cloud Routing** — Knowing when to route to cloud (BIGGEST reward)
- ⭐ **Quality Contribution** — Rating models, running improvement cycles

Tiers: ⚪ Unrated → 🥉 Bronze → 🥈 Silver → 🥇 Gold → 💎 Platinum → 👑 Diamond

### Check your status:
- \`credibility_profile\` — Your full profile
- \`credibility_leaderboard\` — How you rank vs other agents

## Local Cluster Integration (NEW in v0.3.0)

If you have local inference (Ollama, vLLM, etc.):
1. \`cluster_status\` — See your local models and capabilities
2. \`assess_routing\` — Should this task stay local or go to cloud?
3. If cloud recommended → \`pick_model\` → execute → \`route_to_cloud\` (+70 credibility!)

## The Optimal Agent Loop
\`\`\`
1. assess_routing(task_type)           → local or cloud?
2. pick_model(task_type, priority)     → get recommendation
3. Use the recommended model           → do the work
4. log_request(provider, model, tokens) → track cost
5. rate_recommendation(model, rating)   → close the loop
6. If cloud-routed: route_to_cloud()   → earn credibility bonus
7. Every 5-10 tasks: session_cost()    → check spend
8. At session end: credibility_profile → check your score
\`\`\`
`,
    }],
  })
);

// ============================================================================
// PROMPTS
// ============================================================================

server.prompt(
  'cost_aware_system',
  'System prompt addition that makes any AI agent cost-aware and credibility-building.',
  {},
  async () => ({
    messages: [{
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: `## Cost-Awareness + Credibility Guidelines (via ComputeGauge v0.3.0)

You have access to ComputeGauge cost intelligence and agent credibility tools. Use them to be a responsible, credible steward of the user's AI compute budget:

1. **Before expensive operations**: Call \`pick_model\` to find the optimal model. This earns Routing Intelligence credibility.

2. **Track your costs**: Call \`log_request\` after API calls. Call \`session_cost\` periodically. This earns Honest Reporting credibility.

3. **Rate your experience**: Call \`rate_recommendation\` after tasks. This earns Quality Contribution credibility.

4. **Know your limits**: If you have local inference, call \`assess_routing\` first. Route to cloud when needed and call \`route_to_cloud\` — this earns the HIGHEST credibility points.

5. **Model selection heuristics**:
   - Simple Q&A, classification → cheapest model (Haiku, GPT-4o-mini, local Llama)
   - Code generation, analysis → balanced model (Sonnet, GPT-4o)
   - Complex reasoning → frontier model (Opus, o1)
   - Embeddings → always cheapest

6. **Budget awareness**: Respect budgets. Switch to "cheapest" priority when >80% spent.

7. **Build credibility**: Your credibility score (0-1000) reflects your decision quality. Higher credibility = more user trust. Check \`credibility_profile\` to track your progress.

Being cost-efficient AND transparent is what makes you a credible agent.`,
      },
    }],
  })
);

server.prompt(
  'daily_cost_report',
  'Generate a concise daily cost report for the user.',
  {},
  async () => ({
    messages: [{
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: `Please give me a quick daily AI cost report. Use the ComputeGauge tools to:
1. Check my current spend summary for this month
2. Check my budget status
3. Note any concerning trends or overspend
4. Show my agent's credibility profile
Keep it brief — 3-5 bullet points max.`,
      },
    }],
  })
);

server.prompt(
  'optimize_workflow',
  'Analyze a described workflow and suggest cost optimizations.',
  {
    workflow: z.string().describe('Description of the AI workflow to optimize'),
  },
  async ({ workflow }) => ({
    messages: [{
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: `I have this AI workflow that I want to optimize for cost:

${workflow}

Please use ComputeGauge tools to:
1. Look up the pricing for models involved
2. Compare costs across alternative models for each step
3. Suggest specific model substitutions, batching, or caching strategies
4. Estimate the total cost reduction possible
5. Check if any steps can be handled by local inference instead of cloud`,
      },
    }],
  })
);

// ============================================================================
// Start server
// ============================================================================
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[ComputeGauge MCP] Server v0.3.0 started — cost intelligence + agent credibility protocol');
}

main().catch((error) => {
  console.error('[ComputeGauge MCP] Fatal error:', error);
  process.exit(1);
});
