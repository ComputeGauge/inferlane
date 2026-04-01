// ---------------------------------------------------------------------------
// Prompt-Aware Scheduler (PARS) — Shortest-Job-First via output prediction
// ---------------------------------------------------------------------------
// Predicts response length from prompt characteristics and schedules queued
// prompts in SJF order so short requests don't get stuck behind long ones.
// ---------------------------------------------------------------------------

// ── Types ─────────────────────────────────────────────────────────────────

export interface PredictedWorkload {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedTotalTokens: number;
  estimatedLatencyMs: number;
  priority: number; // lower = higher priority (SJF)
  complexity: 'trivial' | 'short' | 'medium' | 'long' | 'very_long';
}

export interface QueueItem {
  id: string;
  prompt: string;
  model?: string;
  queuedAt: Date;
  isPremium?: boolean;
  deadline?: Date;
  estimatedTokens?: number;
  estimatedLatencyMs?: number;
  priority?: number;
  [key: string]: unknown;
}

// ── Decode speed lookup (tokens/sec) ──────────────────────────────────────

const MODEL_DECODE_SPEEDS: Record<string, number> = {
  opus: 30,
  sonnet: 60,
  haiku: 120,
  'gpt-4o': 80,
  'gpt-4': 40,
  'gpt-3.5': 120,
  'gemini-flash': 150,
  'gemini-pro': 80,
  'groq-llama': 500,
  cerebras: 1000,
  deepseek: 60,
  mistral: 100,
  command: 80,
  sonar: 80,
  llama: 500,
  mixtral: 300,
};

// ── Output length multiplier for verbose models ───────────────────────────

const MODEL_VERBOSITY: Record<string, number> = {
  opus: 1.5,
  sonnet: 1.2,
  haiku: 0.9,
  'gpt-4o': 1.1,
  'gpt-4': 1.3,
  'gpt-3.5': 1.0,
  'gemini-pro': 1.2,
  'gemini-flash': 0.9,
  deepseek: 1.3,
};

// ── Complexity thresholds ─────────────────────────────────────────────────

function classifyComplexity(
  estimatedOutputTokens: number,
): PredictedWorkload['complexity'] {
  if (estimatedOutputTokens <= 50) return 'trivial';
  if (estimatedOutputTokens <= 200) return 'short';
  if (estimatedOutputTokens <= 500) return 'medium';
  if (estimatedOutputTokens <= 2000) return 'long';
  return 'very_long';
}

// ── Core predictor ────────────────────────────────────────────────────────

class PromptAwareScheduler {
  /**
   * Predict workload (output tokens, latency, priority) from prompt text.
   */
  predictWorkload(prompt: string, model?: string): PredictedWorkload {
    const lower = prompt.toLowerCase();
    const estimatedInputTokens = Math.ceil(prompt.length / 4);

    let baseOutputTokens = 150; // default medium-short

    // ── Question type heuristics ──────────────────────────────────────

    if (/\bwhat\s+is\b/.test(lower) || /\bdefine\b/.test(lower)) {
      baseOutputTokens = 120;
    }
    if (/\bexplain\b/.test(lower) || /\bdescribe\b/.test(lower)) {
      baseOutputTokens = 350;
    }
    if (
      /\bwrite\s+a\b/.test(lower) ||
      /\bgenerate\s+a\b/.test(lower) ||
      /\bcreate\s+a\b/.test(lower) ||
      /\bdraft\s+a\b/.test(lower)
    ) {
      baseOutputTokens = 800;
    }
    if (
      /\bcreate\s+a\s+detailed\b/.test(lower) ||
      /\bwrite\s+a\s+detailed\b/.test(lower) ||
      /\bcomprehensive\b/.test(lower) ||
      /\bin[\- ]depth\b/.test(lower)
    ) {
      baseOutputTokens = 2500;
    }

    // ── Code requests ─────────────────────────────────────────────────

    if (/\bwrite\s+a\s+function\b/.test(lower) || /\bcode\s+a\s+function\b/.test(lower)) {
      baseOutputTokens = Math.max(baseOutputTokens, 400);
    }
    if (
      /\bbuild\s+a\s+full\b/.test(lower) ||
      /\bbuild\s+an?\s+application\b/.test(lower) ||
      /\bbuild\s+an?\s+app\b/.test(lower) ||
      /\bfull\s+application\b/.test(lower)
    ) {
      baseOutputTokens = Math.max(baseOutputTokens, 3000);
    }

    // ── List / enumeration markers ────────────────────────────────────

    const listMatch = lower.match(/\blist\s+(\d+)\b/);
    if (listMatch) {
      const count = parseInt(listMatch[1], 10);
      baseOutputTokens = Math.max(baseOutputTokens, count * 60);
    }

    // ── Constraint markers (override base) ────────────────────────────

    if (/\bin\s+one\s+sentence\b/.test(lower) || /\bone[\- ]liner\b/.test(lower)) {
      baseOutputTokens = Math.min(baseOutputTokens, 40);
    }
    if (/\bbriefly\b/.test(lower) || /\bshort\b/.test(lower) || /\bconcise(?:ly)?\b/.test(lower)) {
      baseOutputTokens = Math.min(baseOutputTokens, 150);
    }
    if (/\bin\s+detail\b/.test(lower) || /\bdetailed\b/.test(lower)) {
      baseOutputTokens = Math.max(baseOutputTokens, 800);
    }

    // ── Chain-of-thought multiplier ───────────────────────────────────

    if (
      /\bstep\s+by\s+step\b/.test(lower) ||
      /\bthink\s+through\b/.test(lower) ||
      /\blet'?s?\s+think\b/.test(lower) ||
      /\bchain[\- ]of[\- ]thought\b/.test(lower)
    ) {
      baseOutputTokens *= 2;
    }

    // ── Input length correlation (0.3x) ───────────────────────────────

    const inputCorrelation = estimatedInputTokens * 0.3;
    baseOutputTokens = Math.max(baseOutputTokens, Math.round(inputCorrelation));

    // ── Model-specific verbosity ──────────────────────────────────────

    const verbosity = this.getModelVerbosity(model);
    const estimatedOutputTokens = Math.round(baseOutputTokens * verbosity);

    // ── Latency from decode speed ─────────────────────────────────────

    const decodeSpeed = this.getDecodeSpeed(model);
    const estimatedLatencyMs = Math.round(
      (estimatedOutputTokens / decodeSpeed) * 1000,
    );

    const estimatedTotalTokens = estimatedInputTokens + estimatedOutputTokens;

    return {
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedTotalTokens,
      estimatedLatencyMs,
      priority: estimatedTotalTokens, // SJF: shortest jobs first
      complexity: classifyComplexity(estimatedOutputTokens),
    };
  }

  /**
   * Sort queued items by SJF priority with aging, user priority, and deadline adjustments.
   */
  rankQueue(queue: QueueItem[]): QueueItem[] {
    const now = Date.now();

    const scored = queue.map((item) => {
      // Start with predicted priority or fallback
      let priority: number;
      if (item.priority != null) {
        priority = item.priority;
      } else if (item.prompt) {
        const workload = this.predictWorkload(item.prompt, item.model);
        item.estimatedTokens = workload.estimatedTotalTokens;
        item.estimatedLatencyMs = workload.estimatedLatencyMs;
        priority = workload.priority;
      } else {
        priority = 500; // default mid-priority
      }

      // Aging: items waiting >60s get -1000 per minute waited
      const waitedMs = now - item.queuedAt.getTime();
      const waitedMinutes = Math.max(0, (waitedMs - 60_000) / 60_000);
      priority -= waitedMinutes * 1000;

      // Premium user bonus
      if (item.isPremium) {
        priority -= 5000;
      }

      // Deadline urgency: closer deadline = lower priority number = higher urgency
      if (item.deadline) {
        const msUntilDeadline = item.deadline.getTime() - now;
        if (msUntilDeadline < 60_000) {
          // Less than 1 minute: extreme urgency
          priority -= 20000;
        } else if (msUntilDeadline < 300_000) {
          // Less than 5 minutes
          priority -= 10000;
        } else if (msUntilDeadline < 600_000) {
          // Less than 10 minutes
          priority -= 5000;
        }
      }

      return { item, priority };
    });

    // Sort ascending: lower priority number = execute first
    scored.sort((a, b) => a.priority - b.priority);

    return scored.map((s) => s.item);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private getDecodeSpeed(model?: string): number {
    if (!model) return 60; // default sonnet-class

    const lower = model.toLowerCase();
    for (const [key, speed] of Object.entries(MODEL_DECODE_SPEEDS)) {
      if (lower.includes(key)) return speed;
    }
    return 60;
  }

  private getModelVerbosity(model?: string): number {
    if (!model) return 1.0;

    const lower = model.toLowerCase();
    for (const [key, factor] of Object.entries(MODEL_VERBOSITY)) {
      if (lower.includes(key)) return factor;
    }
    return 1.0;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const promptAwareScheduler = new PromptAwareScheduler();
