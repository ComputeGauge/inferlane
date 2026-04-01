// Adapted from ClawRouter (MIT License) — https://github.com/BlockRunAI/ClawRouter
// Compression layers applied sequentially to reduce token count

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompressionResult {
  original: string;
  compressed: string;
  originalTokens: number;    // estimated
  compressedTokens: number;  // estimated
  savings: number;           // percentage 0-1
  layersApplied: string[];   // which layers fired
  cachingHint?: string;      // anthropic-beta header value if applicable
}

// ---------------------------------------------------------------------------
// TokenCompressor — 7-layer sequential compression
// ---------------------------------------------------------------------------

class TokenCompressor {
  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Apply all 7 compression layers sequentially.
   * If `systemPrompt` is provided and long enough, a caching hint is returned.
   */
  compress(prompt: string, systemPrompt?: string): CompressionResult {
    const original = prompt;
    const originalTokens = this.estimateTokens(original);
    const layersApplied: string[] = [];

    let text = prompt;

    // Layer 1: Whitespace normalization
    const afterWhitespace = this.normalizeWhitespace(text);
    if (afterWhitespace !== text) {
      layersApplied.push('whitespace_normalization');
      text = afterWhitespace;
    }

    // Layer 2: Redundant instruction removal
    const afterInstructions = this.removeRedundantInstructions(text);
    if (afterInstructions !== text) {
      layersApplied.push('redundant_instruction_removal');
      text = afterInstructions;
    }

    // Layer 3: Observation summarization
    const afterObservation = this.summarizeObservations(text);
    if (afterObservation !== text) {
      layersApplied.push('observation_summarization');
      text = afterObservation;
    }

    // Layer 4: Repeated context dedup
    const afterDedup = this.dedupRepeatedContext(text);
    if (afterDedup !== text) {
      layersApplied.push('repeated_context_dedup');
      text = afterDedup;
    }

    // Layer 5: System prompt caching hint (metadata only)
    let cachingHint: string | undefined;
    if (systemPrompt && this.estimateTokens(systemPrompt) > 500) {
      cachingHint = 'prompt-caching-2024-07-31';
      layersApplied.push('system_prompt_caching_hint');
    }

    // Layer 6: Timestamp stripping
    const afterTimestamps = this.stripTimestamps(text);
    if (afterTimestamps !== text) {
      layersApplied.push('timestamp_stripping');
      text = afterTimestamps;
    }

    // Layer 7: Markdown simplification
    const afterMarkdown = this.simplifyMarkdown(text);
    if (afterMarkdown !== text) {
      layersApplied.push('markdown_simplification');
      text = afterMarkdown;
    }

    const compressedTokens = this.estimateTokens(text);
    const savings = originalTokens > 0
      ? 1 - compressedTokens / originalTokens
      : 0;

    return {
      original,
      compressed: text,
      originalTokens,
      compressedTokens,
      savings: Math.max(0, savings),
      layersApplied,
      cachingHint,
    };
  }

  /**
   * Rough token estimate: chars / 4.
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  // ── Layer 1: Whitespace normalization ───────────────────────────────────

  private normalizeWhitespace(text: string): string {
    // Preserve code blocks between ``` markers
    const parts = text.split(/(```[\s\S]*?```)/);
    return parts
      .map((part, i) => {
        // Odd indices are code blocks — leave them alone
        if (i % 2 === 1) return part;
        // Collapse multiple whitespace (spaces, tabs, newlines) to single space
        return part.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
      })
      .join('');
  }

  // ── Layer 2: Redundant instruction removal ──────────────────────────────

  private removeRedundantInstructions(text: string): string {
    const prefixes = [
      /\bPlease\s+/gi,
      /\bCould you please\s+/gi,
      /\bI would like you to\s+/gi,
      /\bCan you\s+/gi,
      /\bI need you to\s+/gi,
    ];

    let result = text;
    for (const prefix of prefixes) {
      result = result.replace(prefix, '');
    }

    // Capitalize first letter of sentences that were trimmed
    result = result.replace(/(^|[.!?]\s+)([a-z])/g, (_match, pre, letter) =>
      pre + letter.toUpperCase(),
    );

    return result;
  }

  // ── Layer 3: Observation summarization ──────────────────────────────────

  private summarizeObservations(text: string): string {
    // Look for tool/function result blocks longer than 2000 chars
    // Common patterns: <result>...</result>, ```output...```, {json...}
    const resultBlockPattern =
      /(<result>[\s\S]{2000,}?<\/result>|<output>[\s\S]{2000,}?<\/output>|<function_result>[\s\S]{2000,}?<\/function_result>)/g;

    return text.replace(resultBlockPattern, (block) => {
      // Don't truncate if it looks like code
      if (/\b(function|class|import)\b/.test(block)) return block;

      const inner = block;
      if (inner.length <= 2000) return block;

      const head = inner.slice(0, 500);
      const tail = inner.slice(-500);
      const truncated = inner.length - 1000;
      return `${head}\n[...truncated ${truncated} chars...]\n${tail}`;
    });
  }

  // ── Layer 4: Repeated context dedup ─────────────────────────────────────

  private dedupRepeatedContext(text: string): string {
    // Split into paragraphs (double newline separated)
    const paragraphs = text.split(/\n{2,}/);
    const seen = new Set<string>();
    const result: string[] = [];

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (trimmed.length <= 50) {
        // Short paragraphs: keep unconditionally
        result.push(para);
        continue;
      }

      if (seen.has(trimmed)) {
        result.push('[see above]');
      } else {
        seen.add(trimmed);
        result.push(para);
      }
    }

    return result.join('\n\n');
  }

  // ── Layer 6: Timestamp stripping ────────────────────────────────────────

  private stripTimestamps(text: string): string {
    // Match patterns like [Mon 2024-03-15 14:30 UTC] or [2024-03-15 14:30:00 PST]
    return text.replace(
      /\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?\s*\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?\s*[A-Z]{2,5}\]\s*/gi,
      '',
    );
  }

  // ── Layer 7: Markdown simplification ────────────────────────────────────

  private simplifyMarkdown(text: string): string {
    // Preserve code blocks
    const parts = text.split(/(```[\s\S]*?```)/);
    return parts
      .map((part, i) => {
        if (i % 2 === 1) return part; // code block

        let simplified = part;

        // Collapse horizontal rules (multiple --- or ===)
        simplified = simplified.replace(/^-{3,}$/gm, '---');
        simplified = simplified.replace(/^={3,}$/gm, '---');

        // Reduce deep headings: ####+ → ###
        simplified = simplified.replace(/^#{4,}\s/gm, '### ');

        // Strip HTML comments
        simplified = simplified.replace(/<!--[\s\S]*?-->/g, '');

        return simplified;
      })
      .join('');
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const tokenCompressor = new TokenCompressor();
