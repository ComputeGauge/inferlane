// ============================================================================
// RatingSync — Opt-in anonymous rating data sync to InferLane platform
//
// The network effect amplifier: when users opt in, their anonymous model
// ratings are periodically synced to the platform. The platform aggregates
// across ALL users, producing quality intelligence that no single user
// could generate alone.
//
// Privacy:
//   - agent_id is stripped (replaced with anonymous hash)
//   - Only model, taskType, rating, and timestamp are sent
//   - No prompt content, no user identifiers
//   - Opt-in only via INFERLANE_RATING_SYNC=true
//
// Sync triggers:
//   - Every SYNC_BATCH_SIZE new ratings (default: 25)
//   - On improvement_cycle
//   - On explicit sync_ratings tool call
//
// Requires INFERLANE_API_KEY for the upload endpoint.
// ============================================================================

import type { PlatformClient } from './platform-client.js';
import type { PersistenceLayer, PersistedRating } from './persistence.js';

export interface SyncStats {
  enabled: boolean;
  totalSynced: number;
  pendingCount: number;
  lastSyncAt: number | null;
  lastSyncResult: 'success' | 'failed' | 'none';
  lastError?: string;
}

interface AnonymousRating {
  model: string;
  taskType: string;
  rating: number;
  timestamp: string;
}

// Default batch size before auto-sync
const SYNC_BATCH_SIZE = 25;

export class RatingSync {
  private _enabled: boolean;
  private platformClient: PlatformClient | null;
  private persistence: PersistenceLayer;
  private totalSynced = 0;
  private pendingCount = 0;
  private lastSyncAt: number | null = null;
  private lastSyncResult: 'success' | 'failed' | 'none' = 'none';
  private lastError?: string;
  private lastSyncedId = 0;  // tracks the last synced rating ID from SQLite
  private syncing = false;

  constructor(
    platformClient: PlatformClient | null,
    persistence: PersistenceLayer,
  ) {
    this._enabled = process.env.INFERLANE_RATING_SYNC === 'true';
    this.platformClient = platformClient;
    this.persistence = persistence;

    if (this._enabled && !platformClient) {
      console.error('[InferLane RatingSync] INFERLANE_RATING_SYNC=true but no API key set. Sync disabled.');
      this._enabled = false;
    }

    if (this._enabled) {
      console.error('[InferLane RatingSync] Enabled — anonymous ratings will sync to platform');
    }
  }

  get enabled(): boolean {
    return this._enabled;
  }

  /**
   * Called after every accepted rating.
   * Increments pending count and triggers auto-sync if threshold reached.
   */
  onNewRating(): void {
    if (!this._enabled) return;
    this.pendingCount++;
    if (this.pendingCount >= SYNC_BATCH_SIZE) {
      // Fire and forget — don't block the tool response
      this.sync().catch(() => {});
    }
  }

  /**
   * Sync pending ratings to the platform.
   * Returns the number of ratings synced.
   */
  async sync(): Promise<number> {
    if (!this._enabled || !this.platformClient || this.syncing) return 0;
    if (!this.persistence.available) return 0;

    this.syncing = true;
    try {
      // Load unsynced ratings from SQLite
      const allRatings = this.persistence.loadRatings(undefined, 500);

      // Filter to ratings we haven't synced yet (by ID)
      const unsynced = allRatings.filter(r => (r.id ?? 0) > this.lastSyncedId);

      if (unsynced.length === 0) {
        this.pendingCount = 0;
        this.syncing = false;
        return 0;
      }

      // Anonymize
      const anonymized: AnonymousRating[] = unsynced.map(r => ({
        model: r.model,
        taskType: r.taskType,
        rating: r.rating,
        timestamp: r.createdAt || new Date().toISOString(),
      }));

      // Upload to platform
      await this.platformClient.syncRatings(anonymized);

      // Update tracking
      const maxId = Math.max(...unsynced.map(r => r.id ?? 0));
      this.lastSyncedId = maxId;
      this.totalSynced += anonymized.length;
      this.pendingCount = 0;
      this.lastSyncAt = Date.now();
      this.lastSyncResult = 'success';
      this.lastError = undefined;

      console.error(`[InferLane RatingSync] Synced ${anonymized.length} anonymous ratings to platform`);
      return anonymized.length;
    } catch (err) {
      this.lastSyncResult = 'failed';
      this.lastError = err instanceof Error ? err.message : String(err);
      console.error(`[InferLane RatingSync] Sync failed:`, this.lastError);
      this.syncing = false;
      return 0;
    } finally {
      this.syncing = false;
    }
  }

  /**
   * Get sync statistics.
   */
  getStats(): SyncStats {
    return {
      enabled: this._enabled,
      totalSynced: this.totalSynced,
      pendingCount: this.pendingCount,
      lastSyncAt: this.lastSyncAt,
      lastSyncResult: this.lastSyncResult,
      lastError: this.lastError,
    };
  }

  /**
   * Format stats as markdown.
   */
  formatDisplay(): string {
    const stats = this.getStats();
    const lines: string[] = [];

    lines.push('# Rating Sync Status');
    lines.push('');

    if (!stats.enabled) {
      lines.push('**Status**: Disabled');
      lines.push('');
      lines.push('To enable anonymous rating sync (improves `pick_model` for all users):');
      lines.push('```');
      lines.push('INFERLANE_RATING_SYNC=true');
      lines.push('```');
      lines.push('');
      lines.push('**Privacy**: Only model name, task type, and rating (1-5) are synced. No prompts, no user identifiers.');
      return lines.join('\n');
    }

    lines.push(`**Status**: ${stats.lastSyncResult === 'failed' ? '⚠️ Last sync failed' : '✅ Active'}`);
    lines.push(`**Total synced**: ${stats.totalSynced} ratings`);
    lines.push(`**Pending**: ${stats.pendingCount} ratings (auto-syncs at ${SYNC_BATCH_SIZE})`);

    if (stats.lastSyncAt) {
      const ago = Math.floor((Date.now() - stats.lastSyncAt) / 1000);
      lines.push(`**Last sync**: ${ago}s ago (${stats.lastSyncResult})`);
    } else {
      lines.push('**Last sync**: never');
    }

    if (stats.lastError) {
      lines.push(`**Last error**: ${stats.lastError}`);
    }

    lines.push('');
    lines.push('**Privacy**: Only model, task type, rating, and timestamp are synced. Agent IDs are stripped. No prompts or user identifiers.');

    return lines.join('\n');
  }
}
