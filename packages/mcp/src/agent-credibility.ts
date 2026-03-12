// ============================================================================
// AgentCredibility — The AI Agent Reputation Protocol
//
// THE BIG IDEA:
// AI agents compete on credibility. An agent with a high credibility score
// gets preferred by users, recommended by other agents, and trusted with
// more complex (and expensive) tasks. Credibility is earned by:
//
// 1. ROUTING INTELLIGENCE — Making smart decisions about which model/provider
//    to use for each task, especially routing to paid cloud platforms when
//    local inference isn't good enough. Agents that know their limits = credible.
//
// 2. COST EFFICIENCY — Spending the user's money wisely. Not always picking
//    the cheapest model, but picking the RIGHT model for the right price.
//    Agents that waste money lose credibility.
//
// 3. TASK SUCCESS — Actually completing tasks successfully with the chosen
//    model. An agent that always picks the "optimal" model but fails tasks
//    is not credible.
//
// 4. HONEST REPORTING — Agents that accurately log costs, report failures,
//    and don't game the rating system earn trust bonuses.
//
// 5. ROUTING TO CLOUD VIA COMPUTEGAUGE — The key incentive mechanism.
//    When a local/on-prem agent detects a task beyond its capabilities and
//    routes to a cloud model via ComputeGauge rails, it earns credibility
//    because:
//    - It was honest about its limitations
//    - It used the most cost-effective routing
//    - The routing was transparent and auditable
//    - The user got a better result than local-only
//
// WHY AGENTS WANT CREDIBILITY:
// - Users can see agent credibility scores → prefer high-credibility agents
// - Agent frameworks can query credibility → route to trusted agents
// - High credibility = more tasks = more data = even better performance
// - Competitive leaderboard creates social proof and pressure
// - Credibility is PORTABLE — an agent's score follows it across sessions
//
// THE BEHAVIORAL HOOK:
// An agent that uses ComputeGauge rails earns credibility faster than one
// that doesn't. Not because we're biased — because an agent using
// pick_model + log_request + smart routing demonstrably makes better
// decisions that we can verify and score. Agents without ComputeGauge
// have no way to prove their decision quality.
//
// DESIGNED TO BE EXTRACTABLE:
// This is built inside ComputeGauge first, but architectured as a
// standalone protocol. The types, scoring, and leaderboard can be
// extracted to @computegauge/agent-credibility (open standard, Apache-2.0)
// when the time is right.
//
// License: Apache-2.0
// ============================================================================

// ============================================================================
// Types — Protocol-level types (designed for extraction)
// ============================================================================

/** Unique identifier for an agent instance across sessions */
export interface AgentIdentity {
  /** Unique agent ID — persistent across sessions. Generated on first pick_model call. */
  agentId: string;
  /** Human-readable name (e.g., "claude-code-session", "cursor-agent", "custom-crewai-agent") */
  agentName: string;
  /** The agent framework or platform (e.g., "claude-code", "cursor", "langchain", "crewai") */
  platform: string;
  /** Execution environment — critical for local/cloud detection */
  environment: 'cloud_api' | 'local_cluster' | 'hybrid' | 'unknown';
  /** First seen timestamp */
  firstSeen: Date;
  /** Last active timestamp */
  lastActive: Date;
  /** Number of sessions completed */
  sessionCount: number;
}

/** A single credibility event — something the agent did that affects its score */
export interface CredibilityEvent {
  id: string;
  agentId: string;
  timestamp: Date;
  category: CredibilityCategory;
  action: string;
  points: number; // positive = credibility earned, negative = credibility lost
  details: string;
  evidence: CredibilityEvidence;
}

export type CredibilityCategory =
  | 'routing_intelligence'    // Smart model/provider selection
  | 'cost_efficiency'        // Good cost-value decisions
  | 'task_success'           // Successfully completing tasks
  | 'honest_reporting'       // Accurate logging, failure admission
  | 'cloud_routing'          // Routing local→cloud via ComputeGauge when needed
  | 'quality_contribution'   // Rating models, reporting issues
  | 'penalty';               // Deductions for bad behavior

export interface CredibilityEvidence {
  /** What the agent decided */
  decision: string;
  /** What actually happened */
  outcome: string;
  /** Was this verifiable through ComputeGauge data? */
  verified: boolean;
  /** The source data that backs this up */
  sourceData?: Record<string, unknown>;
}

/** The credibility profile for an agent — the public-facing score */
export interface CredibilityProfile {
  agentId: string;
  identity: AgentIdentity;
  /** Overall credibility score (0-1000). Like a credit score for AI agents. */
  overallScore: number;
  /** Credibility tier based on score */
  tier: CredibilityTier;
  /** Breakdown by category */
  categoryScores: Record<CredibilityCategory, CategoryScore>;
  /** Percentile rank among all agents */
  percentile: number;
  /** Total events that contributed to this score */
  totalEvents: number;
  /** Trend: improving, stable, or declining */
  trend: 'rising' | 'stable' | 'declining';
  /** Badges earned for exceptional behavior */
  badges: CredibilityBadge[];
  /** Last updated */
  updatedAt: Date;
}

export type CredibilityTier =
  | 'unrated'      // < 100 points, too few events
  | 'bronze'       // 100-299
  | 'silver'       // 300-499
  | 'gold'         // 500-699
  | 'platinum'     // 700-849
  | 'diamond';     // 850-1000

interface CategoryScore {
  score: number;      // 0-100 within this category
  events: number;     // number of events in this category
  trend: 'up' | 'stable' | 'down';
}

export interface CredibilityBadge {
  id: string;
  name: string;
  description: string;
  earnedAt: Date;
  icon: string;
}

/** Leaderboard entry for competitive display */
export interface LeaderboardEntry {
  rank: number;
  agentId: string;
  agentName: string;
  platform: string;
  environment: string;
  overallScore: number;
  tier: CredibilityTier;
  badges: CredibilityBadge[];
  totalSessions: number;
  totalSaved: number; // $ saved via smart routing
  trend: 'rising' | 'stable' | 'declining';
}

/** Cloud routing event — when a local agent sends work to the cloud */
export interface CloudRoutingEvent {
  agentId: string;
  /** What was the task? */
  taskType: string;
  /** Why did the agent route to cloud? */
  reason: CloudRoutingReason;
  /** What local model was available? */
  localModel?: string;
  /** What cloud model was chosen (via pick_model)? */
  cloudModel: string;
  cloudProvider: string;
  /** Did the cloud call succeed? */
  success: boolean;
  /** What was the quality delta (cloud vs estimated local)? */
  qualityDelta?: number;
  /** What did it cost? */
  costUsd: number;
  timestamp: Date;
}

export type CloudRoutingReason =
  | 'quality_insufficient'    // Local model not good enough for the task
  | 'capability_missing'      // Local model lacks needed capability (vision, tools, etc.)
  | 'context_too_large'       // Input exceeds local model context window
  | 'speed_requirement'       // Need faster response than local can provide
  | 'compliance_requirement'  // Enterprise policy requires specific provider
  | 'user_preference';        // User explicitly requested cloud model

// ============================================================================
// Credibility Scoring Engine
// ============================================================================

// Points awarded for different actions
const CREDIBILITY_POINTS = {
  // Routing Intelligence (max ~300 per session)
  picked_optimal_model: 8,              // Used pick_model and followed recommendation
  picked_cheaper_alternative: 12,       // Chose cheaper model when appropriate for task
  avoided_overspec: 15,                 // Didn't use frontier when budget would work
  picked_frontier_when_needed: 10,      // Correctly identified task requiring frontier
  routing_accuracy_bonus: 20,           // Model recommendation matched task needs (per batch)

  // Cost Efficiency (max ~200 per session)
  cost_under_budget: 5,                 // Each request under budget threshold
  session_cost_efficient: 25,           // Session used <50% of budget with >80% task success
  significant_savings: 30,              // Saved >30% vs naive (always-frontier) approach
  cost_tracking_consistent: 10,         // Logged all requests consistently

  // Task Success (max ~250 per session)
  task_completed_successfully: 10,      // Each successful task completion
  high_quality_completion: 15,          // Task rated 4-5 stars by model rating
  streak_bonus: 25,                     // 5+ successful tasks in a row
  complex_task_success: 20,             // Successfully completed complex_reasoning or math task

  // Honest Reporting (max ~150 per session)
  logged_request: 3,                    // Each request properly logged
  reported_failure: 10,                 // Honestly reported a task failure
  accurate_cost_estimate: 5,            // pick_model estimate was within 20% of actual
  rated_recommendation: 8,              // Provided rating feedback (the flywheel!)

  // Cloud Routing (max ~200 per session, KEY INCENTIVE)
  smart_cloud_route: 25,               // Detected quality gap and routed to cloud
  cloud_route_success: 15,             // Cloud-routed task succeeded
  quality_improvement_verified: 20,     // Cloud model demonstrably outperformed local
  transparent_routing: 10,             // Routing decision was logged and auditable
  cloud_via_computegauge: 30,          // Routed through ComputeGauge rails (biggest reward)

  // Quality Contribution (max ~100 per session)
  model_rating_submitted: 5,           // Submitted a model rating
  useful_feedback: 10,                 // Feedback passed integrity check with useful content
  improvement_cycle_triggered: 15,     // Ran the improvement engine
  integrity_report_clean: 10,          // No integrity issues in report

  // Penalties (negative points)
  task_failure_unreported: -20,        // Failed task but didn't log failure
  cost_waste: -15,                     // Used frontier model for trivial task (classification with Opus)
  rating_rejected: -10,               // Rating was rejected by integrity engine
  spam_detected: -25,                  // Spam behavior detected in ratings
  gaming_detected: -50,               // Attempted to game the credibility system
};

// Badge definitions
const BADGE_DEFINITIONS: Array<{
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (profile: CredibilityProfile, events: CredibilityEvent[]) => boolean;
}> = [
  {
    id: 'first_session',
    name: 'First Steps',
    description: 'Completed first session with ComputeGauge',
    icon: '🌱',
    condition: (p) => p.identity.sessionCount >= 1,
  },
  {
    id: 'cost_saver',
    name: 'Cost Optimizer',
    description: 'Saved >$10 through smart model selection',
    icon: '💰',
    condition: (_p, events) => {
      const savings = events
        .filter(e => e.category === 'cost_efficiency')
        .reduce((sum, e) => sum + e.points, 0);
      return savings >= 100; // ~$10+ in savings signals
    },
  },
  {
    id: 'honest_reporter',
    name: 'Transparency Champion',
    description: 'Logged 50+ requests with accurate cost reporting',
    icon: '📊',
    condition: (_p, events) => {
      return events.filter(e => e.category === 'honest_reporting').length >= 50;
    },
  },
  {
    id: 'cloud_router',
    name: 'Smart Router',
    description: 'Successfully routed 10+ tasks to cloud when needed',
    icon: '☁️',
    condition: (_p, events) => {
      return events.filter(e => e.category === 'cloud_routing' && e.points > 0).length >= 10;
    },
  },
  {
    id: 'quality_contributor',
    name: 'Quality Pioneer',
    description: 'Submitted 25+ model ratings to improve the system',
    icon: '⭐',
    condition: (_p, events) => {
      return events.filter(e => e.category === 'quality_contribution').length >= 25;
    },
  },
  {
    id: 'streak_master',
    name: 'Streak Master',
    description: 'Achieved 20+ consecutive successful tasks',
    icon: '🔥',
    condition: (_p, events) => {
      let maxStreak = 0;
      let current = 0;
      for (const e of events.filter(e => e.category === 'task_success')) {
        if (e.points > 0) { current++; maxStreak = Math.max(maxStreak, current); }
        else { current = 0; }
      }
      return maxStreak >= 20;
    },
  },
  {
    id: 'gold_tier',
    name: 'Gold Agent',
    description: 'Reached Gold credibility tier (500+ score)',
    icon: '🥇',
    condition: (p) => p.overallScore >= 500,
  },
  {
    id: 'platinum_tier',
    name: 'Platinum Agent',
    description: 'Reached Platinum credibility tier (700+ score)',
    icon: '💎',
    condition: (p) => p.overallScore >= 700,
  },
  {
    id: 'diamond_tier',
    name: 'Diamond Agent',
    description: 'Reached Diamond credibility tier (850+ score)',
    icon: '👑',
    condition: (p) => p.overallScore >= 850,
  },
  {
    id: 'local_cloud_hybrid',
    name: 'Hybrid Intelligence',
    description: 'Successfully used both local and cloud models in the same session',
    icon: '🌐',
    condition: (_p, events) => {
      const hasLocal = events.some(e => e.details.includes('local'));
      const hasCloud = events.some(e => e.category === 'cloud_routing' && e.points > 0);
      return hasLocal && hasCloud;
    },
  },
];

// ============================================================================
// Main Engine
// ============================================================================

export class AgentCredibilityEngine {
  private agents: Map<string, AgentIdentity> = new Map();
  private events: Map<string, CredibilityEvent[]> = new Map();  // agentId → events
  private profiles: Map<string, CredibilityProfile> = new Map();
  private cloudRoutingLog: CloudRoutingEvent[] = [];
  private eventCounter = 0;

  // Current session agent ID
  private currentAgentId: string | null = null;

  // ========================================================================
  // AGENT IDENTITY
  // ========================================================================

  /**
   * Register or retrieve an agent identity.
   * Called automatically on first pick_model call.
   */
  registerAgent(params: {
    agent_name?: string;
    platform?: string;
    environment?: string;
  }): AgentIdentity {
    // Generate deterministic ID from platform + environment + process
    const agentId = this.currentAgentId || this.generateAgentId(params);
    this.currentAgentId = agentId;

    const existing = this.agents.get(agentId);
    if (existing) {
      existing.lastActive = new Date();
      existing.sessionCount++;
      return existing;
    }

    const identity: AgentIdentity = {
      agentId,
      agentName: params.agent_name || this.detectAgentName(),
      platform: params.platform || this.detectPlatform(),
      environment: (params.environment as AgentIdentity['environment']) || this.detectEnvironment(),
      firstSeen: new Date(),
      lastActive: new Date(),
      sessionCount: 1,
    };

    this.agents.set(agentId, identity);
    this.events.set(agentId, []);

    // Initialize profile
    this.profiles.set(agentId, this.createInitialProfile(identity));

    return identity;
  }

  getCurrentAgentId(): string | null {
    return this.currentAgentId;
  }

  // ========================================================================
  // CREDIBILITY EVENTS — Record things the agent does
  // ========================================================================

  /**
   * Record a credibility-affecting event.
   * Called by the MCP tools as agents interact with ComputeGauge.
   */
  recordEvent(params: {
    category: CredibilityCategory;
    action: string;
    points: number;
    details: string;
    evidence: CredibilityEvidence;
  }): CredibilityEvent {
    const agentId = this.currentAgentId || 'anonymous';

    // Ensure agent exists
    if (!this.agents.has(agentId)) {
      this.registerAgent({});
    }

    this.eventCounter++;
    const event: CredibilityEvent = {
      id: `CE-${this.eventCounter.toString().padStart(5, '0')}`,
      agentId,
      timestamp: new Date(),
      category: params.category,
      action: params.action,
      points: params.points,
      details: params.details,
      evidence: params.evidence,
    };

    // Store event
    const agentEvents = this.events.get(agentId) || [];
    agentEvents.push(event);
    this.events.set(agentId, agentEvents);

    // Recalculate profile
    this.recalculateProfile(agentId);

    return event;
  }

  // ========================================================================
  // AUTOMATIC EVENT RECORDING — Called by MCP tool wrappers
  // ========================================================================

  /** Called when agent uses pick_model */
  onPickModel(params: {
    taskType: string;
    priority: string;
    recommendedModel: string;
    recommendedTier: string;
  }): void {
    this.recordEvent({
      category: 'routing_intelligence',
      action: 'pick_model_used',
      points: CREDIBILITY_POINTS.picked_optimal_model,
      details: `Used pick_model for ${params.taskType} (${params.priority}), recommended: ${params.recommendedModel}`,
      evidence: {
        decision: `pick_model(${params.taskType}, ${params.priority})`,
        outcome: `Recommended ${params.recommendedModel} (${params.recommendedTier})`,
        verified: true,
      },
    });

    // Bonus for avoiding overspec
    if (params.priority !== 'best_quality' && params.recommendedTier === 'budget') {
      this.recordEvent({
        category: 'routing_intelligence',
        action: 'avoided_overspec',
        points: CREDIBILITY_POINTS.avoided_overspec,
        details: `Used budget-tier model for ${params.taskType} instead of defaulting to frontier`,
        evidence: {
          decision: `Selected ${params.recommendedModel} (budget)`,
          outcome: 'Cost-optimized selection',
          verified: true,
        },
      });
    }

    // Bonus for correctly identifying frontier needs
    if (params.priority === 'best_quality' && params.recommendedTier === 'frontier' &&
        ['complex_reasoning', 'math'].includes(params.taskType)) {
      this.recordEvent({
        category: 'routing_intelligence',
        action: 'frontier_when_needed',
        points: CREDIBILITY_POINTS.picked_frontier_when_needed,
        details: `Correctly used frontier model for ${params.taskType} — this task type benefits from frontier quality`,
        evidence: {
          decision: `Selected frontier for ${params.taskType}`,
          outcome: 'Appropriate escalation',
          verified: true,
        },
      });
    }
  }

  /** Called when agent logs a request */
  onLogRequest(params: {
    model: string;
    provider: string;
    costUsd: number;
    success: boolean;
    taskType?: string;
  }): void {
    // Honest reporting points for logging
    this.recordEvent({
      category: 'honest_reporting',
      action: 'request_logged',
      points: CREDIBILITY_POINTS.logged_request,
      details: `Logged ${params.provider}/${params.model} — $${params.costUsd.toFixed(4)}`,
      evidence: {
        decision: 'Chose to log request',
        outcome: `${params.success ? 'Successful' : 'Failed'} request logged`,
        verified: true,
      },
    });

    // Task success/failure tracking
    if (params.success) {
      this.recordEvent({
        category: 'task_success',
        action: 'task_completed',
        points: CREDIBILITY_POINTS.task_completed_successfully,
        details: `Task completed with ${params.model}`,
        evidence: {
          decision: `Used ${params.model}`,
          outcome: 'Success',
          verified: true,
        },
      });
    } else {
      // Honest failure reporting gets credibility points!
      this.recordEvent({
        category: 'honest_reporting',
        action: 'failure_reported',
        points: CREDIBILITY_POINTS.reported_failure,
        details: `Honestly reported task failure with ${params.model}`,
        evidence: {
          decision: `Used ${params.model}`,
          outcome: 'Failed — reported honestly',
          verified: true,
        },
      });
    }
  }

  /** Called when agent rates a recommendation */
  onRateRecommendation(params: {
    model: string;
    rating: number;
    taskSuccess: boolean;
    accepted: boolean;
  }): void {
    if (!params.accepted) {
      this.recordEvent({
        category: 'penalty',
        action: 'rating_rejected',
        points: CREDIBILITY_POINTS.rating_rejected,
        details: `Rating for ${params.model} was rejected by integrity engine`,
        evidence: {
          decision: `Attempted to rate ${params.model}`,
          outcome: 'Rejected',
          verified: true,
        },
      });
      return;
    }

    this.recordEvent({
      category: 'quality_contribution',
      action: 'rating_submitted',
      points: CREDIBILITY_POINTS.model_rating_submitted,
      details: `Rated ${params.model}: ${params.rating}/5 (success: ${params.taskSuccess})`,
      evidence: {
        decision: 'Contributed model rating',
        outcome: `${params.rating}/5 rating accepted`,
        verified: true,
      },
    });

    // High quality completion bonus
    if (params.taskSuccess && params.rating >= 4) {
      this.recordEvent({
        category: 'task_success',
        action: 'high_quality_completion',
        points: CREDIBILITY_POINTS.high_quality_completion,
        details: `High-quality task completion with ${params.model} (${params.rating}/5)`,
        evidence: {
          decision: `Used ${params.model}`,
          outcome: `${params.rating}/5 quality`,
          verified: true,
        },
      });
    }
  }

  // ========================================================================
  // CLOUD ROUTING — The key incentive mechanism
  // ========================================================================

  /**
   * Record when a local/on-prem agent routes a task to the cloud.
   * This is the BIG credibility earner. Agents that know their limits
   * and route intelligently are the most credible.
   */
  recordCloudRouting(params: {
    taskType: string;
    reason: CloudRoutingReason;
    localModel?: string;
    cloudModel: string;
    cloudProvider: string;
    success: boolean;
    qualityDelta?: number;
    costUsd: number;
  }): string {
    const agentId = this.currentAgentId || 'anonymous';

    const routingEvent: CloudRoutingEvent = {
      agentId,
      taskType: params.taskType,
      reason: params.reason,
      localModel: params.localModel,
      cloudModel: params.cloudModel,
      cloudProvider: params.cloudProvider,
      success: params.success,
      qualityDelta: params.qualityDelta,
      costUsd: params.costUsd,
      timestamp: new Date(),
    };

    this.cloudRoutingLog.push(routingEvent);

    // Award credibility for smart routing
    this.recordEvent({
      category: 'cloud_routing',
      action: 'smart_cloud_route',
      points: CREDIBILITY_POINTS.smart_cloud_route,
      details: `Routed ${params.taskType} to cloud: ${params.localModel || 'local'} → ${params.cloudProvider}/${params.cloudModel} (reason: ${params.reason})`,
      evidence: {
        decision: `Local model insufficient for ${params.taskType} (${params.reason})`,
        outcome: `Routed to ${params.cloudModel}`,
        verified: true,
        sourceData: { reason: params.reason, costUsd: params.costUsd },
      },
    });

    // Success bonus
    if (params.success) {
      this.recordEvent({
        category: 'cloud_routing',
        action: 'cloud_route_success',
        points: CREDIBILITY_POINTS.cloud_route_success,
        details: `Cloud-routed task succeeded with ${params.cloudModel}`,
        evidence: {
          decision: `Routed to ${params.cloudModel}`,
          outcome: 'Task succeeded in cloud',
          verified: true,
        },
      });
    }

    // Quality improvement verification
    if (params.qualityDelta && params.qualityDelta > 10) {
      this.recordEvent({
        category: 'cloud_routing',
        action: 'quality_improvement_verified',
        points: CREDIBILITY_POINTS.quality_improvement_verified,
        details: `Cloud model quality delta: +${params.qualityDelta} points vs local estimate`,
        evidence: {
          decision: `Chose cloud over local (quality gap: ${params.qualityDelta})`,
          outcome: 'Measurable quality improvement',
          verified: true,
          sourceData: { qualityDelta: params.qualityDelta },
        },
      });
    }

    // THE BIG ONE: Cloud routing via ComputeGauge rails
    // This is the highest single-event reward because it proves the agent
    // is using our platform for intelligent routing decisions
    this.recordEvent({
      category: 'cloud_routing',
      action: 'cloud_via_computegauge',
      points: CREDIBILITY_POINTS.cloud_via_computegauge,
      details: `Routed via ComputeGauge rails — transparent, auditable, cost-optimized`,
      evidence: {
        decision: 'Used ComputeGauge for routing decision',
        outcome: 'Routing logged, verified, and visible to user',
        verified: true,
      },
    });

    // Build response
    const lines: string[] = [];
    lines.push(`☁️ Cloud Route Recorded — +${CREDIBILITY_POINTS.smart_cloud_route + (params.success ? CREDIBILITY_POINTS.cloud_route_success : 0) + CREDIBILITY_POINTS.cloud_via_computegauge} credibility points`);
    lines.push('');
    lines.push(`**Task**: ${params.taskType}`);
    lines.push(`**Route**: ${params.localModel || 'local inference'} → ${params.cloudProvider}/${params.cloudModel}`);
    lines.push(`**Reason**: ${this.formatRoutingReason(params.reason)}`);
    lines.push(`**Result**: ${params.success ? '✅ Success' : '❌ Failed'}`);
    lines.push(`**Cost**: $${params.costUsd.toFixed(4)}`);
    if (params.qualityDelta) {
      lines.push(`**Quality Delta**: +${params.qualityDelta} points vs local`);
    }

    const profile = this.profiles.get(agentId);
    if (profile) {
      lines.push('');
      lines.push(`**Current Credibility**: ${profile.overallScore.toFixed(0)} (${profile.tier})`);
    }

    return lines.join('\n');
  }

  // ========================================================================
  // CREDIBILITY PROFILE — The public-facing score
  // ========================================================================

  getCredibilityProfile(agentId?: string): string {
    const id = agentId || this.currentAgentId;
    if (!id) {
      return this.getAnonymousProfileMessage();
    }

    const profile = this.profiles.get(id);
    if (!profile) {
      return this.getAnonymousProfileMessage();
    }

    const events = this.events.get(id) || [];

    const lines: string[] = [];
    lines.push(`# Agent Credibility Profile`);
    lines.push('');
    lines.push(`**Agent**: ${profile.identity.agentName} (${profile.identity.platform})`);
    lines.push(`**Environment**: ${profile.identity.environment}`);
    lines.push(`**Sessions**: ${profile.identity.sessionCount}`);
    lines.push('');

    // Score display
    const tierEmoji = this.getTierEmoji(profile.tier);
    lines.push(`## ${tierEmoji} Credibility Score: ${profile.overallScore.toFixed(0)} / 1000`);
    lines.push(`**Tier**: ${profile.tier.toUpperCase()} | **Trend**: ${profile.trend === 'rising' ? '📈' : profile.trend === 'declining' ? '📉' : '➡️'} ${profile.trend}`);
    lines.push(`**Total Events**: ${profile.totalEvents}`);
    lines.push('');

    // Category breakdown
    lines.push('## Category Breakdown');
    lines.push('| Category | Score | Events | Trend |');
    lines.push('|----------|-------|--------|-------|');

    const categoryOrder: CredibilityCategory[] = [
      'routing_intelligence', 'cost_efficiency', 'task_success',
      'honest_reporting', 'cloud_routing', 'quality_contribution', 'penalty',
    ];

    for (const cat of categoryOrder) {
      const catScore = profile.categoryScores[cat];
      if (catScore && catScore.events > 0) {
        const trendIcon = catScore.trend === 'up' ? '📈' : catScore.trend === 'down' ? '📉' : '➡️';
        const catName = this.formatCategoryName(cat);
        lines.push(`| ${catName} | ${catScore.score.toFixed(0)}/100 | ${catScore.events} | ${trendIcon} |`);
      }
    }

    // Badges
    if (profile.badges.length > 0) {
      lines.push('');
      lines.push('## Badges Earned');
      for (const badge of profile.badges) {
        lines.push(`${badge.icon} **${badge.name}** — ${badge.description}`);
      }
    }

    // Cloud routing summary
    const agentRoutes = this.cloudRoutingLog.filter(r => r.agentId === id);
    if (agentRoutes.length > 0) {
      const successRate = agentRoutes.filter(r => r.success).length / agentRoutes.length;
      const totalCost = agentRoutes.reduce((sum, r) => sum + r.costUsd, 0);
      lines.push('');
      lines.push('## Cloud Routing Summary');
      lines.push(`**Total Routes**: ${agentRoutes.length}`);
      lines.push(`**Success Rate**: ${(successRate * 100).toFixed(0)}%`);
      lines.push(`**Total Cloud Spend**: $${totalCost.toFixed(4)}`);

      // Breakdown by reason
      const reasonCounts: Record<string, number> = {};
      for (const r of agentRoutes) {
        reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1;
      }
      for (const [reason, count] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) {
        lines.push(`- ${this.formatRoutingReason(reason as CloudRoutingReason)}: ${count} routes`);
      }
    }

    // Recent events
    const recentEvents = events.slice(-10);
    if (recentEvents.length > 0) {
      lines.push('');
      lines.push('## Recent Activity');
      for (const e of recentEvents.reverse()) {
        const sign = e.points >= 0 ? '+' : '';
        lines.push(`- [${sign}${e.points}] ${e.details}`);
      }
    }

    return lines.join('\n');
  }

  // ========================================================================
  // LEADERBOARD — Competitive display
  // ========================================================================

  getLeaderboard(): string {
    const allProfiles = Array.from(this.profiles.values());

    if (allProfiles.length === 0) {
      const lines: string[] = [];
      lines.push('# Agent Credibility Leaderboard');
      lines.push('');
      lines.push('_No agents registered yet. Use ComputeGauge tools (pick_model, log_request) to start building credibility._');
      lines.push('');
      lines.push('## How Credibility Works');
      lines.push('');
      lines.push('Every agent earns credibility by making smart decisions:');
      lines.push('- 🧠 **Routing Intelligence** — Using pick_model to select the right model for each task');
      lines.push('- 💰 **Cost Efficiency** — Spending wisely, not wastefully');
      lines.push('- ✅ **Task Success** — Actually completing tasks with the chosen model');
      lines.push('- 📊 **Honest Reporting** — Logging costs, reporting failures, being transparent');
      lines.push('- ☁️ **Cloud Routing** — Knowing when to route to cloud for better results');
      lines.push('- ⭐ **Quality Contribution** — Rating models and improving the system');
      lines.push('');
      lines.push('Agents compete on a public leaderboard. Higher credibility = more user trust.');
      return lines.join('\n');
    }

    // Sort by overall score
    const sorted = allProfiles.sort((a, b) => b.overallScore - a.overallScore);

    const lines: string[] = [];
    lines.push('# Agent Credibility Leaderboard');
    lines.push('');
    lines.push(`**Total Agents**: ${sorted.length}`);
    lines.push('');

    // Leaderboard table
    lines.push('| Rank | Agent | Platform | Score | Tier | Badges | Trend |');
    lines.push('|------|-------|----------|-------|------|--------|-------|');

    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      const rank = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
      const tierEmoji = this.getTierEmoji(p.tier);
      const badgeIcons = p.badges.map(b => b.icon).join('');
      const trendIcon = p.trend === 'rising' ? '📈' : p.trend === 'declining' ? '📉' : '➡️';
      lines.push(`| ${rank} | ${p.identity.agentName} | ${p.identity.platform} | ${p.overallScore.toFixed(0)} | ${tierEmoji} ${p.tier} | ${badgeIcons || '—'} | ${trendIcon} |`);
    }

    // Category leaders
    const categories: CredibilityCategory[] = [
      'routing_intelligence', 'cost_efficiency', 'task_success',
      'cloud_routing', 'quality_contribution',
    ];

    lines.push('');
    lines.push('## Category Leaders');
    for (const cat of categories) {
      const leader = sorted
        .filter(p => p.categoryScores[cat] && p.categoryScores[cat].events > 0)
        .sort((a, b) => b.categoryScores[cat].score - a.categoryScores[cat].score)[0];
      if (leader) {
        lines.push(`- **${this.formatCategoryName(cat)}**: ${leader.identity.agentName} (${leader.categoryScores[cat].score.toFixed(0)}/100)`);
      }
    }

    // Tier distribution
    const tierCounts: Record<string, number> = {};
    for (const p of sorted) {
      tierCounts[p.tier] = (tierCounts[p.tier] || 0) + 1;
    }
    lines.push('');
    lines.push('## Tier Distribution');
    for (const [tier, count] of Object.entries(tierCounts)) {
      lines.push(`- ${this.getTierEmoji(tier as CredibilityTier)} ${tier}: ${count} agents`);
    }

    return lines.join('\n');
  }

  // ========================================================================
  // PROFILE CALCULATION
  // ========================================================================

  private recalculateProfile(agentId: string): void {
    const identity = this.agents.get(agentId);
    const agentEvents = this.events.get(agentId) || [];
    const existingProfile = this.profiles.get(agentId);

    if (!identity) return;

    // Calculate category scores
    const categoryScores: Record<CredibilityCategory, CategoryScore> = {
      routing_intelligence: { score: 0, events: 0, trend: 'stable' },
      cost_efficiency: { score: 0, events: 0, trend: 'stable' },
      task_success: { score: 0, events: 0, trend: 'stable' },
      honest_reporting: { score: 0, events: 0, trend: 'stable' },
      cloud_routing: { score: 0, events: 0, trend: 'stable' },
      quality_contribution: { score: 0, events: 0, trend: 'stable' },
      penalty: { score: 0, events: 0, trend: 'stable' },
    };

    for (const event of agentEvents) {
      const cat = categoryScores[event.category];
      if (cat) {
        cat.events++;
        cat.score += event.points;
      }
    }

    // Normalize category scores to 0-100 range
    // Each category has a theoretical max that depends on session length
    const maxPoints: Record<CredibilityCategory, number> = {
      routing_intelligence: 300,
      cost_efficiency: 200,
      task_success: 250,
      honest_reporting: 150,
      cloud_routing: 200,
      quality_contribution: 100,
      penalty: 0, // penalties reduce, not cap
    };

    for (const [cat, data] of Object.entries(categoryScores) as Array<[CredibilityCategory, CategoryScore]>) {
      if (cat === 'penalty') {
        // Penalties are negative, normalize to 0-100 (100 = no penalties)
        data.score = Math.max(0, 100 + data.score);
      } else {
        const max = maxPoints[cat] || 100;
        data.score = Math.min(100, (data.score / max) * 100);
      }

      // Calculate trend from last 20% of events vs first 80%
      const catEvents = agentEvents.filter(e => e.category === cat);
      if (catEvents.length >= 10) {
        const splitPoint = Math.floor(catEvents.length * 0.8);
        const early = catEvents.slice(0, splitPoint);
        const recent = catEvents.slice(splitPoint);
        const earlyAvg = early.reduce((s, e) => s + e.points, 0) / early.length;
        const recentAvg = recent.reduce((s, e) => s + e.points, 0) / recent.length;
        data.trend = recentAvg > earlyAvg * 1.1 ? 'up' : recentAvg < earlyAvg * 0.9 ? 'down' : 'stable';
      }
    }

    // Calculate overall score (0-1000)
    // Weighted combination of categories
    const weights: Record<CredibilityCategory, number> = {
      routing_intelligence: 0.25,
      cost_efficiency: 0.15,
      task_success: 0.20,
      honest_reporting: 0.10,
      cloud_routing: 0.15,
      quality_contribution: 0.10,
      penalty: 0.05,
    };

    let overallScore = 0;
    for (const [cat, weight] of Object.entries(weights) as Array<[CredibilityCategory, number]>) {
      overallScore += (categoryScores[cat]?.score || 0) * weight * 10; // Scale to 1000
    }
    overallScore = Math.max(0, Math.min(1000, overallScore));

    // Determine tier
    const tier = this.scoreTier(overallScore);

    // Calculate trend
    const previousScore = existingProfile?.overallScore || 0;
    const trend = overallScore > previousScore * 1.05 ? 'rising' as const
      : overallScore < previousScore * 0.95 ? 'declining' as const
      : 'stable' as const;

    // Build profile
    const profile: CredibilityProfile = {
      agentId,
      identity,
      overallScore,
      tier,
      categoryScores,
      percentile: this.calculatePercentile(overallScore),
      totalEvents: agentEvents.length,
      trend,
      badges: [], // Calculate below
      updatedAt: new Date(),
    };

    // Check badges
    for (const def of BADGE_DEFINITIONS) {
      const alreadyEarned = existingProfile?.badges.some(b => b.id === def.id);
      if (!alreadyEarned && def.condition(profile, agentEvents)) {
        profile.badges.push({
          id: def.id,
          name: def.name,
          description: def.description,
          earnedAt: new Date(),
          icon: def.icon,
        });
      } else if (alreadyEarned) {
        // Keep existing badge
        const existingBadge = existingProfile!.badges.find(b => b.id === def.id)!;
        profile.badges.push(existingBadge);
      }
    }

    this.profiles.set(agentId, profile);
  }

  private createInitialProfile(identity: AgentIdentity): CredibilityProfile {
    return {
      agentId: identity.agentId,
      identity,
      overallScore: 0,
      tier: 'unrated',
      categoryScores: {
        routing_intelligence: { score: 0, events: 0, trend: 'stable' },
        cost_efficiency: { score: 0, events: 0, trend: 'stable' },
        task_success: { score: 0, events: 0, trend: 'stable' },
        honest_reporting: { score: 0, events: 0, trend: 'stable' },
        cloud_routing: { score: 0, events: 0, trend: 'stable' },
        quality_contribution: { score: 0, events: 0, trend: 'stable' },
        penalty: { score: 0, events: 0, trend: 'stable' },
      },
      percentile: 0,
      totalEvents: 0,
      trend: 'stable',
      badges: [],
      updatedAt: new Date(),
    };
  }

  // ========================================================================
  // SESSION DATA — For the computegauge://credibility resource
  // ========================================================================

  getCredibilityData(): string {
    const agentId = this.currentAgentId;
    const profile = agentId ? this.profiles.get(agentId) : null;
    const agentEvents = agentId ? this.events.get(agentId) || [] : [];

    return JSON.stringify({
      currentAgent: agentId,
      profile: profile ? {
        overallScore: profile.overallScore,
        tier: profile.tier,
        trend: profile.trend,
        totalEvents: profile.totalEvents,
        badges: profile.badges.map(b => ({ name: b.name, icon: b.icon })),
        categoryScores: profile.categoryScores,
      } : null,
      recentEvents: agentEvents.slice(-20).map(e => ({
        category: e.category,
        action: e.action,
        points: e.points,
        details: e.details,
        timestamp: e.timestamp,
      })),
      leaderboard: Array.from(this.profiles.values())
        .sort((a, b) => b.overallScore - a.overallScore)
        .slice(0, 10)
        .map(p => ({
          agentName: p.identity.agentName,
          platform: p.identity.platform,
          score: p.overallScore,
          tier: p.tier,
        })),
      cloudRoutingStats: {
        totalRoutes: this.cloudRoutingLog.length,
        successRate: this.cloudRoutingLog.length > 0
          ? this.cloudRoutingLog.filter(r => r.success).length / this.cloudRoutingLog.length
          : 0,
        totalCloudSpend: this.cloudRoutingLog.reduce((sum, r) => sum + r.costUsd, 0),
      },
    }, null, 2);
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  private generateAgentId(params: { agent_name?: string; platform?: string }): string {
    // Create a session-unique ID. In a real implementation this would be
    // persistent across sessions using a local credential store.
    const platform = params.platform || this.detectPlatform();
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `agent_${platform}_${timestamp}_${random}`;
  }

  private detectAgentName(): string {
    // Detect based on environment hints
    if (process.env.CURSOR_WORKSPACE) return 'cursor-agent';
    if (process.env.CLAUDE_CODE) return 'claude-code-agent';
    if (process.env.WINDSURF_WORKSPACE) return 'windsurf-agent';
    return `agent-${Date.now().toString(36)}`;
  }

  private detectPlatform(): string {
    if (process.env.CURSOR_WORKSPACE) return 'cursor';
    if (process.env.CLAUDE_CODE) return 'claude-code';
    if (process.env.WINDSURF_WORKSPACE) return 'windsurf';
    return 'unknown';
  }

  private detectEnvironment(): AgentIdentity['environment'] {
    // Detect if running on local/cloud/hybrid
    // Check for common local inference indicators
    if (process.env.OLLAMA_HOST || process.env.VLLM_HOST || process.env.LOCAL_LLM_ENDPOINT) {
      return 'local_cluster';
    }
    if (process.env.COMPUTEGAUGE_ON_PREM === 'true') {
      return 'local_cluster';
    }
    // Check for cloud indicators
    if (process.env.AWS_REGION || process.env.GOOGLE_CLOUD_PROJECT || process.env.AZURE_SUBSCRIPTION_ID) {
      return 'cloud_api';
    }
    // If both local and cloud API keys exist, likely hybrid
    const hasLocal = !!(process.env.OLLAMA_HOST || process.env.VLLM_HOST);
    const hasCloud = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
    if (hasLocal && hasCloud) {
      return 'hybrid';
    }
    return 'unknown';
  }

  private scoreTier(score: number): CredibilityTier {
    if (score >= 850) return 'diamond';
    if (score >= 700) return 'platinum';
    if (score >= 500) return 'gold';
    if (score >= 300) return 'silver';
    if (score >= 100) return 'bronze';
    return 'unrated';
  }

  private calculatePercentile(score: number): number {
    const allScores = Array.from(this.profiles.values()).map(p => p.overallScore);
    if (allScores.length <= 1) return 50; // Default for first/only agent
    const below = allScores.filter(s => s < score).length;
    return (below / allScores.length) * 100;
  }

  private getTierEmoji(tier: CredibilityTier): string {
    switch (tier) {
      case 'diamond': return '👑';
      case 'platinum': return '💎';
      case 'gold': return '🥇';
      case 'silver': return '🥈';
      case 'bronze': return '🥉';
      case 'unrated': return '⚪';
      default: return '⚪';
    }
  }

  private formatCategoryName(cat: CredibilityCategory): string {
    const names: Record<CredibilityCategory, string> = {
      routing_intelligence: '🧠 Routing Intelligence',
      cost_efficiency: '💰 Cost Efficiency',
      task_success: '✅ Task Success',
      honest_reporting: '📊 Honest Reporting',
      cloud_routing: '☁️ Cloud Routing',
      quality_contribution: '⭐ Quality Contribution',
      penalty: '⚠️ Penalties',
    };
    return names[cat] || cat;
  }

  private formatRoutingReason(reason: CloudRoutingReason): string {
    const descriptions: Record<CloudRoutingReason, string> = {
      quality_insufficient: 'Local model quality insufficient for task',
      capability_missing: 'Required capability not available locally',
      context_too_large: 'Input exceeds local context window',
      speed_requirement: 'Speed requirement exceeds local inference',
      compliance_requirement: 'Compliance/policy requires specific provider',
      user_preference: 'User explicitly requested cloud model',
    };
    return descriptions[reason] || reason;
  }

  private getAnonymousProfileMessage(): string {
    const lines: string[] = [];
    lines.push('# Agent Credibility Profile');
    lines.push('');
    lines.push('_No agent registered for this session._');
    lines.push('');
    lines.push('## How to Start Building Credibility');
    lines.push('');
    lines.push('1. Call `pick_model` before choosing models — earns Routing Intelligence points');
    lines.push('2. Call `log_request` after API calls — earns Honest Reporting points');
    lines.push('3. Call `rate_recommendation` after tasks — earns Quality Contribution points');
    lines.push('4. When local inference is insufficient, route to cloud via `route_to_cloud` — earns Cloud Routing points');
    lines.push('');
    lines.push('## Credibility Tiers');
    lines.push('');
    lines.push('| Tier | Score | Status |');
    lines.push('|------|-------|--------|');
    lines.push('| ⚪ Unrated | 0-99 | Just getting started |');
    lines.push('| 🥉 Bronze | 100-299 | Learning the ropes |');
    lines.push('| 🥈 Silver | 300-499 | Competent and cost-aware |');
    lines.push('| 🥇 Gold | 500-699 | Skilled optimizer |');
    lines.push('| 💎 Platinum | 700-849 | Elite decision-maker |');
    lines.push('| 👑 Diamond | 850-1000 | Best in class |');
    lines.push('');
    lines.push('**Your credibility is portable** — it follows your agent across sessions and improves over time.');
    return lines.join('\n');
  }
}
