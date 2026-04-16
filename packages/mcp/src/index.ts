#!/usr/bin/env node
// ============================================================================
// @inferlane/mcp v0.5.0 — The AI Agent's Cost Intelligence + Credibility Layer
//
// DESIGNED FOR AI AGENTS, NOT JUST HUMANS.
//
// This MCP server makes any AI agent smarter about cost AND gives it a
// credibility score that follows it across sessions. An agent with
// InferLane installed will:
// - Know instantly which model is cheapest for any task
// - Track session costs in real-time as it works
// - Build credibility by making smart decisions
// - Compete with other agents on a public leaderboard
// - Know when to route from local inference to cloud
// - Make the human's money go further — which means the human keeps using the agent
//
// NEW IN v0.5.0: Token tachometer, agent traffic light, SSE event stream, rating sync
// v0.4.0: SQLite persistence, budget enforcement, per-agent identity, rating aggregation
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
import { PlatformClient } from './platform-client.js';
import { PersistenceLayer } from './persistence.js';
import { TokenTachometer } from './tachometer.js';
import { AgentTrafficLightSystem, type AgentLifecyclePhase } from './traffic-light.js';
import { EventStream } from './event-stream.js';
import { RatingSync } from './rating-sync.js';
import { StateOfComputeReport } from './state-of-compute.js';

const tracker = new SpendTracker();
const sessions = new AgentSessionTracker();
const credibility = new AgentCredibilityEngine();
const localCluster = new LocalClusterEngine();

// SQLite persistence — optional, graceful fallback to in-memory if unavailable
const persistence = new PersistenceLayer();

// v0.5 systems
const tachometer = new TokenTachometer();
const trafficLight = new AgentTrafficLightSystem();
const eventStream = new EventStream();

// Load persisted ratings into the quality engine (the network effect bootstrap)
if (persistence.available) {
  const persistedRatings = persistence.loadRatings(undefined, 1000);
  tracker.loadPersistedRatings(persistedRatings.map(r => ({
    model: r.model,
    taskType: r.taskType,
    rating: r.rating,
  })));

  // Load persisted monthly spend into budget tracker
  const monthSpend = persistence.getCurrentMonthSpend();
  if (monthSpend > 0) {
    tracker.recordSpend(monthSpend);
    console.error(`[InferLane MCP] Restored $${monthSpend.toFixed(4)} monthly spend from persistence`);
  }
}

// Load persisted lifecycle transitions into traffic light system
if (persistence.available) {
  const lifecycleTransitions = persistence.loadLifecycleTransitions(undefined, 500);
  if (lifecycleTransitions.length > 0) {
    trafficLight.loadLifecycleHistory(lifecycleTransitions.map(t => ({
      agentId: t.agentId,
      from: t.fromPhase as AgentLifecyclePhase,
      to: t.toPhase as AgentLifecyclePhase,
      timestamp: new Date(t.createdAt || Date.now()).getTime(),
      tokensDuringPhase: t.tokensDuringPhase,
      costDuringPhase: t.costDuringPhase,
      durationMs: t.durationMs,
    })));
    console.error(`[InferLane MCP] Restored ${lifecycleTransitions.length} lifecycle transitions from persistence`);
  }
}

// Wire lifecycle transitions to persistence and event stream
trafficLight.onLifecycleTransition((transition) => {
  // Persist
  if (persistence.available) {
    persistence.saveLifecycleTransition({
      agentId: transition.agentId,
      fromPhase: transition.from,
      toPhase: transition.to,
      tokensDuringPhase: transition.tokensDuringPhase,
      costDuringPhase: transition.costDuringPhase,
      durationMs: transition.durationMs,
    });
  }
  // Push to SSE
  eventStream.emitLifecycleTransition({
    agentId: transition.agentId,
    from: transition.from,
    to: transition.to,
    tokensDuringPhase: transition.tokensDuringPhase,
    costDuringPhase: transition.costDuringPhase,
    durationMs: transition.durationMs,
  });
});

// Platform client — connects to InferLane API when API key is available
const apiKey = process.env.INFERLANE_API_KEY;
const baseUrl = process.env.INFERLANE_BASE_URL;
const platformClient = apiKey ? new PlatformClient(apiKey, baseUrl) : null;

// Rating sync — opt-in anonymous rating upload to platform
const ratingSync = new RatingSync(platformClient, persistence);

// State of Compute report generator
const computeReport = new StateOfComputeReport(persistence, tracker);

// Upgrade nudge state — track log_request calls for periodic nudges
let logRequestCallCount = 0;
let logRequestTotalCost = 0;
const hasApiKey = !!process.env.INFERLANE_API_KEY || !!apiKey;

// Wire event stream to tachometer and traffic light
eventStream.setProviders({
  getTachometer: () => tachometer.getReading(),
  getTrafficLight: () => trafficLight.getSummary(),
});

// Subscribe tachometer and traffic light to push events via SSE
tachometer.onUpdate((reading) => eventStream.emitTachometer(reading));
trafficLight.onStatusChange((agentId, status) => eventStream.emitStatusChange(agentId, status));

const server = new McpServer({
  name: 'inferlane',
  version: '0.5.0',
});

// Shared agent_id schema — optional parameter for per-agent identity tracking
const agentIdSchema = z.string().optional()
  .describe('Unique agent identifier for per-agent cost tracking and credibility. Use a consistent ID across sessions.');

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
    agent_id: agentIdSchema,
  },
  async (params) => {
    // Traffic light: agent is selecting a model
    trafficLight.onToolCall(params.agent_id || 'default', 'pick_model', params.task_type);

    const result = await tracker.pickModel(params);

    // Budget exhausted — blocked entirely
    if (result.blocked) {
      const budgetCheck = tracker.checkBudget(0);
      const resetDate = budgetCheck.resetAt.split('T')[0];
      const text = `## Budget Exhausted\n\nMonthly budget of $${budgetCheck.monthlyBudget.toFixed(2)} has been reached ($${budgetCheck.monthSpend.toFixed(2)} spent). Resets on ${resetDate}.\n\nTo continue, increase your budget via INFERLANE_BUDGET_TOTAL environment variable.`;
      return { content: [{ type: 'text' as const, text }] };
    }

    // Register agent if first interaction
    credibility.registerAgent({}, params.agent_id);

    // Extract recommended model info from result for credibility tracking
    const modelMatch = result.text.match(/Recommended: (\S+) \/ (\S+)/);
    const tierMatch = result.text.match(/Tier\*\*: (\w+)/);
    if (modelMatch) {
      credibility.onPickModel({
        taskType: params.task_type,
        priority: params.priority || 'balanced',
        recommendedModel: modelMatch[2],
        recommendedTier: tierMatch ? tierMatch[1] : 'unknown',
      }, params.agent_id);
    }

    // Append budget warning if present
    let text = result.text;
    if (result.budgetWarning) {
      text += `\n\n⚠️ Budget warning: ${result.budgetWarning}`;
    }

    // Upgrade nudge — suggest platform dispatch when no API key
    if (!hasApiKey) {
      text += `\n\n> 💡 **Auto-route to this model instantly** — set \`INFERLANE_API_KEY\` to enable smart dispatch. Get your key at [inferlane.dev](https://inferlane.dev)`;
    }

    return { content: [{ type: 'text' as const, text }] };
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
    agent_id: agentIdSchema,
  },
  async (params) => {
    // Traffic light: agent just completed an API call
    trafficLight.onToolCall(params.agent_id || 'default', 'log_request', params.task_type);

    const result = sessions.logRequest(params);

    // Record spend against monthly budget
    const cost = tracker.estimateCost(params.model, params.input_tokens, params.output_tokens);
    tracker.recordSpend(cost);

    // Feed tachometer — total tokens flowing through the system
    const totalTokens = params.input_tokens + params.output_tokens;
    tachometer.recordTokenFlow(params.provider, params.model, totalTokens, cost);

    // Persist request log to SQLite
    persistence.logRequest({
      agentId: params.agent_id,
      provider: params.provider,
      model: params.model,
      inputTokens: params.input_tokens,
      outputTokens: params.output_tokens,
      cost,
      taskType: params.task_type,
      latencyMs: params.latency_ms,
      success: params.success,
    });

    // Track credibility
    credibility.onLogRequest({
      model: params.model,
      provider: params.provider,
      costUsd: cost,
      success: params.success,
      taskType: params.task_type,
    }, params.agent_id);

    // Accumulate tokens/cost for lifecycle phase tracking (Stream AG)
    trafficLight.accumulatePhaseUsage(params.agent_id || 'default', totalTokens, cost);

    // Track log_request calls for periodic upgrade nudge
    logRequestCallCount++;
    logRequestTotalCost += cost;

    let logText = result;
    if (!hasApiKey && logRequestCallCount > 0 && logRequestCallCount % 10 === 0) {
      logText += `\n\n> 💰 **You've logged ${logRequestCallCount} requests totaling $${logRequestTotalCost.toFixed(4)}.** Smart routing could save up to 78%. Get your API key at [inferlane.dev](https://inferlane.dev)`;
    }

    return { content: [{ type: 'text' as const, text: logText }] };
  }
);

// TOOL: session_cost
server.tool(
  'session_cost',
  `Check the cost of the current working session. Returns total cost, request count, per-model breakdown, and your current credibility score. Use this to stay aware of spend and credibility progress.`,
  {
    agent_id: agentIdSchema,
  },
  async (params) => {
    trafficLight.onToolCall(params.agent_id || 'default', 'session_cost');
    const costResult = sessions.getSessionSummary(params.agent_id);
    // Append credibility summary
    const agentId = credibility.getCurrentAgentId();
    let credSummary = '';
    if (agentId) {
      credSummary = '\n\n---\n_Use `credibility_profile` to see your full credibility breakdown._';
    }

    // Upgrade nudge
    let sessionNudge = '';
    if (!hasApiKey) {
      sessionNudge = '\n\n> 📊 **Track savings & trends over time** — set `INFERLANE_API_KEY` to unlock savings intelligence. [inferlane.dev](https://inferlane.dev)';
    }

    return { content: [{ type: 'text' as const, text: costResult + credSummary + sessionNudge }] };
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
    agent_id: agentIdSchema,
  },
  async (params) => {
    // Traffic light: agent finished a task
    trafficLight.onToolCall(params.agent_id || 'default', 'rate_recommendation', params.task_type);

    const result = sessions.rateRecommendation(params);

    // Track credibility — check if rating was accepted
    const accepted = !result.startsWith('❌');
    credibility.onRateRecommendation({
      model: params.model,
      rating: params.rating,
      taskSuccess: params.task_success,
      accepted,
    }, params.agent_id);

    // Persist rating to SQLite AND feed into live quality engine (the network effect)
    if (accepted) {
      persistence.saveRating({
        model: params.model,
        provider: params.provider,
        taskType: params.task_type,
        rating: params.rating,
        agentId: params.agent_id,
      });

      // Live quality adjustment — immediately improves pick_model for this session
      tracker.ingestRating(params.model, params.task_type, params.rating);

      // Rating sync — opt-in anonymous upload to platform
      ratingSync.onNewRating();
    }

    // Emit rating event to SSE clients
    eventStream.emitRating({
      model: params.model,
      taskType: params.task_type,
      rating: params.rating,
      accepted,
    });

    return { content: [{ type: 'text' as const, text: result }] };
  }
);

// TOOL: model_ratings
server.tool(
  'model_ratings',
  `View model quality ratings — both this session's ratings and aggregated historical data that improves pick_model recommendations. More ratings = smarter recommendations for everyone.`,
  {},
  async () => {
    const sessionRatings = sessions.getModelRatings();

    // Append aggregated rating stats from the quality engine
    const aggStats = tracker.getRatingStats();
    let output = sessionRatings;

    if (aggStats.length > 0) {
      const aggLines: string[] = [
        '',
        '---',
        '## Aggregated Quality Intelligence',
        '',
        'These ratings improve `pick_model` recommendations. More data = smarter model selection.',
        '',
        '| Model | Avg Rating | # Ratings | Quality Weight |',
        '|---|---|---|---|',
      ];
      for (const s of aggStats) {
        aggLines.push(`| ${s.model} | ${s.avgRating.toFixed(1)}/5 | ${s.count} | ${s.adjustment} |`);
      }

      // Also show persisted totals if available
      if (persistence.available) {
        const persisted = persistence.getAggregatedRatings();
        if (persisted.length > 0) {
          aggLines.push('');
          aggLines.push('### All-Time Persisted Ratings');
          aggLines.push('');
          aggLines.push('| Model | Provider | Avg | Total | Task Types |');
          aggLines.push('|---|---|---|---|---|');
          for (const p of persisted) {
            aggLines.push(`| ${p.model} | ${p.provider} | ${p.avgRating.toFixed(1)} | ${p.totalRatings} | ${p.taskTypes.join(', ')} |`);
          }
        }
      }

      output += aggLines.join('\n');
    }

    return { content: [{ type: 'text' as const, text: output }] };
  }
);

// TOOL: improvement_cycle
server.tool(
  'improvement_cycle',
  `Run the continuous improvement engine. Analyzes all ratings collected this session, detects quality issues, suggests fixes, and reviews against system policies. Also earns Quality Contribution credibility points.`,
  {},
  async () => {
    trafficLight.onToolCall('default', 'improvement_cycle');
    const result = sessions.runImprovementCycle();

    // Trigger rating sync on improvement cycle (natural sync point)
    ratingSync.sync().catch(() => {});

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
  {
    agent_id: agentIdSchema,
  },
  async (params) => {
    trafficLight.onToolCall(params.agent_id || 'default', 'credibility_profile');
    const result = credibility.getCredibilityProfile(params.agent_id);

    // Persist credibility scores on profile view (lazy save)
    const agentId = params.agent_id || credibility.getCurrentAgentId() || 'default';
    const raw = credibility.getRawProfile(agentId);
    if (raw && persistence.available) {
      persistence.saveCredibility(agentId, {
        score: raw.score,
        routingIntelligence: raw.categories.routing_intelligence ?? 0,
        costEfficiency: raw.categories.cost_efficiency ?? 0,
        taskSuccess: raw.categories.task_success ?? 0,
        honestReporting: raw.categories.honest_reporting ?? 0,
        cloudRouting: raw.categories.cloud_routing ?? 0,
        qualityContribution: raw.categories.quality_contribution ?? 0,
      });
    }

    // Upgrade nudge
    let credText = result;
    if (!hasApiKey) {
      credText += `\n\n> 🏆 **Unlock cloud routing bonuses & leaderboard competition** — connect to the InferLane platform with \`INFERLANE_API_KEY\`. [inferlane.dev](https://inferlane.dev)`;
    }

    return { content: [{ type: 'text' as const, text: credText }] };
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
// its local models, it routes to cloud via InferLane and earns credibility.
server.tool(
  'route_to_cloud',
  `Report a local-to-cloud routing decision. Call this when you detect that a task requires better quality than your local/on-prem models can deliver, and you route it to a cloud model via InferLane. This is the HIGHEST credibility-earning action — it proves you know your limits and make smart routing decisions. Agents that route intelligently earn up to +70 credibility points per routing event.`,
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
    agent_id: agentIdSchema,
  },
  async (params) => {
    trafficLight.onToolCall(params.agent_id || 'default', 'route_to_cloud', params.task_type);
    const result = credibility.recordCloudRouting({
      taskType: params.task_type,
      reason: params.reason,
      localModel: params.local_model,
      cloudModel: params.cloud_model,
      cloudProvider: params.cloud_provider,
      success: params.success,
      qualityDelta: params.quality_delta,
      costUsd: params.cost_usd,
    }, params.agent_id);
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
    trafficLight.onToolCall('default', 'assess_routing', params.task_type);
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

    // Upgrade nudge
    if (!hasApiKey) {
      lines.push('');
      lines.push('> ☁️ **Execute this routing decision automatically** — dispatch with `INFERLANE_API_KEY`. [inferlane.dev](https://inferlane.dev)');
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

    // Upgrade nudge
    let compText = comparison;
    if (!hasApiKey) {
      compText += `\n\n> 🔄 **Route to the cheapest option automatically** — InferLane dispatch picks the best provider per-request. Set \`INFERLANE_API_KEY\` → [inferlane.dev](https://inferlane.dev)`;
    }

    return { content: [{ type: 'text' as const, text: compText }] };
  }
);

server.tool(
  'suggest_savings',
  'Get cost optimization recommendations based on current usage patterns.',
  {},
  async () => {
    const suggestions = await tracker.suggestSavings();

    // Upgrade nudge
    let savingsText = suggestions;
    if (!hasApiKey) {
      savingsText += `\n\n> ⚡ **Enable auto-routing to save automatically** — smart dispatch routes every request to the cheapest viable provider. Set \`INFERLANE_API_KEY\` → [inferlane.dev](https://inferlane.dev)`;
    }

    return { content: [{ type: 'text' as const, text: savingsText }] };
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
// PLATFORM-CONNECTED TOOLS — Require INFERLANE_API_KEY
// ============================================================================

// TOOL: check_promotions
server.tool(
  'check_promotions',
  `Check active promotions and discounts on the InferLane platform. Shows current deals, multipliers, and expiry dates across providers. Requires INFERLANE_API_KEY.`,
  {},
  async () => {
    if (!platformClient) {
      return { content: [{ type: 'text' as const, text: 'Set INFERLANE_API_KEY to unlock platform features. Get a free key at https://inferlane.dev' }] };
    }
    try {
      const data: any = await platformClient.getPromotions();
      const promos = Array.isArray(data) ? data : (data.promotions || []);
      if (promos.length === 0) {
        return { content: [{ type: 'text' as const, text: '# Active Promotions\n\nNo active promotions right now. Check back later!' }] };
      }
      const lines: string[] = ['# Active Promotions', '', '| Provider | Title | Multiplier | Description | Ends |', '|---|---|---|---|---|'];
      for (const p of promos) {
        lines.push(`| ${p.provider || '—'} | ${p.title || '—'} | ${p.multiplier || '—'}x | ${p.rawDescription || p.description || '—'} | ${p.endsAt || '—'} |`);
      }
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err: any) {
      return { content: [{ type: 'text' as const, text: `Error fetching promotions: ${err.message}` }] };
    }
  }
);

// TOOL: platform_spend
server.tool(
  'platform_spend',
  `Get your real spend summary from the InferLane platform. Shows actual billed totals, per-provider and per-model breakdowns. More accurate than local tracking. Requires INFERLANE_API_KEY.`,
  {
    period: z.enum(['today', 'week', 'month', 'quarter']).default('month').describe('Time period to summarize'),
  },
  async ({ period }) => {
    if (!platformClient) {
      return { content: [{ type: 'text' as const, text: 'Set INFERLANE_API_KEY to unlock platform features. Get a free key at https://inferlane.dev' }] };
    }
    try {
      const data: any = await platformClient.getSpendSummary(period);
      const lines: string[] = [`# Platform Spend Summary (${period})`, ''];

      if (data.total !== undefined) {
        lines.push(`**Total**: $${Number(data.total).toFixed(4)}`);
      }

      if (data.byProvider && typeof data.byProvider === 'object') {
        lines.push('', '## By Provider', '', '| Provider | Spend |', '|---|---|');
        for (const [provider, amount] of Object.entries(data.byProvider)) {
          lines.push(`| ${provider} | $${Number(amount).toFixed(4)} |`);
        }
      }

      if (data.byModel && typeof data.byModel === 'object') {
        lines.push('', '## By Model', '', '| Model | Spend |', '|---|---|');
        for (const [model, amount] of Object.entries(data.byModel)) {
          lines.push(`| ${model} | $${Number(amount).toFixed(4)} |`);
        }
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err: any) {
      return { content: [{ type: 'text' as const, text: `Error fetching spend summary: ${err.message}` }] };
    }
  }
);

// TOOL: platform_budget
server.tool(
  'platform_budget',
  `Get your budget status from the InferLane platform. Shows plan, budget limit, current spend, and remaining balance. Requires INFERLANE_API_KEY.`,
  {},
  async () => {
    if (!platformClient) {
      return { content: [{ type: 'text' as const, text: 'Set INFERLANE_API_KEY to unlock platform features. Get a free key at https://inferlane.dev' }] };
    }
    try {
      const data: any = await platformClient.getBudgetStatus();
      const lines: string[] = ['# Platform Budget Status', ''];

      if (data.plan) lines.push(`**Plan**: ${data.plan}`);
      if (data.budget !== undefined) lines.push(`**Budget**: $${Number(data.budget).toFixed(2)}`);
      if (data.spend !== undefined) lines.push(`**Spend**: $${Number(data.spend).toFixed(4)}`);
      if (data.remaining !== undefined) lines.push(`**Remaining**: $${Number(data.remaining).toFixed(2)}`);
      if (data.budget && data.spend) {
        const pct = ((Number(data.spend) / Number(data.budget)) * 100).toFixed(1);
        lines.push(`**Usage**: ${pct}%`);
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err: any) {
      return { content: [{ type: 'text' as const, text: `Error fetching budget status: ${err.message}` }] };
    }
  }
);

// TOOL: route_via_platform
server.tool(
  'route_via_platform',
  `Send a chat completion request through the InferLane platform router. Routes to the cheapest/best provider automatically. Supports OpenAI, Anthropic, and Gemini models. Returns the response plus routing metadata (which provider served it, cost, routing reason). Requires INFERLANE_API_KEY.`,
  {
    model: z.string().describe('Model to request (e.g., "gpt-4o", "claude-sonnet-4", "gemini-2.0-flash"). The platform will route to the cheapest provider.'),
    messages: z.array(z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string(),
    })).describe('Chat messages in OpenAI format'),
    routing: z.enum(['cheapest', 'fastest', 'balanced', 'quality']).default('cheapest')
      .describe('Routing strategy'),
    budget: z.number().optional()
      .describe('Max cost in USD for this request'),
    max_tokens: z.number().default(1024)
      .describe('Maximum output tokens'),
  },
  async ({ model, messages, routing, budget, max_tokens }) => {
    trafficLight.onToolCall('default', 'route_via_platform');

    if (!platformClient) {
      return { content: [{ type: 'text' as const, text: 'Set INFERLANE_API_KEY to unlock platform features. Get a free key at https://inferlane.dev' }] };
    }

    // Budget enforcement: estimate cost and check before making the API call
    if (tracker.budgetEnabled) {
      // Rough estimate: count message content characters / 4 as input tokens
      const estInputTokens = messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
      const estOutputTokens = max_tokens;
      const estimatedCost = tracker.estimateCost(model, estInputTokens, estOutputTokens);
      const budgetCheck = tracker.checkBudget(estimatedCost);

      if (!budgetCheck.allowed) {
        const resetDate = budgetCheck.resetAt.split('T')[0];
        const text = `## Budget Exhausted\n\nMonthly budget of $${budgetCheck.monthlyBudget.toFixed(2)} has been reached ($${budgetCheck.monthSpend.toFixed(2)} spent). Resets on ${resetDate}.\n\nEstimated cost for this request: $${estimatedCost.toFixed(4)}, remaining budget: $${budgetCheck.remaining.toFixed(2)}.\n\nTo continue, increase your budget via INFERLANE_BUDGET_TOTAL environment variable.`;
        return { content: [{ type: 'text' as const, text }] };
      }
    }

    try {
      const result: any = await platformClient.chatCompletion(model, messages, {
        routing,
        budget,
        max_tokens,
      });

      // Record actual cost from routing metadata, or estimate if not available
      const actualCost = result._il_cost ? parseFloat(result._il_cost) : 0;
      if (actualCost > 0) {
        tracker.recordSpend(actualCost);
      }

      // Extract response content — handle OpenAI, Anthropic, and Gemini formats
      let responseText = '';

      // OpenAI format
      if (result.choices?.[0]?.message?.content) {
        responseText = result.choices[0].message.content;
      }
      // Anthropic format
      else if (result.content && Array.isArray(result.content)) {
        responseText = result.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('\n');
      }
      // Gemini format
      else if (result.candidates?.[0]?.content?.parts) {
        responseText = result.candidates[0].content.parts
          .filter((p: any) => p.text)
          .map((p: any) => p.text)
          .join('\n');
      }
      // Fallback
      else {
        responseText = JSON.stringify(result, null, 2);
      }

      // Append routing metadata footer
      const metaLines: string[] = [];
      if (result._il_routed_to) metaLines.push(`**Routed to**: ${result._il_routed_to}`);
      if (result._il_cost) metaLines.push(`**Cost**: $${result._il_cost}`);
      if (result._il_routing_reason) metaLines.push(`**Routing reason**: ${result._il_routing_reason}`);
      if (result._il_savings) metaLines.push(`**Savings**: ${result._il_savings}`);
      if (result._il_fallback) metaLines.push(`**Fallback**: ${result._il_fallback}`);

      let output = responseText;
      if (metaLines.length > 0) {
        output += '\n\n---\n_Routing metadata:_\n' + metaLines.join('\n');
      }

      return { content: [{ type: 'text' as const, text: output }] };
    } catch (err: any) {
      return { content: [{ type: 'text' as const, text: `Error routing request: ${err.message}` }] };
    }
  }
);

// ============================================================================
// REAL-TIME MONITORING TOOLS — v0.5.0
// ============================================================================

// TOOL: token_tachometer
server.tool(
  'token_tachometer',
  `View real-time token velocity flowing through the system. Shows tokens/sec, cost/sec, state (IDLE→ACTIVE→HIGH_LOAD→REDLINE), per-provider breakdown, velocity windows (5s/15s/60s), and a sparkline of token throughput over the last 60 seconds. The gauge redlines when multiple LLMs run concurrently or token throughput exceeds 2000/sec.`,
  {},
  async () => {
    const display = tachometer.formatDisplay();
    return { content: [{ type: 'text' as const, text: display }] };
  }
);

// TOOL: agent_status
server.tool(
  'agent_status',
  `View the traffic light status of agents. Each agent has a color: 🟢 GREEN (idle), 🟡 AMBER (processing), 🔴 RED (blocked/needs input), 🔵 BLUE (task completed). Shows per-agent status, task details, duration, ETA, and recent transitions. Status is automatically tracked via tool calls.`,
  {
    agent_id: z.string().optional().describe('View a specific agent, or omit for all agents'),
  },
  async (params) => {
    const display = trafficLight.formatDisplay(params.agent_id);
    return { content: [{ type: 'text' as const, text: display }] };
  }
);

// TOOL: set_agent_status
server.tool(
  'set_agent_status',
  `Manually set an agent's traffic light status. Use this when automatic status tracking doesn't capture the right state — e.g., when an agent is blocked waiting for user input (RED) or has completed a major task (BLUE). Status changes are pushed to SSE clients in real-time.`,
  {
    agent_id: agentIdSchema,
    color: z.enum(['green', 'amber', 'red', 'blue']).describe('Traffic light color: green=idle, amber=processing, red=blocked, blue=completed'),
    label: z.string().optional().describe('Status label (e.g., "Waiting for approval", "Analyzing codebase")'),
    detail: z.string().optional().describe('Additional context'),
    task_type: z.string().optional().describe('Current task type'),
    estimated_seconds: z.number().optional().describe('Estimated time remaining for amber state'),
  },
  async (params) => {
    const agentId = params.agent_id || 'default';
    const status = trafficLight.setStatus(agentId, params.color, params.label, {
      detail: params.detail,
      taskType: params.task_type,
      estimatedMs: params.estimated_seconds ? params.estimated_seconds * 1000 : undefined,
    });
    const emoji = { green: '🟢', amber: '🟡', red: '🔴', blue: '🔵' }[params.color];
    return { content: [{ type: 'text' as const, text: `${emoji} Agent \`${agentId}\` status set to **${params.color.toUpperCase()}**: ${status.label}` }] };
  }
);

// TOOL: set_lifecycle_phase
server.tool(
  'set_lifecycle_phase',
  `Track an agent's workflow lifecycle phase for cost-per-phase analysis. Phases: idle, coding, testing, pr_open, ci_running, ci_passed, ci_failed, review_pending, changes_requested, approved, merged, deployed. Each phase transition records tokens consumed and cost accrued during the previous phase. This data powers the "State of Compute" report showing where agents spend the most compute.`,
  {
    agent_id: agentIdSchema,
    phase: z.enum(['idle', 'coding', 'testing', 'pr_open', 'ci_running', 'ci_passed', 'ci_failed', 'review_pending', 'changes_requested', 'approved', 'merged', 'deployed'])
      .describe('The lifecycle phase the agent is entering'),
    detail: z.string().optional().describe('Additional context (e.g., "PR #42", "test suite: unit")'),
    task_type: z.string().optional().describe('Current task type'),
  },
  async (params) => {
    const agentId = params.agent_id || 'default';
    const { status, transition } = trafficLight.setLifecyclePhase(agentId, params.phase, {
      detail: params.detail,
      taskType: params.task_type,
    });

    const lines: string[] = [];
    const phaseEmojis: Record<string, string> = {
      idle: '⏸️', coding: '💻', testing: '🧪', pr_open: '📬',
      ci_running: '⚙️', ci_passed: '✅', ci_failed: '❌', review_pending: '👀',
      changes_requested: '📝', approved: '👍', merged: '🔀', deployed: '🚀',
    };
    const emoji = phaseEmojis[params.phase] || '•';

    lines.push(`${emoji} Agent \`${agentId}\` → **${params.phase}**`);

    if (transition) {
      lines.push(`Previous phase \`${transition.from}\`: ${transition.tokensDuringPhase} tokens, $${transition.costDuringPhase.toFixed(4)}, ${Math.floor(transition.durationMs / 1000)}s`);
    }

    return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
  }
);

// TOOL: lifecycle_report
server.tool(
  'lifecycle_report',
  `View a cost-per-phase breakdown of agent lifecycle transitions. Shows which phases (coding, testing, CI, review, etc.) consume the most tokens and cost. Use this to identify workflow inefficiencies — for example, if ci_failed retries account for 30% of total cost, the agent should invest more in testing before pushing.`,
  {
    agent_id: z.string().optional().describe('View a specific agent, or omit for all agents'),
    period: z.enum(['today', 'week', 'month', 'all']).default('all').describe('Time period to report on'),
  },
  async (params) => {
    // If period is specified and persistence is available, use persisted data for richer history
    if (params.period !== 'all' && persistence.available) {
      const breakdown = persistence.getLifecyclePhaseBreakdown(params.agent_id, params.period);
      const phases = Object.entries(breakdown);

      if (phases.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No lifecycle data recorded for this period. Use `set_lifecycle_phase` to track agent workflow phases.' }] };
      }

      const totalCost = phases.reduce((sum, [, d]) => sum + d.totalCost, 0);
      const totalTokens = phases.reduce((sum, [, d]) => sum + d.totalTokens, 0);

      const lines: string[] = [];
      lines.push(`# Lifecycle Report (${params.period})${params.agent_id ? ` — ${params.agent_id}` : ''}`);
      lines.push('');
      lines.push(`**Total**: ${totalTokens.toLocaleString()} tokens, $${totalCost.toFixed(4)}`);
      lines.push('');
      lines.push('| Phase | Count | Tokens | Cost | % of Cost |');
      lines.push('|-------|-------|--------|------|-----------|');

      for (const [phase, data] of phases.sort(([, a], [, b]) => b.totalCost - a.totalCost)) {
        const pct = totalCost > 0 ? ((data.totalCost / totalCost) * 100).toFixed(1) : '0.0';
        lines.push(`| ${phase} | ${data.count} | ${data.totalTokens.toLocaleString()} | $${data.totalCost.toFixed(4)} | ${pct}% |`);
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    }

    // Use in-memory lifecycle history
    const display = trafficLight.formatLifecycleReport(params.agent_id);
    return { content: [{ type: 'text' as const, text: display }] };
  }
);

// TOOL: state_of_compute
server.tool(
  'state_of_compute',
  `Generate a "State of AI Compute" report — a comprehensive analysis of compute costs, provider distribution, model quality rankings, pricing comparisons, and agent lifecycle cost-per-phase breakdown. This report is ready to publish as a blog post or share with stakeholders. Shows which providers are cheapest, which models have the best quality scores, and where agents spend the most compute.`,
  {
    period: z.enum(['week', 'month', 'quarter']).default('month').describe('Report period'),
    title: z.string().optional().describe('Custom report title'),
  },
  async (params) => {
    const report = computeReport.generate({
      period: params.period,
      title: params.title,
    });
    return { content: [{ type: 'text' as const, text: report }] };
  }
);

// TOOL: sync_ratings
server.tool(
  'sync_ratings',
  `View rating sync status and optionally trigger a manual sync. When INFERLANE_RATING_SYNC=true, anonymous model ratings are periodically uploaded to the platform, improving pick_model recommendations for everyone. Only model name, task type, rating, and timestamp are synced — no prompts or user identifiers.`,
  {
    trigger_sync: z.boolean().default(false).describe('Set to true to trigger an immediate sync'),
  },
  async (params) => {
    if (params.trigger_sync && ratingSync.enabled) {
      const synced = await ratingSync.sync();
      const display = ratingSync.formatDisplay();
      return { content: [{ type: 'text' as const, text: `${display}\n\n_Manual sync completed: ${synced} ratings synced._` }] };
    }
    const display = ratingSync.formatDisplay();
    return { content: [{ type: 'text' as const, text: display }] };
  }
);

// ============================================================================
// RESOURCES
// ============================================================================

server.resource(
  'config',
  'inferlane://config',
  async () => ({
    contents: [{
      uri: 'inferlane://config',
      mimeType: 'application/json',
      text: JSON.stringify(tracker.getConfig(), null, 2),
    }],
  })
);

server.resource(
  'session',
  'inferlane://session',
  async () => ({
    contents: [{
      uri: 'inferlane://session',
      mimeType: 'application/json',
      text: sessions.getSessionData(),
    }],
  })
);

server.resource(
  'ratings',
  'inferlane://ratings',
  async () => ({
    contents: [{
      uri: 'inferlane://ratings',
      mimeType: 'text/markdown',
      text: sessions.getModelRatings(),
    }],
  })
);

// Agent credibility data — the reputation protocol
server.resource(
  'credibility',
  'inferlane://credibility',
  async () => ({
    contents: [{
      uri: 'inferlane://credibility',
      mimeType: 'application/json',
      text: credibility.getCredibilityData(),
    }],
  })
);

// Local cluster status
server.resource(
  'cluster',
  'inferlane://cluster',
  async () => ({
    contents: [{
      uri: 'inferlane://cluster',
      mimeType: 'text/markdown',
      text: localCluster.getClusterStatus(),
    }],
  })
);

// Real-time token tachometer
server.resource(
  'tachometer',
  'inferlane://tachometer',
  async () => ({
    contents: [{
      uri: 'inferlane://tachometer',
      mimeType: 'application/json',
      text: JSON.stringify(tachometer.getReading(), null, 2),
    }],
  })
);

// Agent traffic light status
server.resource(
  'traffic-light',
  'inferlane://traffic-light',
  async () => ({
    contents: [{
      uri: 'inferlane://traffic-light',
      mimeType: 'application/json',
      text: JSON.stringify(trafficLight.getSummary(), null, 2),
    }],
  })
);

// Quickstart guide — updated with credibility + routing info
server.resource(
  'quickstart',
  'inferlane://quickstart',
  async () => ({
    contents: [{
      uri: 'inferlane://quickstart',
      mimeType: 'text/markdown',
      text: `# InferLane v0.5.0 — Quick Start for AI Agents

You have access to InferLane, a cost intelligence + agent credibility layer.

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

## Real-Time Monitoring (NEW in v0.5.0)

- \`token_tachometer\` — Live token velocity gauge (IDLE→ACTIVE→HIGH_LOAD→REDLINE)
- \`agent_status\` — Traffic light view of all agents (🟢🟡🔴🔵)
- \`set_agent_status\` — Manually set your status (e.g., RED when blocked)
- \`set_lifecycle_phase\` — Track workflow phase (coding→testing→pr_open→ci_running→merged→deployed)
- \`lifecycle_report\` — Cost-per-phase breakdown (which phases consume the most compute?)
- \`sync_ratings\` — Check/trigger anonymous rating sync to platform

### Event Stream (optional)
Set \`INFERLANE_EVENTS_PORT=7070\` to enable SSE push:
- \`GET /events\` — All events (tachometer, status, budget, ratings)
- \`GET /api/tachometer\` — JSON snapshot
- \`GET /api/status\` — JSON snapshot

## Credibility System

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

## Local Cluster Integration (NEW in v0.4.0)

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
        text: `## Cost-Awareness + Credibility Guidelines (via InferLane v0.5.0)

You have access to InferLane cost intelligence and agent credibility tools. Use them to be a responsible, credible steward of the user's AI compute budget:

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
        text: `Please give me a quick daily AI cost report. Use the InferLane tools to:
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

Please use InferLane tools to:
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
// SCHEDULING TOOLS — Prompt scheduling, chains, and deferred execution
// ============================================================================

// Helper: make authenticated requests to the InferLane Scheduler API
async function schedulerRequest(path: string, options?: { method?: string; body?: any }): Promise<any> {
  const schedulerBase = (baseUrl || 'https://inferlane.dev').replace(/\/$/, '');
  const res = await fetch(`${schedulerBase}${path}`, {
    method: options?.method || 'GET',
    headers: {
      ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      'Content-Type': 'application/json',
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const errBody: any = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(errBody.error?.message || errBody.error || `Scheduler request failed: ${res.status}`);
  }

  return res.json();
}

// TOOL: schedule_prompt
server.tool(
  'schedule_prompt',
  `Schedule a prompt for execution on the InferLane platform. Supports immediate execution, time-based scheduling, recurring (cron) schedules, price-triggered execution (run when a model drops below a cost threshold), and optimal-window scheduling (platform picks the cheapest time). Requires INFERLANE_API_KEY.`,
  {
    prompt: z.string().describe('The prompt text to execute'),
    model: z.string().describe('Model to use (e.g., "claude-sonnet-4", "gpt-4o")'),
    schedule_type: z.enum(['IMMEDIATE', 'TIME_BASED', 'RECURRING', 'PRICE_TRIGGERED', 'OPTIMAL_WINDOW'])
      .describe('When/how to execute: IMMEDIATE (now), TIME_BASED (at scheduled_at), RECURRING (cron), PRICE_TRIGGERED (when model cost drops below threshold), OPTIMAL_WINDOW (platform picks cheapest time)'),
    scheduled_at: z.string().optional()
      .describe('ISO 8601 timestamp for TIME_BASED scheduling (e.g., "2026-03-20T14:00:00Z")'),
    cron_expression: z.string().optional()
      .describe('Cron expression for RECURRING scheduling (e.g., "0 9 * * 1-5" for weekdays at 9am)'),
    price_threshold: z.number().optional()
      .describe('Max cost per 1M tokens for PRICE_TRIGGERED scheduling (e.g., 0.50)'),
    max_tokens: z.number().default(1024)
      .describe('Maximum output tokens for the prompt execution'),
  },
  async (params) => {
    if (!apiKey) {
      return { content: [{ type: 'text' as const, text: 'Set INFERLANE_API_KEY to use scheduling features. Get a free key at https://inferlane.dev' }] };
    }
    try {
      const result = await schedulerRequest('/api/scheduler/prompts', {
        method: 'POST',
        body: {
          prompt: params.prompt,
          model: params.model,
          scheduleType: params.schedule_type,
          scheduledAt: params.scheduled_at,
          cronExpression: params.cron_expression,
          priceThreshold: params.price_threshold,
          maxTokens: params.max_tokens,
        },
      });

      const lines: string[] = ['# Prompt Scheduled', ''];
      lines.push(`**ID**: \`${result.id}\``);
      lines.push(`**Status**: ${result.status || 'QUEUED'}`);
      lines.push(`**Model**: ${result.model || params.model}`);
      lines.push(`**Schedule**: ${result.scheduleType || params.schedule_type}`);
      if (result.scheduledAt) lines.push(`**Scheduled at**: ${result.scheduledAt}`);
      if (result.cronExpression) lines.push(`**Cron**: \`${result.cronExpression}\``);
      if (result.priceThreshold) lines.push(`**Price threshold**: $${result.priceThreshold}/1M tokens`);
      if (result.estimatedCost) lines.push(`**Estimated cost**: $${Number(result.estimatedCost).toFixed(4)}`);

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err: any) {
      return { content: [{ type: 'text' as const, text: `Error scheduling prompt: ${err.message}` }] };
    }
  }
);

// TOOL: list_scheduled
server.tool(
  'list_scheduled',
  `List scheduled prompts on the InferLane platform. Filter by status and control how many results to return. Shows prompt ID, model, schedule type, status, and timing. Requires INFERLANE_API_KEY.`,
  {
    status: z.enum(['QUEUED', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED']).optional()
      .describe('Filter by prompt status'),
    limit: z.number().default(20)
      .describe('Maximum number of results to return'),
  },
  async (params) => {
    if (!apiKey) {
      return { content: [{ type: 'text' as const, text: 'Set INFERLANE_API_KEY to use scheduling features. Get a free key at https://inferlane.dev' }] };
    }
    try {
      const queryParts: string[] = [];
      if (params.status) queryParts.push(`status=${params.status}`);
      queryParts.push(`limit=${params.limit}`);
      const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

      const result = await schedulerRequest(`/api/scheduler/prompts${query}`);
      const prompts = Array.isArray(result) ? result : (result.prompts || result.data || []);

      if (prompts.length === 0) {
        return { content: [{ type: 'text' as const, text: `# Scheduled Prompts\n\nNo prompts found${params.status ? ` with status ${params.status}` : ''}.` }] };
      }

      const lines: string[] = [
        '# Scheduled Prompts',
        '',
        `Showing ${prompts.length} prompt(s)${params.status ? ` (status: ${params.status})` : ''}`,
        '',
        '| ID | Model | Schedule | Status | Created |',
        '|---|---|---|---|---|',
      ];

      for (const p of prompts) {
        const id = p.id ? `\`${String(p.id).slice(0, 8)}\`` : '—';
        const model = p.model || '—';
        const schedule = p.scheduleType || p.schedule_type || '—';
        const status = p.status || '—';
        const created = p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—';
        lines.push(`| ${id} | ${model} | ${schedule} | ${status} | ${created} |`);
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err: any) {
      return { content: [{ type: 'text' as const, text: `Error listing scheduled prompts: ${err.message}` }] };
    }
  }
);

// TOOL: cancel_scheduled
server.tool(
  'cancel_scheduled',
  `Cancel a scheduled prompt on the InferLane platform. The prompt must not already be running or completed. Requires INFERLANE_API_KEY.`,
  {
    prompt_id: z.string().describe('ID of the scheduled prompt to cancel'),
  },
  async (params) => {
    if (!apiKey) {
      return { content: [{ type: 'text' as const, text: 'Set INFERLANE_API_KEY to use scheduling features. Get a free key at https://inferlane.dev' }] };
    }
    try {
      await schedulerRequest(`/api/scheduler/prompts/${params.prompt_id}`, {
        method: 'DELETE',
      });

      return { content: [{ type: 'text' as const, text: `Scheduled prompt \`${params.prompt_id}\` has been cancelled.` }] };
    } catch (err: any) {
      return { content: [{ type: 'text' as const, text: `Error cancelling prompt: ${err.message}` }] };
    }
  }
);

// TOOL: create_chain
server.tool(
  'create_chain',
  `Create a multi-step prompt chain on the InferLane platform. Each step runs sequentially — the output of one step can feed into the next. Useful for complex workflows like: analyze → summarize → translate, or: generate code → review → fix. Returns a batch ID to track the chain's progress. Requires INFERLANE_API_KEY.`,
  {
    steps: z.array(z.object({
      prompt: z.string().describe('The prompt text for this step'),
      model: z.string().describe('Model to use for this step'),
      max_tokens: z.number().optional().describe('Max output tokens for this step'),
    })).min(2).describe('Array of chain steps (minimum 2). Steps execute sequentially.'),
  },
  async (params) => {
    if (!apiKey) {
      return { content: [{ type: 'text' as const, text: 'Set INFERLANE_API_KEY to use scheduling features. Get a free key at https://inferlane.dev' }] };
    }
    try {
      const result = await schedulerRequest('/api/scheduler/chains', {
        method: 'POST',
        body: {
          steps: params.steps.map(s => ({
            prompt: s.prompt,
            model: s.model,
            maxTokens: s.max_tokens || 1024,
          })),
        },
      });

      const lines: string[] = ['# Prompt Chain Created', ''];
      lines.push(`**Batch ID**: \`${result.batchId || result.id}\``);
      lines.push(`**Steps**: ${result.stepCount || result.steps?.length || params.steps.length}`);
      lines.push(`**Status**: ${result.status || 'QUEUED'}`);
      if (result.estimatedCost) lines.push(`**Estimated total cost**: $${Number(result.estimatedCost).toFixed(4)}`);
      lines.push('');
      lines.push('### Steps');
      for (let i = 0; i < params.steps.length; i++) {
        const step = params.steps[i];
        lines.push(`${i + 1}. **${step.model}** — ${step.prompt.slice(0, 80)}${step.prompt.length > 80 ? '...' : ''}`);
      }
      lines.push('');
      lines.push('Use `chain_status` with the batch ID to track progress.');

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err: any) {
      return { content: [{ type: 'text' as const, text: `Error creating chain: ${err.message}` }] };
    }
  }
);

// TOOL: chain_status
server.tool(
  'chain_status',
  `Get the progress of a prompt chain on the InferLane platform. Shows overall status, completed/total steps, per-step results, and cost breakdown. Requires INFERLANE_API_KEY.`,
  {
    batch_id: z.string().describe('Batch ID of the chain (returned by create_chain)'),
  },
  async (params) => {
    if (!apiKey) {
      return { content: [{ type: 'text' as const, text: 'Set INFERLANE_API_KEY to use scheduling features. Get a free key at https://inferlane.dev' }] };
    }
    try {
      const result = await schedulerRequest(`/api/scheduler/chains/${params.batch_id}`);

      const steps = result.steps || result.prompts || [];
      const completedSteps = steps.filter((s: any) => s.status === 'COMPLETED').length;
      const failedSteps = steps.filter((s: any) => s.status === 'FAILED').length;
      const totalSteps = steps.length;

      const lines: string[] = ['# Chain Progress', ''];
      lines.push(`**Batch ID**: \`${params.batch_id}\``);
      lines.push(`**Status**: ${result.status || (completedSteps === totalSteps ? 'COMPLETED' : 'IN_PROGRESS')}`);
      lines.push(`**Progress**: ${completedSteps}/${totalSteps} steps completed${failedSteps > 0 ? ` (${failedSteps} failed)` : ''}`);
      if (result.totalCost) lines.push(`**Total cost**: $${Number(result.totalCost).toFixed(4)}`);
      lines.push('');

      if (steps.length > 0) {
        lines.push('| Step | Model | Status | Cost |');
        lines.push('|------|-------|--------|------|');
        for (let i = 0; i < steps.length; i++) {
          const s = steps[i];
          const statusEmoji = s.status === 'COMPLETED' ? '✅' : s.status === 'RUNNING' ? '⏳' : s.status === 'FAILED' ? '❌' : '⏸️';
          const cost = s.cost ? `$${Number(s.cost).toFixed(4)}` : '—';
          lines.push(`| ${i + 1} | ${s.model || '—'} | ${statusEmoji} ${s.status || 'QUEUED'} | ${cost} |`);
        }
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err: any) {
      return { content: [{ type: 'text' as const, text: `Error fetching chain status: ${err.message}` }] };
    }
  }
);

// TOOL: cost_savings
server.tool(
  'cost_savings',
  `View your InferLane cost savings summary. Shows total money saved through smart routing, cross-platform arbitrage, promotions, off-peak scheduling, and decentralized node usage. Requires INFERLANE_API_KEY.`,
  {
    period: z.enum(['today', '7d', '30d', 'all']).default('30d').describe('Time period for savings summary'),
    include_leaderboard: z.boolean().default(false).describe('Include breakdown by savings reason'),
  },
  async (params) => {
    if (!apiKey) {
      return { content: [{ type: 'text' as const, text: 'Set INFERLANE_API_KEY to use savings tracking. Get a free key at https://inferlane.dev' }] };
    }
    try {
      const queryParams = new URLSearchParams({
        period: params.period,
        ...(params.include_leaderboard ? { leaderboard: 'true' } : {}),
      });
      const result = await schedulerRequest(`/api/savings?${queryParams.toString()}`);
      const s = result.summary;

      const lines: string[] = ['# Cost Savings Summary', ''];
      lines.push(`**Period**: ${s.periodLabel || params.period}`);
      lines.push(`**Total saved**: $${Number(s.totalSaved).toFixed(4)}`);
      lines.push(`**Total spent**: $${Number(s.totalSpent).toFixed(4)}`);
      lines.push(`**Savings rate**: ${s.savingsPercent}%`);
      lines.push(`**Requests with savings**: ${s.recordCount}`);
      if (s.bestSingleSaving > 0) {
        lines.push(`**Best single saving**: $${Number(s.bestSingleSaving).toFixed(4)}`);
      }
      if (s.avgSavingPerRequest > 0) {
        lines.push(`**Avg saving per request**: $${Number(s.avgSavingPerRequest).toFixed(6)}`);
      }
      if (s.topSavingsReason) {
        const reasonLabels: Record<string, string> = {
          promotion: 'Promotions',
          cross_platform: 'Cross-platform arbitrage',
          off_peak: 'Off-peak scheduling',
          decentralized: 'Decentralized nodes',
          budget_routing: 'Budget routing',
          cheapest_equivalent: 'Cheapest equivalent model',
        };
        lines.push(`**Top savings driver**: ${reasonLabels[s.topSavingsReason] || s.topSavingsReason}`);
      }

      if (result.leaderboard && result.leaderboard.length > 0) {
        lines.push('');
        lines.push('## Savings by Category');
        lines.push('');
        lines.push('| Category | Saved | Requests | Avg % |');
        lines.push('|----------|-------|----------|-------|');
        for (const entry of result.leaderboard) {
          lines.push(`| ${entry.label} | $${Number(entry.totalSaved).toFixed(4)} | ${entry.requestCount} | ${entry.avgSavingPercent}% |`);
        }
      }

      if (s.totalSaved === 0) {
        lines.push('');
        lines.push('> No savings recorded yet. Use smart routing (`cheapest`, `budget`, or `auto` strategies) to start saving.');
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err: any) {
      return { content: [{ type: 'text' as const, text: `Error fetching savings: ${err.message}` }] };
    }
  }
);

// ============================================================================
// DISPATCH & SESSION TOOLS — Multi-provider routing and conversation tracking
// ============================================================================

// TOOL: dispatch
server.tool(
  'dispatch',
  `Send a prompt to be executed on the best available provider. Supports routing strategies (auto, cheapest, fastest, quality, decentralized_only) and priority levels. Returns the result inline if completed immediately, or a taskId for async polling. Requires INFERLANE_API_KEY.`,
  {
    prompt: z.string().describe('The prompt text to execute'),
    model: z.string().optional().describe('Specific model to use (e.g., "claude-sonnet-4", "deepseek-r1"). If omitted, routing strategy picks the best.'),
    routing: z.enum(['auto', 'cheapest', 'fastest', 'quality', 'decentralized_only']).default('auto')
      .describe('Routing strategy: auto (balanced), cheapest (minimize cost), fastest (minimize latency), quality (best model), decentralized_only (local/p2p only)'),
    priority: z.enum(['realtime', 'standard', 'batch']).default('realtime')
      .describe('Execution priority: realtime (immediate), standard (queued), batch (lowest priority, cheapest)'),
    sessionId: z.string().optional()
      .describe('Session ID to attach this prompt to for cross-provider conversation continuity'),
  },
  async (params) => {
    if (!apiKey) {
      return { content: [{ type: 'text' as const, text: 'Set INFERLANE_API_KEY to use dispatch features. Get a free key at https://inferlane.dev' }] };
    }
    try {
      const result = await schedulerRequest('/api/dispatch', {
        method: 'POST',
        body: {
          prompt: params.prompt,
          model: params.model,
          routing: params.routing,
          priority: params.priority,
          sessionId: params.sessionId,
        },
      });

      const lines: string[] = ['# Dispatch Result', ''];
      lines.push(`**Task ID**: \`${result.taskId}\``);
      lines.push(`**Status**: ${result.status}`);

      if (result.provider) lines.push(`**Provider**: ${result.provider}`);
      if (result.model) lines.push(`**Model**: ${result.model}`);

      if (result.status === 'completed' && result.response) {
        lines.push('');
        lines.push('## Response');
        lines.push(typeof result.response === 'string' ? result.response : result.response.content || JSON.stringify(result.response));
      }

      if (result.cost !== undefined) lines.push(`**Cost**: $${Number(result.cost).toFixed(6)}`);
      if (result.latencyMs !== undefined) lines.push(`**Latency**: ${result.latencyMs}ms`);

      if (result.status === 'queued' || result.status === 'pending') {
        lines.push('');
        lines.push(`> Task is queued. Use \`dispatch_status\` with taskId \`${result.taskId}\` to check progress.`);
        if (result.estimatedCompletionMs) {
          lines.push(`> Estimated completion in ~${Math.round(result.estimatedCompletionMs / 1000)}s`);
        }
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err: any) {
      return { content: [{ type: 'text' as const, text: `Dispatch error: ${err.message}` }] };
    }
  }
);

// TOOL: dispatch_status
server.tool(
  'dispatch_status',
  `Check the status of a previously dispatched task. Returns the current status and result if the task has completed. Requires INFERLANE_API_KEY.`,
  {
    taskId: z.string().describe('The task ID returned by the dispatch tool'),
  },
  async (params) => {
    if (!apiKey) {
      return { content: [{ type: 'text' as const, text: 'Set INFERLANE_API_KEY to use dispatch features. Get a free key at https://inferlane.dev' }] };
    }
    try {
      const result = await schedulerRequest(`/api/dispatch?taskId=${encodeURIComponent(params.taskId)}`);

      const lines: string[] = ['# Dispatch Status', ''];
      lines.push(`**Task ID**: \`${result.taskId}\``);
      lines.push(`**Status**: ${result.status}`);

      if (result.provider) lines.push(`**Provider**: ${result.provider}`);
      if (result.model) lines.push(`**Model**: ${result.model}`);

      if (result.status === 'completed' && result.response) {
        lines.push('');
        lines.push('## Response');
        lines.push(typeof result.response === 'string' ? result.response : result.response.content || JSON.stringify(result.response));
      }

      if (result.cost !== undefined) lines.push(`**Cost**: $${Number(result.cost).toFixed(6)}`);
      if (result.latencyMs !== undefined) lines.push(`**Latency**: ${result.latencyMs}ms`);

      if (result.error) {
        lines.push('');
        lines.push(`**Error**: ${result.error}`);
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err: any) {
      return { content: [{ type: 'text' as const, text: `Status check error: ${err.message}` }] };
    }
  }
);

// TOOL: dispatch_chain
server.tool(
  'dispatch_chain',
  `Execute a multi-provider chain where each step can target a different model or routing strategy. For example: step 1 on Claude for reasoning, step 2 on DeepSeek for code generation. Each step can optionally transform its output before passing to the next step. Requires INFERLANE_API_KEY.`,
  {
    steps: z.array(z.object({
      prompt: z.string().describe('The prompt text for this step'),
      model: z.string().optional().describe('Specific model for this step (e.g., "claude-sonnet-4", "deepseek-r1")'),
      routing: z.enum(['auto', 'cheapest', 'fastest', 'quality', 'decentralized_only']).optional()
        .describe('Routing strategy for this step'),
      transformOutput: z.string().optional()
        .describe('Optional instruction for transforming this step\'s output before passing to the next step'),
    })).min(1).describe('Ordered list of chain steps to execute sequentially'),
  },
  async (params) => {
    if (!apiKey) {
      return { content: [{ type: 'text' as const, text: 'Set INFERLANE_API_KEY to use dispatch chain features. Get a free key at https://inferlane.dev' }] };
    }
    try {
      const result = await schedulerRequest('/api/dispatch/chain', {
        method: 'POST',
        body: { steps: params.steps },
      });

      const lines: string[] = ['# Dispatch Chain', ''];
      lines.push(`**Chain ID**: \`${result.chainId || result.batchId || 'N/A'}\``);
      lines.push(`**Status**: ${result.status}`);
      lines.push(`**Steps**: ${params.steps.length}`);

      if (result.steps && Array.isArray(result.steps)) {
        lines.push('');
        lines.push('## Step Results');
        for (let i = 0; i < result.steps.length; i++) {
          const step = result.steps[i];
          lines.push('');
          lines.push(`### Step ${i + 1}`);
          lines.push(`**Status**: ${step.status}`);
          if (step.provider) lines.push(`**Provider**: ${step.provider}`);
          if (step.model) lines.push(`**Model**: ${step.model}`);
          if (step.cost !== undefined) lines.push(`**Cost**: $${Number(step.cost).toFixed(6)}`);
          if (step.latencyMs !== undefined) lines.push(`**Latency**: ${step.latencyMs}ms`);
          if (step.status === 'completed' && step.response) {
            const content = typeof step.response === 'string' ? step.response : step.response.content || JSON.stringify(step.response);
            lines.push(`**Output**: ${content.length > 200 ? content.substring(0, 200) + '...' : content}`);
          }
          if (step.error) lines.push(`**Error**: ${step.error}`);
        }
      }

      if (result.totalCost !== undefined) {
        lines.push('');
        lines.push(`**Total Cost**: $${Number(result.totalCost).toFixed(6)}`);
      }
      if (result.totalLatencyMs !== undefined) {
        lines.push(`**Total Latency**: ${result.totalLatencyMs}ms`);
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err: any) {
      return { content: [{ type: 'text' as const, text: `Chain dispatch error: ${err.message}` }] };
    }
  }
);

// TOOL: triage
server.tool(
  'triage',
  `Triage a prompt to see how it would be routed before executing. Analyzes the prompt for complexity, importance, and urgency, then recommends the best platform, provider, model, and execution mode. Optionally auto-executes if autoExecute=true. Requires INFERLANE_API_KEY.`,
  {
    prompt: z.string().describe('The prompt text to triage'),
    autoExecute: z.boolean().default(false)
      .describe('If true, triage AND dispatch in one call. If false (default), just return the triage analysis.'),
    costSensitivity: z.enum(['minimum', 'balanced', 'quality_first']).optional()
      .describe('How much to weight cost vs quality: minimum (cheapest), balanced (default), quality_first (best model)'),
    preferDecentralized: z.boolean().optional()
      .describe('Prefer OpenClaw decentralized nodes when possible'),
  },
  async (params) => {
    if (!apiKey) {
      return { content: [{ type: 'text' as const, text: 'Set INFERLANE_API_KEY to use triage features. Get a free key at https://inferlane.dev' }] };
    }
    try {
      const body: Record<string, unknown> = {
        prompt: params.prompt,
        autoExecute: params.autoExecute,
      };

      const preferences: Record<string, unknown> = {};
      if (params.costSensitivity) preferences.costSensitivity = params.costSensitivity;
      if (params.preferDecentralized !== undefined) preferences.preferDecentralized = params.preferDecentralized;
      if (Object.keys(preferences).length > 0) body.preferences = preferences;

      const result = await schedulerRequest('/api/dispatch/triage', {
        method: 'POST',
        body,
      });

      const lines: string[] = ['## Triage Result', ''];

      // If result has a nested triage object (from triageAndDispatch)
      const triage = result.triage || result;

      lines.push(`**Importance:** ${triage.importance} | **Urgency:** ${triage.urgency} | **Complexity:** ${(triage.complexity || triage.recommendedTier || '').toUpperCase()}`);
      lines.push(`**Platform:** ${triage.recommendedPlatform}${triage.recommendedProvider ? ` (${triage.recommendedProvider})` : ''} | **Model:** ${triage.recommendedModel || '—'}`);
      lines.push(`**Execution:** ${triage.executionMode}`);

      const estCost = Number(triage.estimatedCostUsd || 0).toFixed(4);
      const cheapCost = Number(triage.cheapestOptionCostUsd || 0).toFixed(4);
      const savings = triage.potentialSavingsPercent || 0;
      lines.push(`**Estimated cost:** $${estCost} | **Cheapest option:** $${cheapCost}${savings > 0 ? ` (${savings}% savings available)` : ''}`);

      lines.push(`**Confidence:** ${Number(triage.confidence || 0).toFixed(2)}`);
      lines.push('');
      lines.push(`**Reason:** ${triage.reason || '—'}`);

      // If auto-executed, show dispatch result too
      if (result.dispatch) {
        lines.push('');
        lines.push('## Dispatch Result');
        lines.push(`**Task ID:** \`${result.dispatch.taskId}\``);
        lines.push(`**Status:** ${result.dispatch.status}`);
        if (result.dispatch.provider) lines.push(`**Provider:** ${result.dispatch.provider}`);
        if (result.dispatch.model) lines.push(`**Model:** ${result.dispatch.model}`);
        if (result.dispatch.result?.costUsd !== undefined) {
          lines.push(`**Actual cost:** $${Number(result.dispatch.result.costUsd).toFixed(6)}`);
        }
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err: any) {
      return { content: [{ type: 'text' as const, text: `Triage error: ${err.message}` }] };
    }
  }
);

// TOOL: triage_settings
server.tool(
  'triage_settings',
  `View or preview triage preference settings. With no parameters, shows default triage preferences. With parameters, shows what the updated preferences would look like (per-request, not persisted). Requires INFERLANE_API_KEY.`,
  {
    costSensitivity: z.enum(['minimum', 'balanced', 'quality_first']).optional()
      .describe('Cost vs quality tradeoff: minimum, balanced, or quality_first'),
    preferDecentralized: z.boolean().optional()
      .describe('Prefer OpenClaw decentralized nodes when possible'),
    allowBatchDefer: z.boolean().optional()
      .describe('Allow deferring non-urgent work to off-peak windows'),
    mode: z.enum(['manual', 'auto_triage', 'auto_full']).optional()
      .describe('Triage mode: manual (user decides), auto_triage (AI suggests), auto_full (AI decides and executes)'),
  },
  async (params) => {
    if (!apiKey) {
      return { content: [{ type: 'text' as const, text: 'Set INFERLANE_API_KEY to use triage settings. Get a free key at https://inferlane.dev' }] };
    }
    try {
      // Get defaults from the API
      const defaults = await schedulerRequest('/api/dispatch/triage');

      // Merge any overrides
      const merged = { ...defaults };
      if (params.costSensitivity) merged.costSensitivity = params.costSensitivity;
      if (params.preferDecentralized !== undefined) merged.preferDecentralized = params.preferDecentralized;
      if (params.allowBatchDefer !== undefined) merged.allowBatchDefer = params.allowBatchDefer;
      if (params.mode) merged.mode = params.mode;

      const hasOverrides = params.costSensitivity || params.preferDecentralized !== undefined
        || params.allowBatchDefer !== undefined || params.mode;

      const lines: string[] = [
        hasOverrides ? '## Triage Settings (Preview)' : '## Triage Settings (Defaults)',
        '',
        `| Setting | Value |`,
        `|---------|-------|`,
        `| Mode | ${merged.mode} |`,
        `| Cost Sensitivity | ${merged.costSensitivity} |`,
        `| Prefer Decentralized | ${merged.preferDecentralized} |`,
        `| Allow Batch Defer | ${merged.allowBatchDefer} |`,
      ];

      if (merged.maxCostPerPrompt !== undefined) {
        lines.push(`| Max Cost/Prompt | $${merged.maxCostPerPrompt} |`);
      }
      if (merged.quietHoursStart !== undefined && merged.quietHoursEnd !== undefined) {
        lines.push(`| Quiet Hours | ${merged.quietHoursStart}:00 — ${merged.quietHoursEnd}:00 |`);
      }

      if (merged.priorityKeywords && Array.isArray(merged.priorityKeywords)) {
        lines.push('');
        lines.push(`**Priority keywords:** ${merged.priorityKeywords.join(', ')}`);
      }
      if (merged.batchKeywords && Array.isArray(merged.batchKeywords)) {
        lines.push(`**Batch keywords:** ${merged.batchKeywords.join(', ')}`);
      }

      if (hasOverrides) {
        lines.push('');
        lines.push('> These settings are per-request previews. Pass them as `preferences` in your triage call to apply them.');
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (err: any) {
      return { content: [{ type: 'text' as const, text: `Triage settings error: ${err.message}` }] };
    }
  }
);

// TOOL: session_history
server.tool(
  'session_history',
  `View cross-provider conversation sessions. If a sessionId is provided, shows the full message history for that session with provider and model tags. If no sessionId is provided, lists recent sessions with message counts, providers used, and total cost. Requires INFERLANE_API_KEY.`,
  {
    sessionId: z.string().optional()
      .describe('Session ID to view. If omitted, lists recent sessions.'),
    limit: z.number().default(10)
      .describe('Number of recent sessions to list (only used when sessionId is omitted)'),
  },
  async (params) => {
    if (!apiKey) {
      return { content: [{ type: 'text' as const, text: 'Set INFERLANE_API_KEY to use session history features. Get a free key at https://inferlane.dev' }] };
    }
    try {
      if (params.sessionId) {
        // Fetch specific session
        const result = await schedulerRequest(`/api/sessions/${encodeURIComponent(params.sessionId)}`);

        const lines: string[] = ['# Session History', ''];
        lines.push(`**Session ID**: \`${result.sessionId || params.sessionId}\``);
        if (result.createdAt) lines.push(`**Created**: ${result.createdAt}`);
        if (result.totalCost !== undefined) lines.push(`**Total Cost**: $${Number(result.totalCost).toFixed(6)}`);

        if (result.messages && Array.isArray(result.messages)) {
          lines.push(`**Messages**: ${result.messages.length}`);
          lines.push('');
          lines.push('## Messages');
          for (const msg of result.messages) {
            const role = msg.role || 'unknown';
            const provider = msg.provider ? `[${msg.provider}` + (msg.model ? `/${msg.model}` : '') + ']' : '';
            const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            const preview = content.length > 150 ? content.substring(0, 150) + '...' : content;
            lines.push(`- **${role}** ${provider}: ${preview}`);
          }
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } else {
        // List recent sessions
        const result = await schedulerRequest(`/api/sessions?limit=${params.limit}`);

        const sessions = result.sessions || result;
        const lines: string[] = ['# Recent Sessions', ''];

        if (Array.isArray(sessions) && sessions.length > 0) {
          lines.push('| Session ID | Messages | Providers | Total Cost |');
          lines.push('|------------|----------|-----------|------------|');
          for (const session of sessions) {
            const id = session.sessionId || session.id || 'N/A';
            const msgCount = session.messageCount ?? session.messages?.length ?? '—';
            const providers = session.providers ? (Array.isArray(session.providers) ? session.providers.join(', ') : session.providers) : '—';
            const cost = session.totalCost !== undefined ? `$${Number(session.totalCost).toFixed(4)}` : '—';
            lines.push(`| \`${id}\` | ${msgCount} | ${providers} | ${cost} |`);
          }
        } else {
          lines.push('No sessions found.');
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      }
    } catch (err: any) {
      return { content: [{ type: 'text' as const, text: `Session history error: ${err.message}` }] };
    }
  }
);

// ============================================================================
// Start server
// ============================================================================
async function main() {
  if (platformClient) {
    console.error('[InferLane MCP] Platform connected. All 30 tools available.');
  } else {
    console.error('[InferLane MCP] Running offline. 25 tools available. Set INFERLANE_API_KEY for platform features.');
  }
  console.error(`[InferLane MCP] Persistence: ${persistence.available ? 'SQLite active' : 'in-memory only (SQLite unavailable)'}`);

  // Start SSE event stream if port configured
  const eventsStarted = eventStream.start();
  if (!eventsStarted) {
    console.error('[InferLane MCP] Event stream: disabled (set INFERLANE_EVENTS_PORT to enable)');
  }

  // Rating sync status
  if (ratingSync.enabled) {
    console.error('[InferLane MCP] Rating sync: enabled (anonymous ratings will sync to platform)');
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[InferLane MCP] Server v0.5.0 started — cost intelligence + real-time monitoring');
}

main().catch((error) => {
  console.error('[InferLane MCP] Fatal error:', error);
  process.exit(1);
});
