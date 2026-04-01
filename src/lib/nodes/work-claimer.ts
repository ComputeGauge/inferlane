// ---------------------------------------------------------------------------
// Work Claiming System for OpenClaw Nodes
// ---------------------------------------------------------------------------
// Prevents duplicate computation via semantic hashing + TTL.
// When a node picks up work, it "claims" it so no other node processes the
// same request concurrently. Claims expire after a configurable TTL (default
// 5 minutes) to handle node failures gracefully.
// ---------------------------------------------------------------------------

import { createHash, randomUUID } from 'crypto';

// ── Types ────────────────────────────────────────────────────────────────

export interface WorkClaim {
  claimId: string;
  nodeId: string;
  requestHash: string;
  claimedAt: Date;
  expiresAt: Date;
  status: 'claimed' | 'completed' | 'expired';
  result?: unknown;
}

export interface ClaimCheckResult {
  claimed: boolean;
  byNode?: string;
  result?: unknown;
}

// ── Constants ────────────────────────────────────────────────────────────

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const EVICTION_INTERVAL_MS = 60 * 1000; // run eviction every 60 seconds

// ── WorkClaimer ──────────────────────────────────────────────────────────

export class WorkClaimer {
  private claims = new Map<string, WorkClaim>();
  private evictionTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Periodically evict expired claims
    this.evictionTimer = setInterval(() => {
      this.evictExpired();
    }, EVICTION_INTERVAL_MS);

    // Allow the process to exit even if the timer is running
    if (this.evictionTimer && typeof this.evictionTimer === 'object' && 'unref' in this.evictionTimer) {
      this.evictionTimer.unref();
    }
  }

  /**
   * Try to claim work identified by `requestHash` for `nodeId`.
   * Returns the WorkClaim if successfully claimed, or null if the work
   * is already claimed by another node (and not yet expired/completed).
   */
  tryClaim(
    nodeId: string,
    requestHash: string,
    ttlMs: number = DEFAULT_TTL_MS,
  ): WorkClaim | null {
    // Check for existing active claim
    const existing = this.claims.get(requestHash);
    if (existing) {
      const now = new Date();

      // If expired, evict and allow re-claim
      if (existing.expiresAt <= now) {
        existing.status = 'expired';
        this.claims.delete(requestHash);
      } else if (existing.status === 'claimed') {
        // Still actively claimed by another node
        return null;
      } else if (existing.status === 'completed') {
        // Already completed — caller can check isClaimed() for the result
        return null;
      }
    }

    const now = new Date();
    const claim: WorkClaim = {
      claimId: randomUUID(),
      nodeId,
      requestHash,
      claimedAt: now,
      expiresAt: new Date(now.getTime() + ttlMs),
      status: 'claimed',
    };

    this.claims.set(requestHash, claim);
    return claim;
  }

  /**
   * Mark a claim as completed with its result.
   * The completed claim stays in the map so subsequent checks for the same
   * request hash can return the cached result (until evicted).
   */
  completeClaim(claimId: string, result: unknown): void {
    for (const [, claim] of this.claims) {
      if (claim.claimId === claimId) {
        claim.status = 'completed';
        claim.result = result;
        return;
      }
    }
  }

  /**
   * Check if work identified by `requestHash` is already claimed or completed.
   */
  isClaimed(requestHash: string): ClaimCheckResult {
    const claim = this.claims.get(requestHash);
    if (!claim) {
      return { claimed: false };
    }

    const now = new Date();

    // Expired claims are treated as unclaimed
    if (claim.expiresAt <= now && claim.status === 'claimed') {
      claim.status = 'expired';
      this.claims.delete(requestHash);
      return { claimed: false };
    }

    return {
      claimed: true,
      byNode: claim.nodeId,
      result: claim.status === 'completed' ? claim.result : undefined,
    };
  }

  /**
   * Evict all expired claims. Returns the number of claims evicted.
   * Called automatically on a timer but can also be invoked manually.
   */
  evictExpired(): number {
    const now = new Date();
    let evicted = 0;

    for (const [hash, claim] of this.claims) {
      if (claim.expiresAt <= now) {
        if (claim.status !== 'completed') {
          claim.status = 'expired';
        }
        this.claims.delete(hash);
        evicted++;
      }
    }

    return evicted;
  }

  /**
   * Hash a request for deduplication.
   * Combines prompt text, model name, and optional parameters into a
   * deterministic SHA-256 hash.
   */
  static hashRequest(
    prompt: string,
    model: string,
    params?: Record<string, unknown>,
  ): string {
    const payload = JSON.stringify({
      prompt,
      model,
      ...(params ? { params } : {}),
    });
    return createHash('sha256').update(payload).digest('hex');
  }

  /** Expose claim count for monitoring/testing */
  get size(): number {
    return this.claims.size;
  }
}

// ── Singleton export ─────────────────────────────────────────────────────

export const workClaimer = new WorkClaimer();
