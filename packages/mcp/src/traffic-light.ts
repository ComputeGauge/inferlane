// ============================================================================
// AgentTrafficLight — Per-agent status indicator system
//
// Floating status for multi-agent setups:
//   GREEN  = Agent idle, ready for new tasks
//   AMBER  = Agent processing, task in progress (shows ETA if available)
//   RED    = Agent blocked, waiting for user input/approval
//   BLUE   = Agent completed task, results ready for review
//
// Status changes are driven by tool calls and explicit set_status calls.
// Multiple lights for multi-agent setups (one per agent_id).
// ============================================================================

export type TrafficLightColor = 'green' | 'amber' | 'red' | 'blue';

// ============================================================================
// Agent Lifecycle Phases — granular workflow tracking for cost-per-phase analysis
// ============================================================================

export type AgentLifecyclePhase =
  | 'idle'              // GREEN equivalent — ready for new work
  | 'coding'            // Actively generating code
  | 'testing'           // Running tests
  | 'pr_open'           // PR created, awaiting review
  | 'ci_running'        // CI pipeline executing
  | 'ci_passed'         // CI green
  | 'ci_failed'         // CI red — may trigger retry
  | 'review_pending'    // Awaiting human review
  | 'changes_requested' // Reviewer requested changes
  | 'approved'          // PR approved
  | 'merged'            // PR merged
  | 'deployed';         // Deployed to environment

export interface LifecycleTransition {
  agentId: string;
  from: AgentLifecyclePhase;
  to: AgentLifecyclePhase;
  timestamp: number;
  tokensDuringPhase: number;    // tokens consumed in the 'from' phase
  costDuringPhase: number;      // cost in USD for the 'from' phase
  durationMs: number;           // time spent in the 'from' phase
}

const PHASE_TO_COLOR: Record<AgentLifecyclePhase, TrafficLightColor> = {
  idle: 'green',
  coding: 'amber',
  testing: 'amber',
  pr_open: 'blue',
  ci_running: 'amber',
  ci_passed: 'green',
  ci_failed: 'red',
  review_pending: 'red',
  changes_requested: 'red',
  approved: 'green',
  merged: 'blue',
  deployed: 'blue',
};

const PHASE_LABELS: Record<AgentLifecyclePhase, string> = {
  idle: 'Idle — Ready',
  coding: 'Coding',
  testing: 'Running Tests',
  pr_open: 'PR Opened',
  ci_running: 'CI Running',
  ci_passed: 'CI Passed ✓',
  ci_failed: 'CI Failed ✗',
  review_pending: 'Awaiting Review',
  changes_requested: 'Changes Requested',
  approved: 'Approved ✓',
  merged: 'Merged',
  deployed: 'Deployed 🚀',
};

const PHASE_EMOJI: Record<AgentLifecyclePhase, string> = {
  idle: '⏸️',
  coding: '💻',
  testing: '🧪',
  pr_open: '📬',
  ci_running: '⚙️',
  ci_passed: '✅',
  ci_failed: '❌',
  review_pending: '👀',
  changes_requested: '📝',
  approved: '👍',
  merged: '🔀',
  deployed: '🚀',
};

export interface AgentStatus {
  agentId: string;
  color: TrafficLightColor;
  label: string;
  detail?: string;
  taskType?: string;
  startedAt?: number;     // when current task started (for ETA)
  estimatedMs?: number;   // estimated task duration in ms
  completedAt?: number;   // when task completed (for blue state)
  lastUpdate: number;     // timestamp of last status change
  history: StatusChange[];
  // Lifecycle tracking (AG)
  lifecyclePhase?: AgentLifecyclePhase;
  phaseStartedAt?: number;         // when current phase started
  phaseTokensAccumulated?: number; // tokens consumed in current phase
  phaseCostAccumulated?: number;   // cost accumulated in current phase
}

export interface StatusChange {
  from: TrafficLightColor;
  to: TrafficLightColor;
  label: string;
  timestamp: number;
}

export interface TrafficLightSummary {
  agents: AgentStatus[];
  totalAgents: number;
  byColor: Record<TrafficLightColor, number>;
}

const COLOR_EMOJI: Record<TrafficLightColor, string> = {
  green: '🟢',
  amber: '🟡',
  red: '🔴',
  blue: '🔵',
};

const COLOR_LABEL: Record<TrafficLightColor, string> = {
  green: 'IDLE — Ready',
  amber: 'PROCESSING',
  red: 'BLOCKED — Needs Input',
  blue: 'COMPLETED — Review Results',
};

// Max history entries per agent
const MAX_HISTORY = 50;

export class AgentTrafficLightSystem {
  private agents: Map<string, AgentStatus> = new Map();
  private listeners: Array<(agentId: string, status: AgentStatus) => void> = [];
  private lifecycleListeners: Array<(transition: LifecycleTransition) => void> = [];
  // Lifecycle history — persisted separately via PersistenceLayer
  private lifecycleHistory: LifecycleTransition[] = [];
  private static readonly MAX_LIFECYCLE_HISTORY = 500;

  /**
   * Set an agent's status explicitly.
   */
  setStatus(
    agentId: string,
    color: TrafficLightColor,
    label?: string,
    options?: { detail?: string; taskType?: string; estimatedMs?: number }
  ): AgentStatus {
    const existing = this.agents.get(agentId);
    const now = Date.now();

    const newStatus: AgentStatus = {
      agentId,
      color,
      label: label || COLOR_LABEL[color],
      detail: options?.detail,
      taskType: options?.taskType,
      startedAt: color === 'amber' ? now : existing?.startedAt,
      estimatedMs: options?.estimatedMs ?? existing?.estimatedMs,
      completedAt: color === 'blue' ? now : undefined,
      lastUpdate: now,
      history: existing?.history || [],
    };

    // Record status change in history
    if (existing && existing.color !== color) {
      newStatus.history.push({
        from: existing.color,
        to: color,
        label: newStatus.label,
        timestamp: now,
      });
      // Trim history
      if (newStatus.history.length > MAX_HISTORY) {
        newStatus.history = newStatus.history.slice(-MAX_HISTORY);
      }
    }

    this.agents.set(agentId, newStatus);

    // Notify listeners
    for (const listener of this.listeners) {
      try { listener(agentId, newStatus); } catch { /* ignore */ }
    }

    return newStatus;
  }

  /**
   * Get a specific agent's status.
   */
  getStatus(agentId: string): AgentStatus | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Auto-transition based on tool calls.
   * Called from index.ts tool handlers to drive status automatically.
   */
  onToolCall(agentId: string, toolName: string, taskType?: string): void {
    const id = agentId || 'default';

    switch (toolName) {
      case 'pick_model':
        // Agent is about to start work
        this.setStatus(id, 'amber', 'Selecting model...', { taskType });
        break;

      case 'log_request':
        // Agent just completed an API call — still processing
        this.setStatus(id, 'amber', 'Processing...', { taskType });
        break;

      case 'rate_recommendation':
        // Agent finished a task and is rating — transition to blue
        this.setStatus(id, 'blue', 'Task completed', { taskType });
        break;

      case 'session_cost':
        // Agent is checking costs — likely between tasks
        this.setStatus(id, 'green', 'Idle — checking costs');
        break;

      case 'assess_routing':
        // Agent is deciding where to route — processing
        this.setStatus(id, 'amber', 'Routing assessment...', { taskType });
        break;

      case 'route_to_cloud':
        // Agent routed to cloud — still processing
        this.setStatus(id, 'amber', 'Cloud routing...', { taskType });
        break;

      case 'route_via_platform':
        // Agent is making a platform request — processing
        this.setStatus(id, 'amber', 'Platform request...', { taskType });
        break;

      case 'improvement_cycle':
        // Agent is running improvement — processing
        this.setStatus(id, 'amber', 'Running improvement cycle...');
        break;

      case 'credibility_profile':
        // Agent is checking profile — likely idle
        this.setStatus(id, 'green', 'Idle — reviewing profile');
        break;
    }
  }

  /**
   * Set an agent's lifecycle phase. Automatically derives traffic light color.
   * Records tokens/cost accumulated in the previous phase as a LifecycleTransition.
   */
  setLifecyclePhase(
    agentId: string,
    phase: AgentLifecyclePhase,
    options?: { detail?: string; taskType?: string; tokensConsumed?: number; costUsd?: number }
  ): { status: AgentStatus; transition?: LifecycleTransition } {
    const id = agentId || 'default';
    const existing = this.agents.get(id);
    const now = Date.now();
    let transition: LifecycleTransition | undefined;

    // Record transition from previous phase (if any)
    if (existing?.lifecyclePhase && existing.lifecyclePhase !== phase) {
      const durationMs = existing.phaseStartedAt ? now - existing.phaseStartedAt : 0;

      transition = {
        agentId: id,
        from: existing.lifecyclePhase,
        to: phase,
        timestamp: now,
        tokensDuringPhase: existing.phaseTokensAccumulated ?? 0,
        costDuringPhase: existing.phaseCostAccumulated ?? 0,
        durationMs,
      };

      this.lifecycleHistory.push(transition);
      if (this.lifecycleHistory.length > AgentTrafficLightSystem.MAX_LIFECYCLE_HISTORY) {
        this.lifecycleHistory = this.lifecycleHistory.slice(-AgentTrafficLightSystem.MAX_LIFECYCLE_HISTORY);
      }

      // Notify lifecycle listeners
      for (const listener of this.lifecycleListeners) {
        try { listener(transition); } catch { /* ignore */ }
      }
    }

    // Derive traffic light color from phase
    const color = PHASE_TO_COLOR[phase];
    const label = PHASE_LABELS[phase];

    // Set the new status with lifecycle tracking
    const status = this.setStatus(id, color, label, {
      detail: options?.detail,
      taskType: options?.taskType,
    });

    // Attach lifecycle fields
    status.lifecyclePhase = phase;
    status.phaseStartedAt = now;
    status.phaseTokensAccumulated = 0;
    status.phaseCostAccumulated = 0;
    this.agents.set(id, status);

    return { status, transition };
  }

  /**
   * Accumulate tokens and cost for the current phase.
   * Called from log_request to attribute cost to lifecycle phases.
   */
  accumulatePhaseUsage(agentId: string, tokens: number, costUsd: number): void {
    const id = agentId || 'default';
    const existing = this.agents.get(id);
    if (!existing) return;

    existing.phaseTokensAccumulated = (existing.phaseTokensAccumulated ?? 0) + tokens;
    existing.phaseCostAccumulated = (existing.phaseCostAccumulated ?? 0) + costUsd;
    this.agents.set(id, existing);
  }

  /**
   * Subscribe to lifecycle transitions.
   */
  onLifecycleTransition(listener: (transition: LifecycleTransition) => void): () => void {
    this.lifecycleListeners.push(listener);
    return () => {
      this.lifecycleListeners = this.lifecycleListeners.filter(l => l !== listener);
    };
  }

  /**
   * Get lifecycle report for an agent (or all agents).
   */
  getLifecycleReport(agentId?: string): {
    transitions: LifecycleTransition[];
    phaseBreakdown: Record<string, { count: number; totalTokens: number; totalCost: number; totalDurationMs: number; avgDurationMs: number }>;
    totalTokens: number;
    totalCost: number;
    totalDurationMs: number;
  } {
    const transitions = agentId
      ? this.lifecycleHistory.filter(t => t.agentId === agentId)
      : this.lifecycleHistory;

    const breakdown: Record<string, { count: number; totalTokens: number; totalCost: number; totalDurationMs: number; avgDurationMs: number }> = {};

    let totalTokens = 0;
    let totalCost = 0;
    let totalDurationMs = 0;

    for (const t of transitions) {
      const phase = t.from;
      if (!breakdown[phase]) {
        breakdown[phase] = { count: 0, totalTokens: 0, totalCost: 0, totalDurationMs: 0, avgDurationMs: 0 };
      }
      breakdown[phase].count++;
      breakdown[phase].totalTokens += t.tokensDuringPhase;
      breakdown[phase].totalCost += t.costDuringPhase;
      breakdown[phase].totalDurationMs += t.durationMs;
      breakdown[phase].avgDurationMs = breakdown[phase].totalDurationMs / breakdown[phase].count;

      totalTokens += t.tokensDuringPhase;
      totalCost += t.costDuringPhase;
      totalDurationMs += t.durationMs;
    }

    return { transitions, phaseBreakdown: breakdown, totalTokens, totalCost, totalDurationMs };
  }

  /**
   * Format lifecycle report as markdown.
   */
  formatLifecycleReport(agentId?: string): string {
    const report = this.getLifecycleReport(agentId);
    const lines: string[] = [];

    lines.push(`# Agent Lifecycle Report${agentId ? ` — ${agentId}` : ''}`);
    lines.push('');

    if (report.transitions.length === 0) {
      lines.push('No lifecycle transitions recorded yet. Use `set_lifecycle_phase` to track agent workflow phases.');
      return lines.join('\n');
    }

    // Summary
    lines.push('## Summary');
    lines.push(`- **Total transitions**: ${report.transitions.length}`);
    lines.push(`- **Total tokens**: ${report.totalTokens.toLocaleString()}`);
    lines.push(`- **Total cost**: $${report.totalCost.toFixed(4)}`);
    lines.push(`- **Total time**: ${formatDuration(report.totalDurationMs)}`);
    lines.push('');

    // Phase breakdown table
    lines.push('## Cost Per Phase');
    lines.push('');
    lines.push('| Phase | Count | Tokens | Cost | Avg Duration | % of Total Cost |');
    lines.push('|-------|-------|--------|------|-------------|-----------------|');

    const phases = Object.entries(report.phaseBreakdown)
      .sort(([, a], [, b]) => b.totalCost - a.totalCost);

    for (const [phase, data] of phases) {
      const emoji = PHASE_EMOJI[phase as AgentLifecyclePhase] || '•';
      const costPct = report.totalCost > 0 ? ((data.totalCost / report.totalCost) * 100).toFixed(1) : '0.0';
      lines.push(`| ${emoji} ${phase} | ${data.count} | ${data.totalTokens.toLocaleString()} | $${data.totalCost.toFixed(4)} | ${formatDuration(data.avgDurationMs)} | ${costPct}% |`);
    }

    lines.push('');

    // Recent transitions
    const recent = report.transitions.slice(-10);
    lines.push('## Recent Transitions');
    lines.push('');
    for (const t of recent) {
      const fromEmoji = PHASE_EMOJI[t.from] || '•';
      const toEmoji = PHASE_EMOJI[t.to] || '•';
      const agoSec = Math.floor((Date.now() - t.timestamp) / 1000);
      const agoStr = agoSec < 60 ? `${agoSec}s ago` : agoSec < 3600 ? `${Math.floor(agoSec / 60)}m ago` : agoSec < 86400 ? `${Math.floor(agoSec / 3600)}h ago` : `${Math.floor(agoSec / 86400)}d ago`;
      lines.push(`- ${fromEmoji} ${t.from} → ${toEmoji} ${t.to} (${t.tokensDuringPhase} tokens, $${t.costDuringPhase.toFixed(4)}, ${formatDuration(t.durationMs)}) — ${agoStr}`);
    }

    return lines.join('\n');
  }

  /**
   * Load lifecycle history from persistence (called on startup).
   */
  loadLifecycleHistory(transitions: LifecycleTransition[]): void {
    this.lifecycleHistory = transitions.slice(-AgentTrafficLightSystem.MAX_LIFECYCLE_HISTORY);
  }

  /**
   * Get lifecycle history for persistence.
   */
  getLifecycleHistory(): LifecycleTransition[] {
    return [...this.lifecycleHistory];
  }

  /**
   * Subscribe to status changes.
   */
  onStatusChange(listener: (agentId: string, status: AgentStatus) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Get summary of all agents.
   */
  getSummary(): TrafficLightSummary {
    const agents = [...this.agents.values()];
    const byColor: Record<TrafficLightColor, number> = {
      green: 0, amber: 0, red: 0, blue: 0,
    };
    for (const agent of agents) {
      byColor[agent.color]++;
    }
    return { agents, totalAgents: agents.length, byColor };
  }

  /**
   * Format as markdown display.
   */
  formatDisplay(agentId?: string): string {
    const lines: string[] = [];

    if (agentId) {
      // Single agent view
      const status = this.agents.get(agentId);
      if (!status) {
        return `No status tracked for agent \`${agentId}\`. Status tracking begins when the agent makes its first tool call.`;
      }
      lines.push(`# Agent Status: ${agentId}`);
      lines.push('');
      lines.push(this.formatAgentBlock(status));
      return lines.join('\n');
    }

    // All agents view
    const summary = this.getSummary();

    if (summary.totalAgents === 0) {
      return '# Agent Traffic Light\n\nNo agents tracked yet. Status tracking begins when agents make tool calls (pick_model, log_request, etc.).';
    }

    lines.push('# Agent Traffic Light');
    lines.push('');

    // Summary bar
    const colorBar = [
      summary.byColor.green > 0 ? `${COLOR_EMOJI.green} ${summary.byColor.green} idle` : '',
      summary.byColor.amber > 0 ? `${COLOR_EMOJI.amber} ${summary.byColor.amber} processing` : '',
      summary.byColor.red > 0 ? `${COLOR_EMOJI.red} ${summary.byColor.red} blocked` : '',
      summary.byColor.blue > 0 ? `${COLOR_EMOJI.blue} ${summary.byColor.blue} completed` : '',
    ].filter(Boolean).join('  ');
    lines.push(colorBar);
    lines.push('');

    // Per-agent details
    for (const agent of summary.agents) {
      lines.push(this.formatAgentBlock(agent));
      lines.push('');
    }

    return lines.join('\n');
  }

  private formatAgentBlock(status: AgentStatus): string {
    const lines: string[] = [];
    const emoji = COLOR_EMOJI[status.color];
    const now = Date.now();

    lines.push(`## ${emoji} ${status.agentId}`);
    lines.push(`**Status**: ${status.label}`);
    if (status.detail) lines.push(`**Detail**: ${status.detail}`);
    if (status.taskType) lines.push(`**Task**: ${status.taskType}`);

    // ETA for amber state
    if (status.color === 'amber' && status.startedAt && status.estimatedMs) {
      const elapsed = now - status.startedAt;
      const remaining = Math.max(0, status.estimatedMs - elapsed);
      if (remaining > 0) {
        lines.push(`**ETA**: ~${Math.ceil(remaining / 1000)}s remaining`);
      }
    }

    // Duration for amber state
    if (status.color === 'amber' && status.startedAt) {
      const elapsed = Math.floor((now - status.startedAt) / 1000);
      lines.push(`**Duration**: ${elapsed}s`);
    }

    // Completed time for blue state
    if (status.color === 'blue' && status.completedAt && status.startedAt) {
      const duration = Math.floor((status.completedAt - status.startedAt) / 1000);
      lines.push(`**Completed in**: ${duration}s`);
    }

    // Recent history
    if (status.history.length > 0) {
      const recent = status.history.slice(-5);
      lines.push('');
      lines.push('**Recent transitions**:');
      for (const change of recent) {
        const agoSec = Math.floor((now - change.timestamp) / 1000);
        const agoStr = agoSec < 60 ? `${agoSec}s ago` : agoSec < 3600 ? `${Math.floor(agoSec / 60)}m ago` : agoSec < 86400 ? `${Math.floor(agoSec / 3600)}h ago` : `${Math.floor(agoSec / 86400)}d ago`;
        lines.push(`- ${COLOR_EMOJI[change.from]} → ${COLOR_EMOJI[change.to]} ${change.label} (${agoStr})`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get JSON data for the event stream.
   */
  getStatusData(agentId?: string): object {
    if (agentId) {
      const status = this.agents.get(agentId);
      return status ? { agent: status } : { agent: null };
    }
    return this.getSummary();
  }
}

// ============================================================================
// Helpers
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
