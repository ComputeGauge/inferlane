// ============================================================================
// PersistenceLayer — SQLite persistence for InferLane MCP server
//
// Stores credibility scores, model ratings, request logs, and budget config
// so they survive MCP server restarts. Uses better-sqlite3 (synchronous,
// zero-config, perfect for single-process MCP servers).
//
// DESIGN: Fully optional. If SQLite fails to initialize (permissions, missing
// native binary, etc.), the server falls back to in-memory mode with a
// console.error warning. The MCP server must NEVER crash over persistence.
//
// DB location: ~/.inferlane/state.db
// ============================================================================

import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ============================================================================
// Types for persistence I/O
// ============================================================================

export interface PersistedCredibility {
  agentId: string;
  score: number;
  routingIntelligence: number;
  costEfficiency: number;
  taskSuccess: number;
  honestReporting: number;
  cloudRouting: number;
  qualityContribution: number;
  updatedAt: string;
}

export interface PersistedRating {
  id?: number;
  model: string;
  provider: string;
  taskType: string;
  rating: number;
  adjustedRating?: number;
  agentId?: string;
  createdAt?: string;
}

export interface PersistedRequestLog {
  id?: number;
  agentId?: string;
  sessionId?: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  taskType?: string;
  latencyMs?: number;
  success: boolean;
  createdAt?: string;
}

export interface PersistedBudget {
  monthlyLimit: number;
  alertThreshold: number;
  updatedAt?: string;
}

export interface PersistedLifecycleTransition {
  id?: number;
  agentId: string;
  fromPhase: string;
  toPhase: string;
  tokensDuringPhase: number;
  costDuringPhase: number;
  durationMs: number;
  createdAt?: string;
}

export interface SpendSummary {
  totalCost: number;
  requestCount: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
}

export interface AggregatedRating {
  model: string;
  provider: string;
  avgRating: number;
  totalRatings: number;
  taskTypes: string[];
}

// ============================================================================
// PersistenceLayer
// ============================================================================

export class PersistenceLayer {
  private db: Database.Database | null = null;
  private _available = false;

  constructor() {
    try {
      const dir = join(homedir(), '.inferlane');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const dbPath = join(dir, 'state.db');
      this.db = new Database(dbPath);

      // Enable WAL mode for better concurrent read performance
      this.db.pragma('journal_mode = WAL');

      this.createTables();
      this._available = true;
      console.error('[InferLane Persistence] SQLite initialized at', dbPath);
    } catch (err) {
      console.error(
        '[InferLane Persistence] SQLite initialization failed — running in-memory only.',
        err instanceof Error ? err.message : err
      );
      this.db = null;
      this._available = false;
    }
  }

  /** Whether SQLite persistence is active */
  get available(): boolean {
    return this._available;
  }

  // ==========================================================================
  // Schema
  // ==========================================================================

  private createTables(): void {
    if (!this.db) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        total_cost REAL NOT NULL DEFAULT 0,
        request_count INTEGER NOT NULL DEFAULT 0,
        data_json TEXT
      );

      CREATE TABLE IF NOT EXISTS credibility_scores (
        agent_id TEXT PRIMARY KEY,
        score REAL NOT NULL DEFAULT 0,
        routing_intelligence REAL NOT NULL DEFAULT 0,
        cost_efficiency REAL NOT NULL DEFAULT 0,
        task_success REAL NOT NULL DEFAULT 0,
        honest_reporting REAL NOT NULL DEFAULT 0,
        cloud_routing REAL NOT NULL DEFAULT 0,
        quality_contribution REAL NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS model_ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model TEXT NOT NULL,
        provider TEXT NOT NULL,
        task_type TEXT NOT NULL,
        rating INTEGER NOT NULL,
        adjusted_rating REAL,
        agent_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS request_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT,
        session_id TEXT,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cost REAL NOT NULL DEFAULT 0,
        task_type TEXT,
        latency_ms REAL,
        success INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS budget_config (
        id TEXT PRIMARY KEY DEFAULT 'default',
        monthly_limit REAL NOT NULL DEFAULT 0,
        alert_threshold REAL NOT NULL DEFAULT 0.8,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS lifecycle_transitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        from_phase TEXT NOT NULL,
        to_phase TEXT NOT NULL,
        tokens_during_phase INTEGER NOT NULL DEFAULT 0,
        cost_during_phase REAL NOT NULL DEFAULT 0,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_request_log_agent ON request_log(agent_id);
      CREATE INDEX IF NOT EXISTS idx_request_log_created ON request_log(created_at);
      CREATE INDEX IF NOT EXISTS idx_model_ratings_model ON model_ratings(model, provider);
      CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent ON agent_sessions(agent_id);
      CREATE INDEX IF NOT EXISTS idx_lifecycle_agent ON lifecycle_transitions(agent_id);
      CREATE INDEX IF NOT EXISTS idx_lifecycle_created ON lifecycle_transitions(created_at);
    `);
  }

  // ==========================================================================
  // Credibility
  // ==========================================================================

  saveCredibility(agentId: string, scores: Omit<PersistedCredibility, 'agentId' | 'updatedAt'>): void {
    if (!this.db) return;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO credibility_scores (agent_id, score, routing_intelligence, cost_efficiency, task_success, honest_reporting, cloud_routing, quality_contribution, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(agent_id) DO UPDATE SET
          score = excluded.score,
          routing_intelligence = excluded.routing_intelligence,
          cost_efficiency = excluded.cost_efficiency,
          task_success = excluded.task_success,
          honest_reporting = excluded.honest_reporting,
          cloud_routing = excluded.cloud_routing,
          quality_contribution = excluded.quality_contribution,
          updated_at = datetime('now')
      `);
      stmt.run(
        agentId,
        scores.score,
        scores.routingIntelligence,
        scores.costEfficiency,
        scores.taskSuccess,
        scores.honestReporting,
        scores.cloudRouting,
        scores.qualityContribution
      );
    } catch (err) {
      console.error('[InferLane Persistence] saveCredibility failed:', err instanceof Error ? err.message : err);
    }
  }

  loadCredibility(agentId: string): PersistedCredibility | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(`
        SELECT agent_id, score, routing_intelligence, cost_efficiency, task_success,
               honest_reporting, cloud_routing, quality_contribution, updated_at
        FROM credibility_scores WHERE agent_id = ?
      `);
      const row = stmt.get(agentId) as Record<string, unknown> | undefined;
      if (!row) return null;
      return {
        agentId: row.agent_id as string,
        score: row.score as number,
        routingIntelligence: row.routing_intelligence as number,
        costEfficiency: row.cost_efficiency as number,
        taskSuccess: row.task_success as number,
        honestReporting: row.honest_reporting as number,
        cloudRouting: row.cloud_routing as number,
        qualityContribution: row.quality_contribution as number,
        updatedAt: row.updated_at as string,
      };
    } catch (err) {
      console.error('[InferLane Persistence] loadCredibility failed:', err instanceof Error ? err.message : err);
      return null;
    }
  }

  // ==========================================================================
  // Model Ratings
  // ==========================================================================

  saveRating(rating: PersistedRating): void {
    if (!this.db) return;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO model_ratings (model, provider, task_type, rating, adjusted_rating, agent_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))
      `);
      stmt.run(
        rating.model,
        rating.provider,
        rating.taskType,
        rating.rating,
        rating.adjustedRating ?? null,
        rating.agentId ?? null,
        rating.createdAt ?? null
      );
    } catch (err) {
      console.error('[InferLane Persistence] saveRating failed:', err instanceof Error ? err.message : err);
    }
  }

  loadRatings(model?: string, limit = 100): PersistedRating[] {
    if (!this.db) return [];
    try {
      let sql = 'SELECT id, model, provider, task_type, rating, adjusted_rating, agent_id, created_at FROM model_ratings';
      const params: unknown[] = [];
      if (model) {
        sql += ' WHERE model = ?';
        params.push(model);
      }
      sql += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);

      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params) as Record<string, unknown>[];
      return rows.map(row => ({
        id: row.id as number,
        model: row.model as string,
        provider: row.provider as string,
        taskType: row.task_type as string,
        rating: row.rating as number,
        adjustedRating: row.adjusted_rating as number | undefined,
        agentId: row.agent_id as string | undefined,
        createdAt: row.created_at as string,
      }));
    } catch (err) {
      console.error('[InferLane Persistence] loadRatings failed:', err instanceof Error ? err.message : err);
      return [];
    }
  }

  getAggregatedRatings(): AggregatedRating[] {
    if (!this.db) return [];
    try {
      const stmt = this.db.prepare(`
        SELECT model, provider,
               AVG(COALESCE(adjusted_rating, rating)) AS avg_rating,
               COUNT(*) AS total_ratings,
               GROUP_CONCAT(DISTINCT task_type) AS task_types
        FROM model_ratings
        GROUP BY model, provider
        ORDER BY avg_rating DESC
      `);
      const rows = stmt.all() as Record<string, unknown>[];
      return rows.map(row => ({
        model: row.model as string,
        provider: row.provider as string,
        avgRating: row.avg_rating as number,
        totalRatings: row.total_ratings as number,
        taskTypes: ((row.task_types as string) || '').split(',').filter(Boolean),
      }));
    } catch (err) {
      console.error('[InferLane Persistence] getAggregatedRatings failed:', err instanceof Error ? err.message : err);
      return [];
    }
  }

  // ==========================================================================
  // Request Logging
  // ==========================================================================

  logRequest(entry: PersistedRequestLog): void {
    if (!this.db) return;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO request_log (agent_id, session_id, provider, model, input_tokens, output_tokens, cost, task_type, latency_ms, success, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))
      `);
      stmt.run(
        entry.agentId ?? null,
        entry.sessionId ?? null,
        entry.provider,
        entry.model,
        entry.inputTokens,
        entry.outputTokens,
        entry.cost,
        entry.taskType ?? null,
        entry.latencyMs ?? null,
        entry.success ? 1 : 0,
        entry.createdAt ?? null
      );
    } catch (err) {
      console.error('[InferLane Persistence] logRequest failed:', err instanceof Error ? err.message : err);
    }
  }

  getSpendSummary(agentId?: string, period?: string): SpendSummary {
    if (!this.db) return { totalCost: 0, requestCount: 0, byProvider: {}, byModel: {} };
    try {
      let dateFilter = '';
      if (period === 'today') {
        dateFilter = "AND created_at >= date('now')";
      } else if (period === 'week') {
        dateFilter = "AND created_at >= date('now', '-7 days')";
      } else if (period === 'month') {
        dateFilter = "AND created_at >= date('now', 'start of month')";
      } else if (period === 'quarter') {
        dateFilter = "AND created_at >= date('now', '-3 months')";
      }

      const agentFilter = agentId ? 'AND agent_id = ?' : '';
      const params: unknown[] = agentId ? [agentId] : [];

      // Total
      const totalStmt = this.db.prepare(
        `SELECT COALESCE(SUM(cost), 0) as total_cost, COUNT(*) as request_count FROM request_log WHERE 1=1 ${dateFilter} ${agentFilter}`
      );
      const totalRow = totalStmt.get(...params) as Record<string, unknown>;

      // By provider
      const providerStmt = this.db.prepare(
        `SELECT provider, SUM(cost) as total FROM request_log WHERE 1=1 ${dateFilter} ${agentFilter} GROUP BY provider`
      );
      const providerRows = providerStmt.all(...params) as Record<string, unknown>[];
      const byProvider: Record<string, number> = {};
      for (const row of providerRows) {
        byProvider[row.provider as string] = row.total as number;
      }

      // By model
      const modelStmt = this.db.prepare(
        `SELECT model, SUM(cost) as total FROM request_log WHERE 1=1 ${dateFilter} ${agentFilter} GROUP BY model`
      );
      const modelRows = modelStmt.all(...params) as Record<string, unknown>[];
      const byModel: Record<string, number> = {};
      for (const row of modelRows) {
        byModel[row.model as string] = row.total as number;
      }

      return {
        totalCost: totalRow.total_cost as number,
        requestCount: totalRow.request_count as number,
        byProvider,
        byModel,
      };
    } catch (err) {
      console.error('[InferLane Persistence] getSpendSummary failed:', err instanceof Error ? err.message : err);
      return { totalCost: 0, requestCount: 0, byProvider: {}, byModel: {} };
    }
  }

  // ==========================================================================
  // Budget
  // ==========================================================================

  saveBudget(config: PersistedBudget): void {
    if (!this.db) return;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO budget_config (id, monthly_limit, alert_threshold, updated_at)
        VALUES ('default', ?, ?, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          monthly_limit = excluded.monthly_limit,
          alert_threshold = excluded.alert_threshold,
          updated_at = datetime('now')
      `);
      stmt.run(config.monthlyLimit, config.alertThreshold);
    } catch (err) {
      console.error('[InferLane Persistence] saveBudget failed:', err instanceof Error ? err.message : err);
    }
  }

  loadBudget(): PersistedBudget | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(
        `SELECT monthly_limit, alert_threshold, updated_at FROM budget_config WHERE id = 'default'`
      );
      const row = stmt.get() as Record<string, unknown> | undefined;
      if (!row) return null;
      return {
        monthlyLimit: row.monthly_limit as number,
        alertThreshold: row.alert_threshold as number,
        updatedAt: row.updated_at as string,
      };
    } catch (err) {
      console.error('[InferLane Persistence] loadBudget failed:', err instanceof Error ? err.message : err);
      return null;
    }
  }

  getCurrentMonthSpend(agentId?: string): number {
    if (!this.db) return 0;
    try {
      let sql = `SELECT COALESCE(SUM(cost), 0) as total FROM request_log WHERE created_at >= date('now', 'start of month')`;
      const params: unknown[] = [];
      if (agentId) {
        sql += ' AND agent_id = ?';
        params.push(agentId);
      }
      const stmt = this.db.prepare(sql);
      const row = stmt.get(...params) as Record<string, unknown>;
      return row.total as number;
    } catch (err) {
      console.error('[InferLane Persistence] getCurrentMonthSpend failed:', err instanceof Error ? err.message : err);
      return 0;
    }
  }

  // ==========================================================================
  // Lifecycle Transitions (Stream AG)
  // ==========================================================================

  saveLifecycleTransition(transition: PersistedLifecycleTransition): void {
    if (!this.db) return;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO lifecycle_transitions (agent_id, from_phase, to_phase, tokens_during_phase, cost_during_phase, duration_ms, created_at)
        VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))
      `);
      stmt.run(
        transition.agentId,
        transition.fromPhase,
        transition.toPhase,
        transition.tokensDuringPhase,
        transition.costDuringPhase,
        transition.durationMs,
        transition.createdAt ?? null
      );
    } catch (err) {
      console.error('[InferLane Persistence] saveLifecycleTransition failed:', err instanceof Error ? err.message : err);
    }
  }

  loadLifecycleTransitions(agentId?: string, limit = 500): PersistedLifecycleTransition[] {
    if (!this.db) return [];
    try {
      let sql = 'SELECT id, agent_id, from_phase, to_phase, tokens_during_phase, cost_during_phase, duration_ms, created_at FROM lifecycle_transitions';
      const params: unknown[] = [];
      if (agentId) {
        sql += ' WHERE agent_id = ?';
        params.push(agentId);
      }
      sql += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);

      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params) as Record<string, unknown>[];
      return rows.map(row => ({
        id: row.id as number,
        agentId: row.agent_id as string,
        fromPhase: row.from_phase as string,
        toPhase: row.to_phase as string,
        tokensDuringPhase: row.tokens_during_phase as number,
        costDuringPhase: row.cost_during_phase as number,
        durationMs: row.duration_ms as number,
        createdAt: row.created_at as string,
      })).reverse(); // reverse to get chronological order
    } catch (err) {
      console.error('[InferLane Persistence] loadLifecycleTransitions failed:', err instanceof Error ? err.message : err);
      return [];
    }
  }

  getLifecyclePhaseBreakdown(agentId?: string, period?: string): Record<string, { count: number; totalTokens: number; totalCost: number; totalDurationMs: number }> {
    if (!this.db) return {};
    try {
      let dateFilter = '';
      if (period === 'today') {
        dateFilter = "AND created_at >= date('now')";
      } else if (period === 'week') {
        dateFilter = "AND created_at >= date('now', '-7 days')";
      } else if (period === 'month') {
        dateFilter = "AND created_at >= date('now', 'start of month')";
      }

      const agentFilter = agentId ? 'AND agent_id = ?' : '';
      const params: unknown[] = agentId ? [agentId] : [];

      const stmt = this.db.prepare(`
        SELECT from_phase,
               COUNT(*) as count,
               COALESCE(SUM(tokens_during_phase), 0) as total_tokens,
               COALESCE(SUM(cost_during_phase), 0) as total_cost,
               COALESCE(SUM(duration_ms), 0) as total_duration_ms
        FROM lifecycle_transitions
        WHERE 1=1 ${dateFilter} ${agentFilter}
        GROUP BY from_phase
        ORDER BY total_cost DESC
      `);
      const rows = stmt.all(...params) as Record<string, unknown>[];

      const result: Record<string, { count: number; totalTokens: number; totalCost: number; totalDurationMs: number }> = {};
      for (const row of rows) {
        result[row.from_phase as string] = {
          count: row.count as number,
          totalTokens: row.total_tokens as number,
          totalCost: row.total_cost as number,
          totalDurationMs: row.total_duration_ms as number,
        };
      }
      return result;
    } catch (err) {
      console.error('[InferLane Persistence] getLifecyclePhaseBreakdown failed:', err instanceof Error ? err.message : err);
      return {};
    }
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  close(): void {
    if (this.db) {
      try {
        this.db.close();
        console.error('[InferLane Persistence] SQLite connection closed.');
      } catch (err) {
        console.error('[InferLane Persistence] Error closing SQLite:', err instanceof Error ? err.message : err);
      }
      this.db = null;
      this._available = false;
    }
  }
}
