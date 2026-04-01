// ============================================================================
// TokenTachometer — Real-time token velocity visualization engine
//
// Tracks tokens/sec flowing through the system across all providers.
// States: IDLE → ACTIVE → HIGH_LOAD → REDLINE
// REDLINE triggers when multiple LLMs are running concurrently.
//
// The "shares" moment: screenshot of the gauge redlining during a heavy session.
// ============================================================================

export type TachometerState = 'idle' | 'active' | 'high_load' | 'redline';

export interface TachometerReading {
  state: TachometerState;
  tokensPerSecond: number;
  costPerSecond: number;
  activeProviders: string[];
  concurrentRequests: number;
  windows: {
    '5s': { tokens: number; cost: number; tps: number };
    '15s': { tokens: number; cost: number; tps: number };
    '60s': { tokens: number; cost: number; tps: number };
  };
  providerBreakdown: Record<string, { tokens: number; tps: number; cost: number }>;
  sparkline: number[];  // last 60 data points (1 per second)
  peakTps: number;
  peakCostPerSecond: number;
  sessionTotalTokens: number;
  sessionTotalCost: number;
  uptime: number;  // seconds since first token
}

interface TokenEvent {
  timestamp: number;
  tokens: number;
  cost: number;
  provider: string;
  model: string;
}

interface ActiveRequest {
  id: string;
  provider: string;
  model: string;
  startedAt: number;
}

// State thresholds (tokens per second)
const THRESHOLDS = {
  idle: 0,
  active: 1,
  high_load: 500,
  redline: 2000,
};

// Concurrent request threshold for REDLINE
const CONCURRENT_REDLINE = 3;

export class TokenTachometer {
  private events: TokenEvent[] = [];
  private activeRequests: Map<string, ActiveRequest> = new Map();
  private sparklineBuffer: number[] = [];
  private peakTps = 0;
  private peakCostPerSecond = 0;
  private sessionTotalTokens = 0;
  private sessionTotalCost = 0;
  private firstEventAt = 0;
  private lastSparklineTick = 0;
  private requestCounter = 0;
  private listeners: Array<(reading: TachometerReading) => void> = [];

  /**
   * Record tokens flowing through the system.
   * Called after every API request completes.
   */
  recordTokenFlow(provider: string, model: string, tokens: number, cost: number): void {
    const now = Date.now();
    if (this.firstEventAt === 0) this.firstEventAt = now;

    this.events.push({ timestamp: now, tokens, cost, provider, model });
    this.sessionTotalTokens += tokens;
    this.sessionTotalCost += cost;

    // Prune events older than 65 seconds (keep 60s window + buffer)
    const cutoff = now - 65_000;
    while (this.events.length > 0 && this.events[0].timestamp < cutoff) {
      this.events.shift();
    }

    // Update sparkline
    this.updateSparkline(now);

    // Update peaks
    const reading = this.getReading();
    if (reading.tokensPerSecond > this.peakTps) {
      this.peakTps = reading.tokensPerSecond;
    }
    if (reading.costPerSecond > this.peakCostPerSecond) {
      this.peakCostPerSecond = reading.costPerSecond;
    }

    // Notify listeners
    for (const listener of this.listeners) {
      try { listener(reading); } catch { /* ignore */ }
    }
  }

  /**
   * Mark a request as started (for concurrent request tracking).
   */
  startRequest(provider: string, model: string): string {
    const id = `req_${++this.requestCounter}_${Date.now()}`;
    this.activeRequests.set(id, {
      id,
      provider,
      model,
      startedAt: Date.now(),
    });
    return id;
  }

  /**
   * Mark a request as completed.
   */
  endRequest(requestId: string): void {
    this.activeRequests.delete(requestId);
  }

  /**
   * Subscribe to tachometer updates.
   */
  onUpdate(listener: (reading: TachometerReading) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Get the current tachometer reading.
   */
  getReading(): TachometerReading {
    const now = Date.now();
    this.updateSparkline(now);

    const windows = {
      '5s': this.computeWindow(now, 5_000),
      '15s': this.computeWindow(now, 15_000),
      '60s': this.computeWindow(now, 60_000),
    };

    // Current TPS is based on 5-second window for responsiveness
    const currentTps = windows['5s'].tps;
    const currentCps = windows['5s'].cost / 5;

    // Provider breakdown (60s window)
    const providerBreakdown: Record<string, { tokens: number; tps: number; cost: number }> = {};
    const cutoff60 = now - 60_000;
    for (const event of this.events) {
      if (event.timestamp < cutoff60) continue;
      if (!providerBreakdown[event.provider]) {
        providerBreakdown[event.provider] = { tokens: 0, tps: 0, cost: 0 };
      }
      providerBreakdown[event.provider].tokens += event.tokens;
      providerBreakdown[event.provider].cost += event.cost;
    }
    for (const key of Object.keys(providerBreakdown)) {
      providerBreakdown[key].tps = providerBreakdown[key].tokens / 60;
    }

    // Active providers (have events in last 15s)
    const cutoff15 = now - 15_000;
    const activeProviders = [...new Set(
      this.events
        .filter(e => e.timestamp >= cutoff15)
        .map(e => e.provider)
    )];

    // Determine state
    const concurrentRequests = this.activeRequests.size;
    let state: TachometerState = 'idle';
    if (concurrentRequests >= CONCURRENT_REDLINE || currentTps >= THRESHOLDS.redline) {
      state = 'redline';
    } else if (currentTps >= THRESHOLDS.high_load) {
      state = 'high_load';
    } else if (currentTps >= THRESHOLDS.active) {
      state = 'active';
    }

    const uptime = this.firstEventAt > 0 ? Math.floor((now - this.firstEventAt) / 1000) : 0;

    return {
      state,
      tokensPerSecond: Math.round(currentTps),
      costPerSecond: parseFloat(currentCps.toFixed(6)),
      activeProviders,
      concurrentRequests,
      windows,
      providerBreakdown,
      sparkline: [...this.sparklineBuffer],
      peakTps: this.peakTps,
      peakCostPerSecond: this.peakCostPerSecond,
      sessionTotalTokens: this.sessionTotalTokens,
      sessionTotalCost: parseFloat(this.sessionTotalCost.toFixed(6)),
      uptime,
    };
  }

  /**
   * Format tachometer as a visual markdown display.
   */
  formatDisplay(): string {
    const r = this.getReading();
    const lines: string[] = [];

    // State indicator with gauge visual
    const stateEmoji: Record<TachometerState, string> = {
      idle: '⚪',
      active: '🟢',
      high_load: '🟡',
      redline: '🔴',
    };

    const stateLabel: Record<TachometerState, string> = {
      idle: 'IDLE',
      active: 'ACTIVE',
      high_load: 'HIGH LOAD',
      redline: 'REDLINE',
    };

    lines.push(`# Token Tachometer ${stateEmoji[r.state]}`);
    lines.push('');

    // Gauge bar visualization
    const maxTps = Math.max(r.peakTps, THRESHOLDS.redline, r.tokensPerSecond);
    const fillPct = maxTps > 0 ? Math.min(100, (r.tokensPerSecond / maxTps) * 100) : 0;
    const filled = Math.round(fillPct / 5);
    const barChars = [];
    for (let i = 0; i < 20; i++) {
      if (i < filled) {
        if (i >= 16) barChars.push('🟥');
        else if (i >= 12) barChars.push('🟨');
        else barChars.push('🟩');
      } else {
        barChars.push('⬜');
      }
    }
    lines.push(`**${stateLabel[r.state]}** ${barChars.join('')}`);
    lines.push('');

    // Key metrics
    lines.push(`| Metric | Value |`);
    lines.push(`|---|---|`);
    lines.push(`| Tokens/sec | **${r.tokensPerSecond.toLocaleString()}** |`);
    lines.push(`| Cost/sec | **$${r.costPerSecond.toFixed(4)}** |`);
    lines.push(`| Concurrent requests | ${r.concurrentRequests} |`);
    lines.push(`| Active providers | ${r.activeProviders.join(', ') || 'none'} |`);
    lines.push(`| Peak TPS | ${Math.round(r.peakTps).toLocaleString()} |`);
    lines.push(`| Peak cost/sec | $${r.peakCostPerSecond.toFixed(4)} |`);
    lines.push(`| Session total tokens | ${r.sessionTotalTokens.toLocaleString()} |`);
    lines.push(`| Session total cost | $${r.sessionTotalCost.toFixed(4)} |`);
    lines.push(`| Uptime | ${this.formatUptime(r.uptime)} |`);
    lines.push('');

    // Windows
    lines.push('## Velocity Windows');
    lines.push('');
    lines.push('| Window | Tokens | TPS | Cost |');
    lines.push('|---|---|---|---|');
    lines.push(`| 5s | ${r.windows['5s'].tokens.toLocaleString()} | ${Math.round(r.windows['5s'].tps)} | $${r.windows['5s'].cost.toFixed(4)} |`);
    lines.push(`| 15s | ${r.windows['15s'].tokens.toLocaleString()} | ${Math.round(r.windows['15s'].tps)} | $${r.windows['15s'].cost.toFixed(4)} |`);
    lines.push(`| 60s | ${r.windows['60s'].tokens.toLocaleString()} | ${Math.round(r.windows['60s'].tps)} | $${r.windows['60s'].cost.toFixed(4)} |`);
    lines.push('');

    // Provider breakdown
    if (Object.keys(r.providerBreakdown).length > 0) {
      lines.push('## Provider Breakdown (60s)');
      lines.push('');
      lines.push('| Provider | Tokens | TPS | Cost |');
      lines.push('|---|---|---|---|');
      for (const [provider, data] of Object.entries(r.providerBreakdown)) {
        lines.push(`| ${provider} | ${data.tokens.toLocaleString()} | ${Math.round(data.tps)} | $${data.cost.toFixed(4)} |`);
      }
      lines.push('');
    }

    // Sparkline (ASCII)
    if (r.sparkline.length > 1) {
      lines.push('## Token Velocity (last 60s)');
      lines.push('');
      const max = Math.max(...r.sparkline, 1);
      const height = 8;
      const sparkRows: string[] = [];
      for (let row = height - 1; row >= 0; row--) {
        const threshold = (row / height) * max;
        let line = '';
        for (const val of r.sparkline) {
          line += val >= threshold ? '█' : ' ';
        }
        sparkRows.push(`│${line}│`);
      }
      lines.push('```');
      lines.push(`┌${'─'.repeat(r.sparkline.length)}┐`);
      for (const row of sparkRows) lines.push(row);
      lines.push(`└${'─'.repeat(r.sparkline.length)}┘`);
      lines.push(`  0${''.padStart(r.sparkline.length - 6)}60s  peak: ${Math.round(max)} tps`);
      lines.push('```');
    }

    return lines.join('\n');
  }

  private computeWindow(now: number, windowMs: number): { tokens: number; cost: number; tps: number } {
    const cutoff = now - windowMs;
    let tokens = 0;
    let cost = 0;
    for (const event of this.events) {
      if (event.timestamp >= cutoff) {
        tokens += event.tokens;
        cost += event.cost;
      }
    }
    const seconds = windowMs / 1000;
    return {
      tokens,
      cost: parseFloat(cost.toFixed(6)),
      tps: tokens / seconds,
    };
  }

  private updateSparkline(now: number): void {
    // One data point per second
    const currentSecond = Math.floor(now / 1000);
    if (this.lastSparklineTick === 0) {
      this.lastSparklineTick = currentSecond;
    }

    // Fill gaps with zeros
    while (this.lastSparklineTick < currentSecond) {
      this.lastSparklineTick++;
      const cutoff = this.lastSparklineTick * 1000 - 1000;
      const end = this.lastSparklineTick * 1000;
      let tps = 0;
      for (const event of this.events) {
        if (event.timestamp >= cutoff && event.timestamp < end) {
          tps += event.tokens;
        }
      }
      this.sparklineBuffer.push(Math.round(tps));
    }

    // Keep only last 60 data points
    while (this.sparklineBuffer.length > 60) {
      this.sparklineBuffer.shift();
    }
  }

  private formatUptime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }
}
