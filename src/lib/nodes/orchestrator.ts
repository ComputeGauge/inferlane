// ---------------------------------------------------------------------------
// Elastic Capacity Orchestrator (Stream T — Compute Allocation)
// ---------------------------------------------------------------------------
// Allocates idle OpenClaw decentralised rigs to ad-hoc tasks and spins them
// up for extra compute/decode capacity as demand requires.
//
// Core responsibilities:
//   1. Discover idle nodes with spare capacity
//   2. Match idle nodes to queued scheduled prompts
//   3. Absorb overflow when centralised providers are rate-limited
//   4. Pre-warm nodes for upcoming scheduled work
//   5. Soft-reserve nodes for imminent jobs
//   6. Report network capacity snapshot
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db';
import { REPUTATION_CONFIG } from './reliability';
import { dispatchToNode } from './dispatch';
import { callNode } from './dispatch';
import { getModelTier } from '@/lib/proxy/model-equivalence';
import { workClaimer, WorkClaimer } from './work-claimer';

// ── Types ────────────────────────────────────────────────────────────────

interface IdleNode {
  id: string;
  reputationScore: number;
  avgLatencyMs: number;
  maxConcurrent: number;
  activeRequests: number;
  idleSlots: number;
  apiEndpoint: string;
  regions: string[];
  capabilities: Record<string, unknown>;
  memoryProfile: {
    nodeRole: string;
    decodeThroughputTps: number;
    prefillThroughputTps: number;
    memoryBandwidthGBs: number;
  } | null;
}

interface AllocationResult {
  promptId: string;
  nodeId: string;
  dispatched: boolean;
  error?: string;
}

interface CapacitySnapshot {
  totalNodes: number;
  onlineNodes: number;
  idleNodes: number;
  reservedNodes: number;
  totalDecodeCapacityTps: number;
  totalPrefillCapacityTps: number;
  utilizationPercent: number;
  timestamp: string;
}

interface Reservation {
  until: number;
  reason: string;
}

interface WarmModel {
  nodeId: string;
  model: string;
  warmedAt: number;
}

// ── Orchestrator ─────────────────────────────────────────────────────────

class CapacityOrchestrator {
  /** Soft reservations — prevents double-allocation during a time window */
  private reservations = new Map<string, Reservation>();

  /** Tracks which nodes have which models warm in memory */
  private warmModels: WarmModel[] = [];

  /** In-flight request count per nodeId */
  private activeRequests = new Map<string, number>();

  /** Increment active request count when dispatching to a node */
  incrementActive(nodeId: string): void {
    const current = this.activeRequests.get(nodeId) ?? 0;
    this.activeRequests.set(nodeId, current + 1);
  }

  /** Decrement active request count when a node response completes */
  decrementActive(nodeId: string): void {
    const current = this.activeRequests.get(nodeId) ?? 0;
    this.activeRequests.set(nodeId, Math.max(0, current - 1));
  }

  // ── 1. Get Idle Nodes ──────────────────────────────────────────────────

  /**
   * Find nodes that are online, healthy (reputation >= 30), and have spare
   * capacity (active requests < maxConcurrent).
   *
   * Uses lastSeenAt recency to exclude stale nodes and filters out
   * soft-reserved nodes.
   */
  async getIdleNodes(): Promise<IdleNode[]> {
    const now = Date.now();

    // Clean expired reservations
    this.cleanExpiredReservations();

    const heartbeatCutoff = new Date(
      now - REPUTATION_CONFIG.heartbeatMaxAgeSeconds * 1000,
    );

    const nodes = await prisma.nodeOperator.findMany({
      where: {
        isOnline: true,
        reputationScore: { gte: REPUTATION_CONFIG.minReputationForDispatch },
        lastSeenAt: { gte: heartbeatCutoff },
        apiEndpoint: { not: null },
      },
      select: {
        id: true,
        reputationScore: true,
        avgLatencyMs: true,
        maxConcurrent: true,
        apiEndpoint: true,
        regions: true,
        capabilities: true,
        memoryProfile: {
          select: {
            nodeRole: true,
            decodeThroughputTps: true,
            prefillThroughputTps: true,
            memoryBandwidthGBs: true,
          },
        },
      },
    });

    // Count active (in-progress) requests per node from recent dispatch logs
    // We approximate by counting RUNNING scheduled prompts assigned to nodes
    // For now, treat all online healthy nodes as having capacity
    const idleNodes: IdleNode[] = [];

    for (const node of nodes) {
      // Skip reserved nodes
      if (this.reservations.has(node.id)) continue;

      const activeRequests = this.activeRequests.get(node.id) ?? 0;
      const idleSlots = node.maxConcurrent - activeRequests;

      if (idleSlots > 0) {
        idleNodes.push({
          id: node.id,
          reputationScore: node.reputationScore,
          avgLatencyMs: node.avgLatencyMs,
          maxConcurrent: node.maxConcurrent,
          activeRequests,
          idleSlots,
          apiEndpoint: node.apiEndpoint!,
          regions: node.regions,
          capabilities: (node.capabilities as Record<string, unknown>) ?? {},
          memoryProfile: node.memoryProfile
            ? {
                nodeRole: node.memoryProfile.nodeRole,
                decodeThroughputTps: Number(node.memoryProfile.decodeThroughputTps),
                prefillThroughputTps: Number(node.memoryProfile.prefillThroughputTps),
                memoryBandwidthGBs: node.memoryProfile.memoryBandwidthGBs,
              }
            : null,
        });
      }
    }

    return idleNodes;
  }

  // ── 2. Allocate to Scheduled Work ──────────────────────────────────────

  /**
   * Match idle nodes to queued/scheduled prompts that haven't been assigned
   * a preferred provider yet.
   *
   * Prefers decode-optimised nodes for high-output prompts and
   * prefill-optimised nodes for high-input prompts.
   */
  async allocateToScheduledWork(): Promise<AllocationResult[]> {
    const results: AllocationResult[] = [];

    // Find queued prompts not yet assigned
    const queuedPrompts = await prisma.scheduledPrompt.findMany({
      where: {
        status: { in: ['QUEUED', 'SCHEDULED'] },
        scheduleType: 'IMMEDIATE',
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      take: 50, // process in batches
    });

    if (queuedPrompts.length === 0) {
      return results;
    }

    const idleNodes = await this.getIdleNodes();
    if (idleNodes.length === 0) {
      return results;
    }

    // Track which nodes we've allocated in this pass
    const allocatedNodeSlots = new Map<string, number>();

    for (const prompt of queuedPrompts) {
      // Estimate prompt characteristics from parameters
      const params = (prompt.parameters as Record<string, unknown>) ?? {};
      const maxTokens = (params.max_tokens as number) ?? 1024;
      const messages = prompt.messages as unknown[];
      const estimatedInputLength = JSON.stringify(messages).length;
      const isHighOutput = maxTokens > 2048;
      const isHighInput = estimatedInputLength > 16000; // ~4K tokens

      // Find best matching node
      const bestNode = this.selectNodeForPrompt(
        idleNodes,
        allocatedNodeSlots,
        isHighOutput,
        isHighInput,
        prompt.model,
      );

      if (!bestNode) continue;

      // ── Work claiming: prevent duplicate computation ──
      const promptText = JSON.stringify(messages);
      const requestHash = WorkClaimer.hashRequest(promptText, prompt.model, params);
      const claimCheck = workClaimer.isClaimed(requestHash);
      if (claimCheck.claimed) {
        // Already claimed/completed by another node — skip
        results.push({
          promptId: prompt.id,
          nodeId: claimCheck.byNode ?? 'unknown',
          dispatched: false,
          error: claimCheck.result
            ? 'Already completed by another node'
            : 'Already claimed by another node',
        });
        continue;
      }

      const claim = workClaimer.tryClaim(bestNode.id, requestHash);
      if (!claim) {
        // Race condition — claimed between check and tryClaim
        continue;
      }

      // Track allocation
      const used = allocatedNodeSlots.get(bestNode.id) ?? 0;
      allocatedNodeSlots.set(bestNode.id, used + 1);

      // Dispatch immediately — track active requests
      this.incrementActive(bestNode.id);
      try {
        const result = await dispatchToNode({
          userId: prompt.userId,
          model: prompt.model,
          prompt: '', // messages-based dispatch
          messages: messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
          maxTokens,
        });

        if (result.success) {
          // Update prompt status
          await prisma.scheduledPrompt.update({
            where: { id: prompt.id },
            data: {
              status: 'COMPLETED',
              executedAt: new Date(),
              response: result.response,
              costCents: result.actualCostUsd * 100,
              tokensUsed: {
                nodeId: result.nodeId,
                latencyMs: result.latencyMs,
                phaseBreakdown: result.phaseBreakdown,
              },
            },
          });

          // Mark the work claim as completed with the result
          workClaimer.completeClaim(claim.claimId, result.response);

          results.push({
            promptId: prompt.id,
            nodeId: bestNode.id,
            dispatched: true,
          });
        } else {
          results.push({
            promptId: prompt.id,
            nodeId: bestNode.id,
            dispatched: false,
            error: result.error,
          });
        }
      } catch (err) {
        results.push({
          promptId: prompt.id,
          nodeId: bestNode.id,
          dispatched: false,
          error: err instanceof Error ? err.message : 'Dispatch failed',
        });
      } finally {
        this.decrementActive(bestNode.id);
      }
    }

    return results;
  }

  /**
   * Select the best idle node for a prompt based on its characteristics.
   */
  private selectNodeForPrompt(
    idleNodes: IdleNode[],
    allocatedSlots: Map<string, number>,
    isHighOutput: boolean,
    isHighInput: boolean,
    model: string,
  ): IdleNode | null {
    const tier = getModelTier(model);

    const available = idleNodes.filter((node) => {
      const used = allocatedSlots.get(node.id) ?? 0;
      return used < node.idleSlots;
    });

    if (available.length === 0) return null;

    // Score nodes based on prompt requirements
    const scored = available.map((node) => {
      let score = node.reputationScore;

      // Prefer decode-optimised for high-output prompts
      if (isHighOutput && node.memoryProfile) {
        if (node.memoryProfile.nodeRole === 'DECODE_OPTIMISED') score += 20;
        if (node.memoryProfile.nodeRole === 'HYBRID') score += 5;
        // Bonus for high decode throughput
        score += Math.min(10, node.memoryProfile.decodeThroughputTps / 10);
      }

      // Prefer prefill-optimised for high-input prompts
      if (isHighInput && node.memoryProfile) {
        if (node.memoryProfile.nodeRole === 'PREFILL_OPTIMISED') score += 20;
        if (node.memoryProfile.nodeRole === 'HYBRID') score += 5;
        score += Math.min(10, node.memoryProfile.prefillThroughputTps / 10);
      }

      // Prefer nodes that already have the model warm
      const isWarm = this.warmModels.some(
        (w) => w.nodeId === node.id && w.model === model,
      );
      if (isWarm) score += 15;

      // Latency penalty
      score -= node.avgLatencyMs / 200;

      return { node, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.node ?? null;
  }

  // ── 3. Absorb Overflow ─────────────────────────────────────────────────

  /**
   * When a centralised provider is rate-limited (in cooldown from the
   * health tracker), find idle nodes capable of the requested model tier.
   *
   * Returns available nodes sorted by reputation + latency.
   * Called by the auto-router when a provider is unhealthy.
   */
  async absorbOverflow(
    provider: string,
    model?: string,
    requestHash?: string,
  ): Promise<IdleNode[]> {
    // If a request hash is provided, check if the work is already claimed
    if (requestHash) {
      const claimCheck = workClaimer.isClaimed(requestHash);
      if (claimCheck.claimed) {
        // Work already claimed — no overflow nodes needed
        return [];
      }
    }

    const idleNodes = await this.getIdleNodes();
    if (idleNodes.length === 0) return [];

    const tier = model ? getModelTier(model) : null;

    // Filter to nodes that can handle the model tier
    // For now, all online healthy nodes are considered capable
    // In future: match node.capabilities to specific model requirements
    const capable = idleNodes.filter((node) => {
      // If we know the tier, check capabilities
      if (tier && node.capabilities) {
        const supportedModels = node.capabilities.models;
        if (Array.isArray(supportedModels) && supportedModels.length > 0) {
          // Node explicitly lists supported models — check for tier match
          const supportsTier = supportedModels.some((m: string) => {
            const nodeTier = getModelTier(m);
            return nodeTier === tier;
          });
          if (!supportsTier) return false;
        }
        // If no explicit model list, assume the node handles any model
      }
      return true;
    });

    // Sort by composite score: reputation * 2 - latency/100
    return capable.sort((a, b) => {
      const aScore = a.reputationScore * 2 - a.avgLatencyMs / 100;
      const bScore = b.reputationScore * 2 - b.avgLatencyMs / 100;
      return bScore - aScore;
    });
  }

  // ── 4. Pre-Warm Nodes ──────────────────────────────────────────────────

  /**
   * Look at scheduled prompts due in the next 15 minutes, identify which
   * models they need, and send lightweight warm-up requests to idle nodes
   * to load models into memory.
   */
  async preWarmNodes(
    upcomingJobs?: Array<{ id: string; model: string; scheduledAt: Date | null }>,
  ): Promise<{ warmed: number; errors: number }> {
    let jobs = upcomingJobs;

    if (!jobs) {
      const windowEnd = new Date(Date.now() + 15 * 60 * 1000);
      const upcoming = await prisma.scheduledPrompt.findMany({
        where: {
          status: { in: ['QUEUED', 'SCHEDULED'] },
          scheduledAt: { lte: windowEnd },
        },
        select: { id: true, model: true, scheduledAt: true },
      });
      jobs = upcoming;
    }

    if (jobs.length === 0) return { warmed: 0, errors: 0 };

    // Identify unique models needed
    const modelsNeeded = [...new Set(jobs.map((j) => j.model))];

    // Find which models are already warm on which nodes
    const now = Date.now();
    const WARM_TTL_MS = 10 * 60 * 1000; // models stay warm ~10 minutes
    this.warmModels = this.warmModels.filter(
      (w) => now - w.warmedAt < WARM_TTL_MS,
    );

    const idleNodes = await this.getIdleNodes();
    let warmed = 0;
    let errors = 0;

    for (const model of modelsNeeded) {
      // Skip if already warm on any node
      const alreadyWarm = this.warmModels.some((w) => w.model === model);
      if (alreadyWarm) continue;

      // Pick the best idle node for warming
      const node = idleNodes[0];
      if (!node) break;

      try {
        // Send a tiny prompt to force model load
        await callNode(node.apiEndpoint, {
          userId: 'system',
          model,
          prompt: 'warmup',
          messages: [{ role: 'user', content: 'Hi' }],
          maxTokens: 1,
        });

        this.warmModels.push({
          nodeId: node.id,
          model,
          warmedAt: Date.now(),
        });
        warmed++;
      } catch {
        errors++;
      }
    }

    return { warmed, errors };
  }

  // ── 5. Reserve Capacity ────────────────────────────────────────────────

  /**
   * Soft-reserve a node for upcoming work. Prevents other allocations from
   * using it during the window. Auto-expires after durationMs.
   */
  reserveCapacity(
    nodeId: string,
    durationMs: number,
    reason: string,
  ): void {
    this.reservations.set(nodeId, {
      until: Date.now() + durationMs,
      reason,
    });
  }

  /**
   * Release a reservation early.
   */
  releaseReservation(nodeId: string): void {
    this.reservations.delete(nodeId);
  }

  /**
   * Remove expired reservations.
   */
  private cleanExpiredReservations(): void {
    const now = Date.now();
    for (const [nodeId, res] of this.reservations) {
      if (res.until <= now) {
        this.reservations.delete(nodeId);
      }
    }
  }

  // ── 6. Capacity Snapshot ───────────────────────────────────────────────

  /**
   * Returns current network state: total/online/idle/reserved nodes,
   * aggregate decode and prefill capacity, and utilisation percentage.
   */
  async getCapacitySnapshot(): Promise<CapacitySnapshot> {
    this.cleanExpiredReservations();

    const heartbeatCutoff = new Date(
      Date.now() - REPUTATION_CONFIG.heartbeatMaxAgeSeconds * 1000,
    );

    const [totalCount, onlineNodes] = await Promise.all([
      prisma.nodeOperator.count(),
      prisma.nodeOperator.findMany({
        where: {
          isOnline: true,
          lastSeenAt: { gte: heartbeatCutoff },
        },
        select: {
          id: true,
          maxConcurrent: true,
          memoryProfile: {
            select: {
              decodeThroughputTps: true,
              prefillThroughputTps: true,
            },
          },
        },
      }),
    ]);

    const reservedCount = this.reservations.size;

    // Calculate idle count (online minus reserved)
    const onlineIds = new Set(onlineNodes.map((n) => n.id));
    let idleCount = 0;
    for (const node of onlineNodes) {
      if (!this.reservations.has(node.id)) {
        idleCount++;
      }
    }

    // Aggregate throughput capacity
    let totalDecodeCapacityTps = 0;
    let totalPrefillCapacityTps = 0;
    for (const node of onlineNodes) {
      if (node.memoryProfile) {
        totalDecodeCapacityTps += Number(node.memoryProfile.decodeThroughputTps);
        totalPrefillCapacityTps += Number(node.memoryProfile.prefillThroughputTps);
      }
    }

    // Utilisation: (online - idle) / online
    const onlineCount = onlineNodes.length;
    const busyCount = onlineCount - idleCount;
    const utilizationPercent =
      onlineCount > 0 ? Math.round((busyCount / onlineCount) * 100) : 0;

    return {
      totalNodes: totalCount,
      onlineNodes: onlineCount,
      idleNodes: idleCount,
      reservedNodes: reservedCount,
      totalDecodeCapacityTps,
      totalPrefillCapacityTps,
      utilizationPercent,
      timestamp: new Date().toISOString(),
    };
  }
}

// ── Singleton ────────────────────────────────────────────────────────────

export const capacityOrchestrator = new CapacityOrchestrator();
