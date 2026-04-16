// ============================================================================
// Fleet Session Aggregator
// ----------------------------------------------------------------------------
// Central library for recording events from managed agents (Anthropic Managed
// Agents, Claude Agent SDK, Goose, etc.) and rolling them up into a unified
// cost view per session, fleet, and user.
//
// Consumed by:
//   - /api/fleet/sessions/*     (REST API for agent runtimes)
//   - /api/fleet/events         (event ingestion)
//   - Agent SDK hook package    (@inferlane/agent-hooks)
//   - Dashboard SSE feed        (real-time fleet monitoring)
//
// Billing model (see https://platform.claude.com/docs/en/managed-agents/billing):
//   1. Token cost        — standard per-model Anthropic rates
//   2. Session runtime   — $0.08 per active session-hour (idle excluded)
//   3. Web search        — $10 per 1,000 searches
//
// This module is runtime-agnostic: the same aggregator serves Anthropic managed
// agents, Claude Agent SDK sessions, Goose runs, SwarmClaw fleets, etc. Each
// runtime posts its events — the math below is identical regardless of source.
// ============================================================================

import { prisma } from '@/lib/db';
import { findModelPrice } from '@/lib/pricing/model-prices';
import type { FleetEventType, FleetRuntime, FleetSessionStatus } from '@/generated/prisma/client';

// ---------------------------------------------------------------------------
// Managed Agent billing constants
// ---------------------------------------------------------------------------

/**
 * Cost per active session-hour for Anthropic Managed Agents.
 * Idle time (agent waiting on user input or tools) does NOT count.
 * Source: https://platform.claude.com/docs/en/managed-agents/billing
 */
export const MANAGED_AGENT_ACTIVE_RUNTIME_PER_HOUR_USD = 0.08;

/**
 * Cost per web_search tool call for Managed Agents: $10 per 1,000 searches.
 */
export const MANAGED_AGENT_WEB_SEARCH_PER_CALL_USD = 10 / 1000;

/**
 * Convert active runtime (milliseconds) to the runtime billing cost in USD.
 * Only Anthropic Managed Agents get billed this way — other runtimes pass 0.
 */
export function runtimeCostFromMs(runtime: FleetRuntime, activeRuntimeMs: number): number {
  if (runtime !== 'ANTHROPIC_MANAGED') return 0;
  const hours = activeRuntimeMs / (1000 * 60 * 60);
  return hours * MANAGED_AGENT_ACTIVE_RUNTIME_PER_HOUR_USD;
}

/**
 * Cost of N web searches for Managed Agents (0 for other runtimes — agent
 * SDK web_search is free, searches go through whatever backend the user
 * configured).
 */
export function webSearchCostFor(runtime: FleetRuntime, searchCount: number): number {
  if (runtime !== 'ANTHROPIC_MANAGED') return 0;
  return searchCount * MANAGED_AGENT_WEB_SEARCH_PER_CALL_USD;
}

// ---------------------------------------------------------------------------
// Session creation & lookup
// ---------------------------------------------------------------------------

export interface StartSessionInput {
  userId: string;
  fleetId?: string | null;
  runtime: FleetRuntime;
  externalId?: string | null;
  agentName?: string | null;
  agentVersion?: string | null;
  model?: string | null;
  title?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Start tracking a new fleet session. Idempotent on (userId, externalId) when
 * externalId is provided — if the same runtime posts the same session twice
 * (common during reconnects), we return the existing row instead of creating
 * a duplicate.
 */
export async function startSession(input: StartSessionInput) {
  if (input.externalId) {
    const existing = await prisma.fleetSession.findFirst({
      where: {
        userId: input.userId,
        externalId: input.externalId,
      },
    });
    if (existing) return existing;
  }

  return prisma.fleetSession.create({
    data: {
      userId: input.userId,
      fleetId: input.fleetId ?? null,
      runtime: input.runtime,
      externalId: input.externalId ?? null,
      agentName: input.agentName ?? null,
      agentVersion: input.agentVersion ?? null,
      model: input.model ?? null,
      title: input.title ?? null,
      metadata: (input.metadata as any) ?? undefined,
      status: 'RUNNING',
    },
  });
}

export async function endSession(sessionId: string, status: FleetSessionStatus = 'COMPLETED') {
  return prisma.fleetSession.update({
    where: { id: sessionId },
    data: { endedAt: new Date(), status },
  });
}

// ---------------------------------------------------------------------------
// Event recording
// ---------------------------------------------------------------------------

export interface RecordEventInput {
  sessionId: string;
  type: FleetEventType;
  payload?: Record<string, unknown>;
  /** Model for token-bearing events. Defaults to the session's primary model. */
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  /** Duration in ms of active work represented by this event (for runtime billing). */
  activeRuntimeMs?: number;
  /** Duration in ms of idle time represented by this event. */
  idleRuntimeMs?: number;
  /** For WEB_SEARCH events, how many searches this event represents. */
  webSearchCount?: number;
}

/**
 * Record a single event against a fleet session and atomically update the
 * session's rolled-up counters. All math (token cost, runtime cost, web
 * search cost) happens server-side so clients can't misreport totals.
 */
export async function recordEvent(input: RecordEventInput) {
  const session = await prisma.fleetSession.findUnique({ where: { id: input.sessionId } });
  if (!session) throw new Error(`Fleet session not found: ${input.sessionId}`);

  const model = input.model ?? session.model ?? 'claude-sonnet-4-5';
  const inp = input.inputTokens ?? 0;
  const out = input.outputTokens ?? 0;
  const cch = input.cachedTokens ?? 0;

  // Token cost (from shared pricing table)
  const price = findModelPrice(model);
  let tokenCostDelta = 0;
  if (price) {
    tokenCostDelta =
      (inp / 1_000_000) * price.inputPerMToken +
      (out / 1_000_000) * price.outputPerMToken +
      (cch / 1_000_000) * (price.inputPerMToken * 0.1); // cached reads ~10% of input
  }

  // Runtime cost (only for ANTHROPIC_MANAGED sessions)
  const runtimeCostDelta = runtimeCostFromMs(session.runtime, input.activeRuntimeMs ?? 0);

  // Web search cost
  const webSearchDelta = input.webSearchCount ?? 0;
  const webSearchCostDelta = webSearchCostFor(session.runtime, webSearchDelta);

  const totalCostDelta = tokenCostDelta + runtimeCostDelta + webSearchCostDelta;

  // Write the event row
  const event = await prisma.fleetEvent.create({
    data: {
      sessionId: input.sessionId,
      type: input.type,
      payload: (input.payload as any) ?? undefined,
      tokenDelta: inp + out + cch,
      costDeltaUsd: totalCostDelta,
    },
  });

  // Atomically bump the session rollups
  const toolIncrement = input.type === 'TOOL_USE' ? 1 : 0;
  const messageIncrement =
    input.type === 'AGENT_MESSAGE' || input.type === 'USER_MESSAGE' ? 1 : 0;

  await prisma.fleetSession.update({
    where: { id: input.sessionId },
    data: {
      inputTokens: { increment: inp },
      outputTokens: { increment: out },
      cachedTokens: { increment: cch },
      tokenCostUsd: { increment: tokenCostDelta },
      runtimeCostUsd: { increment: runtimeCostDelta },
      activeRuntimeMs: { increment: input.activeRuntimeMs ?? 0 },
      idleRuntimeMs: { increment: input.idleRuntimeMs ?? 0 },
      webSearchCount: { increment: webSearchDelta },
      webSearchCostUsd: { increment: webSearchCostDelta },
      toolCallCount: { increment: toolIncrement },
      messageCount: { increment: messageIncrement },
      // Auto-transition to IDLE/RUNNING based on status events
      status:
        input.type === 'STATUS_IDLE'
          ? 'IDLE'
          : input.type === 'STATUS_ACTIVE'
            ? 'RUNNING'
            : undefined,
    },
  });

  return event;
}

// ---------------------------------------------------------------------------
// Rollups & queries for dashboards
// ---------------------------------------------------------------------------

export interface SessionTotalCost {
  sessionId: string;
  tokenCostUsd: number;
  runtimeCostUsd: number;
  webSearchCostUsd: number;
  totalCostUsd: number;
  activeHours: number;
}

export async function getSessionTotalCost(sessionId: string): Promise<SessionTotalCost | null> {
  const s = await prisma.fleetSession.findUnique({ where: { id: sessionId } });
  if (!s) return null;
  const tokenCost = Number(s.tokenCostUsd);
  const runtimeCost = Number(s.runtimeCostUsd);
  const webSearchCost = Number(s.webSearchCostUsd);
  return {
    sessionId: s.id,
    tokenCostUsd: tokenCost,
    runtimeCostUsd: runtimeCost,
    webSearchCostUsd: webSearchCost,
    totalCostUsd: tokenCost + runtimeCost + webSearchCost,
    activeHours: s.activeRuntimeMs / (1000 * 60 * 60),
  };
}

export interface FleetSummary {
  sessionCount: number;
  activeSessionCount: number;
  tokenCostUsd: number;
  runtimeCostUsd: number;
  webSearchCostUsd: number;
  totalCostUsd: number;
  totalActiveHours: number;
  byRuntime: Record<string, { sessions: number; costUsd: number }>;
  byModel: Record<string, { sessions: number; tokens: number; costUsd: number }>;
}

/**
 * Summarize a fleet over a time window. If fleetId is omitted, summarizes
 * across all of the user's sessions (whether they belong to a Fleet or not).
 */
export async function summarizeFleet(params: {
  userId: string;
  fleetId?: string;
  since?: Date;
}): Promise<FleetSummary> {
  const where: Record<string, unknown> = { userId: params.userId };
  if (params.fleetId) where.fleetId = params.fleetId;
  if (params.since) where.startedAt = { gte: params.since };

  const sessions = await prisma.fleetSession.findMany({ where });

  let tokenCost = 0;
  let runtimeCost = 0;
  let webSearchCost = 0;
  let totalActiveMs = 0;
  let active = 0;

  const byRuntime: FleetSummary['byRuntime'] = {};
  const byModel: FleetSummary['byModel'] = {};

  for (const s of sessions) {
    const tc = Number(s.tokenCostUsd);
    const rc = Number(s.runtimeCostUsd);
    const wc = Number(s.webSearchCostUsd);
    tokenCost += tc;
    runtimeCost += rc;
    webSearchCost += wc;
    totalActiveMs += s.activeRuntimeMs;
    if (s.status === 'RUNNING' || s.status === 'IDLE') active += 1;

    const rKey = String(s.runtime);
    byRuntime[rKey] ??= { sessions: 0, costUsd: 0 };
    byRuntime[rKey].sessions += 1;
    byRuntime[rKey].costUsd += tc + rc + wc;

    const mKey = s.model ?? 'unknown';
    byModel[mKey] ??= { sessions: 0, tokens: 0, costUsd: 0 };
    byModel[mKey].sessions += 1;
    byModel[mKey].tokens += s.inputTokens + s.outputTokens + s.cachedTokens;
    byModel[mKey].costUsd += tc;
  }

  return {
    sessionCount: sessions.length,
    activeSessionCount: active,
    tokenCostUsd: tokenCost,
    runtimeCostUsd: runtimeCost,
    webSearchCostUsd: webSearchCost,
    totalCostUsd: tokenCost + runtimeCost + webSearchCost,
    totalActiveHours: totalActiveMs / (1000 * 60 * 60),
    byRuntime,
    byModel,
  };
}

/**
 * Recent sessions for dashboard listing. Sorted by most recent activity.
 */
export async function listRecentSessions(params: {
  userId: string;
  fleetId?: string;
  limit?: number;
  status?: FleetSessionStatus;
}) {
  return prisma.fleetSession.findMany({
    where: {
      userId: params.userId,
      ...(params.fleetId ? { fleetId: params.fleetId } : {}),
      ...(params.status ? { status: params.status } : {}),
    },
    orderBy: { startedAt: 'desc' },
    take: params.limit ?? 50,
  });
}

/**
 * Detect budget breach: returns null if within budget, or a breach descriptor.
 * Run after each event on a fleet-linked session to trigger alerts.
 */
export async function checkFleetBudget(fleetId: string) {
  const fleet = await prisma.fleet.findUnique({
    where: { id: fleetId },
    include: { sessions: true },
  });
  if (!fleet || !fleet.monthlyBudgetUsd) return null;

  const budget = Number(fleet.monthlyBudgetUsd);
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);

  const summary = await summarizeFleet({ userId: fleet.userId, fleetId, since: monthAgo });
  const used = summary.totalCostUsd;
  const pct = budget > 0 ? used / budget : 0;
  const threshold = fleet.alertThreshold ?? 0.8;

  if (pct >= 1) return { level: 'exceeded', usedUsd: used, budgetUsd: budget, pct };
  if (pct >= threshold) return { level: 'warning', usedUsd: used, budgetUsd: budget, pct };
  return null;
}
