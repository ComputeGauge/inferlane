// ---------------------------------------------------------------------------
// Advanced Token Compressor — LLMLingua-inspired 12-layer pipeline
// ---------------------------------------------------------------------------
// Applies heuristic compression layers to reduce token count in chat messages
// without requiring a Python/GPU runtime. Each layer targets a specific
// source of redundancy.
// ---------------------------------------------------------------------------

// ── Types ─────────────────────────────────────────────────────────────────

export interface CompressionResult {
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  layers: { name: string; tokensSaved: number }[];
  compressedMessages: Array<{ role: string; content: string }>;
}

export interface CompressionOptions {
  aggressiveness: 'light' | 'moderate' | 'aggressive';
  preserveCode: boolean;
  preserveFormatting: boolean;
  targetReduction?: number; // aim for X% reduction (0-1), stop early if achieved
}

interface Message {
  role: string;
  content: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const FILLER_PHRASES = [
  'I think that',
  'It\'s worth noting that',
  'It is worth noting that',
  'As I mentioned before',
  'Let me explain',
  'In other words',
  'Basically',
  'Essentially',
  'Actually',
  'To be honest',
  'As you can see',
  'As you know',
  'It should be noted that',
  'It goes without saying that',
  'Needless to say',
  'At the end of the day',
  'For what it\'s worth',
  'In my opinion',
  'I believe that',
  'It seems like',
];

const REDUNDANT_QUALIFIERS = [
  'very',
  'really',
  'quite',
  'extremely',
  'absolutely',
  'definitely',
  'certainly',
  'obviously',
  'clearly',
  'literally',
  'totally',
  'completely',
  'utterly',
  'truly',
];

const DEFAULT_OPTIONS: CompressionOptions = {
  aggressiveness: 'moderate',
  preserveCode: false,
  preserveFormatting: false,
};

// ── AdvancedCompressor ────────────────────────────────────────────────────

class AdvancedCompressor {
  /**
   * Compress an array of chat messages through the multi-layer pipeline.
   */
  compress(
    messages: Message[],
    options?: Partial<CompressionOptions>,
  ): CompressionResult {
    const opts: CompressionOptions = { ...DEFAULT_OPTIONS, ...options };
    const layers: { name: string; tokensSaved: number }[] = [];

    // Deep clone messages to avoid mutating originals
    let msgs: Message[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const originalTokens = this.estimateTokensForMessages(msgs);
    let currentTokens = originalTokens;

    // Determine which layers to run based on aggressiveness
    const layerDefs = this.getLayersForLevel(opts);

    for (const layerDef of layerDefs) {
      // Check early exit if target reduction achieved
      if (opts.targetReduction != null) {
        const currentRatio = 1 - currentTokens / originalTokens;
        if (currentRatio >= opts.targetReduction) break;
      }

      const before = currentTokens;
      msgs = layerDef.fn.call(this, msgs, opts);
      currentTokens = this.estimateTokensForMessages(msgs);
      const saved = before - currentTokens;

      if (saved > 0) {
        layers.push({ name: layerDef.name, tokensSaved: saved });
      }
    }

    const compressedTokens = currentTokens;
    const compressionRatio =
      originalTokens > 0 ? 1 - compressedTokens / originalTokens : 0;

    return {
      originalTokens,
      compressedTokens,
      compressionRatio: Math.max(0, compressionRatio),
      layers,
      compressedMessages: msgs,
    };
  }

  // ── Layer definitions by aggressiveness ─────────────────────────────────

  private getLayersForLevel(
    opts: CompressionOptions,
  ): Array<{ name: string; fn: (msgs: Message[], opts: CompressionOptions) => Message[] }> {
    const all: Array<{
      name: string;
      fn: (msgs: Message[], opts: CompressionOptions) => Message[];
      level: 'light' | 'moderate' | 'aggressive';
    }> = [
      { name: 'whitespace_normalization', fn: this.layer1WhitespaceNorm, level: 'light' },
      { name: 'instruction_dedup', fn: this.layer2InstructionDedup, level: 'light' },
      { name: 'observation_summarization', fn: this.layer3ObservationSummarization, level: 'light' },
      { name: 'xml_html_stripping', fn: this.layer4XmlHtmlStripping, level: 'moderate' },
      { name: 'json_minification', fn: this.layer5JsonMinification, level: 'moderate' },
      { name: 'code_comment_removal', fn: this.layer6CodeCommentRemoval, level: 'moderate' },
      { name: 'filler_phrase_removal', fn: this.layer7FillerPhraseRemoval, level: 'moderate' },
      { name: 'pronoun_resolution', fn: this.layer8PronounResolution, level: 'moderate' },
      { name: 'redundant_qualifier_removal', fn: this.layer9RedundantQualifierRemoval, level: 'aggressive' },
      { name: 'sentence_dedup', fn: this.layer10SentenceDedup, level: 'aggressive' },
      { name: 'context_window_trimming', fn: this.layer11ContextWindowTrimming, level: 'aggressive' },
      { name: 'markdown_simplification', fn: this.layer12MarkdownSimplification, level: 'aggressive' },
    ];

    const levels: Record<string, number> = {
      light: 1,
      moderate: 2,
      aggressive: 3,
    };
    const targetLevel = levels[opts.aggressiveness] || 2;

    return all.filter((l) => levels[l.level] <= targetLevel);
  }

  // ── Layer 1: Whitespace normalization ───────────────────────────────────

  private layer1WhitespaceNorm(msgs: Message[]): Message[] {
    return msgs.map((m) => ({
      role: m.role,
      content: this.preservingCodeBlocks(m.content, (text) =>
        text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n'),
      ),
    }));
  }

  // ── Layer 2: Instruction dedup ──────────────────────────────────────────

  private layer2InstructionDedup(msgs: Message[]): Message[] {
    // Track instruction sentences across messages; remove duplicates
    const seen = new Set<string>();
    return msgs.map((m) => {
      if (m.role !== 'user' && m.role !== 'system') return m;

      const sentences = m.content.split(/(?<=[.!?])\s+/);
      const deduped = sentences.filter((s) => {
        const normalized = s.trim().toLowerCase().replace(/\s+/g, ' ');
        if (normalized.length < 20) return true; // keep short fragments
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      });

      return { role: m.role, content: deduped.join(' ') };
    });
  }

  // ── Layer 3: Observation summarization ──────────────────────────────────

  private layer3ObservationSummarization(msgs: Message[]): Message[] {
    return msgs.map((m) => {
      if (m.role !== 'tool' && m.role !== 'function') {
        // Also check for embedded tool results in assistant messages
        const content = m.content.replace(
          /(<(?:result|output|function_result)>)([\s\S]{2000,?}?)(<\/(?:result|output|function_result)>)/g,
          (_match, open: string, inner: string, close: string) => {
            if (/\b(?:function|class|import)\b/.test(inner)) return _match;
            const head = inner.slice(0, 500);
            const tail = inner.slice(-500);
            const truncated = inner.length - 1000;
            return `${open}${head}\n[...truncated ${truncated} chars...]\n${tail}${close}`;
          },
        );
        return { role: m.role, content };
      }

      // Tool/function results: truncate if very long
      if (m.content.length > 2000) {
        const head = m.content.slice(0, 500);
        const tail = m.content.slice(-500);
        const truncated = m.content.length - 1000;
        return {
          role: m.role,
          content: `${head}\n[...truncated ${truncated} chars...]\n${tail}`,
        };
      }
      return m;
    });
  }

  // ── Layer 4: XML/HTML stripping ─────────────────────────────────────────

  private layer4XmlHtmlStripping(msgs: Message[]): Message[] {
    return msgs.map((m) => ({
      role: m.role,
      content: this.preservingCodeBlocks(m.content, (text) => {
        // Remove HTML/XML tags but keep text content
        // Preserve common semantic markers like <result>, <output>
        let stripped = text;
        // Remove standard HTML tags (not semantic ones)
        stripped = stripped.replace(
          /<\/?(?:div|span|p|br|hr|table|tr|td|th|thead|tbody|ul|ol|li|a|b|i|em|strong|img|h[1-6]|section|article|header|footer|nav|main|aside|figure|figcaption|blockquote|pre|code|small|sup|sub|label|input|button|form|select|option|textarea|meta|link|script|style|head|body|html)[^>]*\/?>/gi,
          '',
        );
        // Clean up extra whitespace left behind
        stripped = stripped.replace(/\n{3,}/g, '\n\n');
        return stripped;
      }),
    }));
  }

  // ── Layer 5: JSON minification ──────────────────────────────────────────

  private layer5JsonMinification(msgs: Message[], opts: CompressionOptions): Message[] {
    if (opts.preserveFormatting) return msgs;

    return msgs.map((m) => ({
      role: m.role,
      content: m.content.replace(
        /```(?:json)?\s*\n([\s\S]*?)```/g,
        (_match, jsonBlock: string) => {
          try {
            const parsed = JSON.parse(jsonBlock);
            return '```json\n' + JSON.stringify(parsed) + '\n```';
          } catch {
            return _match; // not valid JSON, leave it
          }
        },
      ),
    }));
  }

  // ── Layer 6: Code comment removal ───────────────────────────────────────

  private layer6CodeCommentRemoval(msgs: Message[], opts: CompressionOptions): Message[] {
    if (opts.preserveCode) return msgs;

    return msgs.map((m) => ({
      role: m.role,
      content: m.content.replace(
        /```(?:\w*)\s*\n([\s\S]*?)```/g,
        (match, code: string) => {
          let stripped = code;
          // Remove single-line // comments
          stripped = stripped.replace(/^\s*\/\/.*$/gm, '');
          // Remove single-line # comments (not shebangs)
          stripped = stripped.replace(/^\s*#(?!!).*$/gm, '');
          // Remove /* */ block comments
          stripped = stripped.replace(/\/\*[\s\S]*?\*\//g, '');
          // Clean up blank lines left behind
          stripped = stripped.replace(/\n{3,}/g, '\n\n');

          const lang = match.match(/```(\w*)/)?.[1] || '';
          return '```' + lang + '\n' + stripped.trim() + '\n```';
        },
      ),
    }));
  }

  // ── Layer 7: Filler phrase removal ──────────────────────────────────────

  private layer7FillerPhraseRemoval(msgs: Message[]): Message[] {
    return msgs.map((m) => ({
      role: m.role,
      content: this.preservingCodeBlocks(m.content, (text) => {
        let result = text;
        for (const phrase of FILLER_PHRASES) {
          // Match phrase at start of sentence (case-insensitive), followed by optional comma
          const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const re = new RegExp(
            `(?<=^|[.!?]\\s+)${escaped},?\\s*`,
            'gi',
          );
          result = result.replace(re, '');
        }
        // Fix capitalization after removal
        result = result.replace(/(^|[.!?]\s+)([a-z])/g, (_m, pre, letter) =>
          pre + letter.toUpperCase(),
        );
        return result;
      }),
    }));
  }

  // ── Layer 8: Pronoun resolution (simple heuristic) ──────────────────────

  private layer8PronounResolution(msgs: Message[]): Message[] {
    return msgs.map((m) => {
      if (m.role === 'system') return m; // don't touch system prompts

      const sentences = m.content.split(/(?<=[.!?])\s+/);
      let lastSubject: string | null = null;

      const resolved = sentences.map((sentence) => {
        // Extract a likely subject: first capitalized noun phrase (simple heuristic)
        const subjectMatch = sentence.match(
          /^(?:The\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/,
        );
        if (subjectMatch) {
          lastSubject = subjectMatch[1];
        }

        // Replace leading "It is" / "This is" / "That is" when we have a subject
        if (lastSubject) {
          const replaced = sentence.replace(
            /^(It|This|That)\s+(is|was|has|will|can|should)\b/,
            `${lastSubject} $2`,
          );
          if (replaced !== sentence) return replaced;
        }

        return sentence;
      });

      return { role: m.role, content: resolved.join(' ') };
    });
  }

  // ── Layer 9: Redundant qualifier removal ────────────────────────────────

  private layer9RedundantQualifierRemoval(msgs: Message[]): Message[] {
    return msgs.map((m) => ({
      role: m.role,
      content: this.preservingCodeBlocks(m.content, (text) => {
        let result = text;
        for (const qualifier of REDUNDANT_QUALIFIERS) {
          // Remove qualifier + space before an adjective/adverb
          const re = new RegExp(`\\b${qualifier}\\s+`, 'gi');
          result = result.replace(re, '');
        }
        return result;
      }),
    }));
  }

  // ── Layer 10: Sentence dedup (word-overlap cosine similarity) ───────────

  private layer10SentenceDedup(msgs: Message[]): Message[] {
    const allSentences: Array<{ words: Set<string>; text: string }> = [];

    return msgs.map((m) => {
      const sentences = m.content.split(/(?<=[.!?])\s+/);
      const deduped: string[] = [];

      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (trimmed.length < 30) {
          deduped.push(sentence);
          continue;
        }

        const words = this.extractWords(trimmed);
        const isDuplicate = allSentences.some(
          (prev) => this.cosineSimilarity(prev.words, words) >= 0.85,
        );

        if (isDuplicate) {
          // Skip duplicate sentence
          continue;
        }

        allSentences.push({ words, text: trimmed });
        deduped.push(sentence);
      }

      return { role: m.role, content: deduped.join(' ') };
    });
  }

  // ── Layer 11: Context window trimming ───────────────────────────────────

  private layer11ContextWindowTrimming(msgs: Message[]): Message[] {
    if (msgs.length <= 10) return msgs;

    // Keep: system messages + first 2 non-system + last 5
    const systemMsgs = msgs.filter((m) => m.role === 'system');
    const nonSystem = msgs.filter((m) => m.role !== 'system');

    if (nonSystem.length <= 7) return msgs;

    const first2 = nonSystem.slice(0, 2);
    const last5 = nonSystem.slice(-5);
    const middle = nonSystem.slice(2, -5);

    // Summarize middle messages
    const summaryParts: string[] = [];
    for (const m of middle) {
      // Extract key sentences (first sentence of each message)
      const firstSentence = m.content.match(/^[^.!?]+[.!?]/)?.[0] || '';
      if (firstSentence.length > 10) {
        summaryParts.push(`[${m.role}] ${firstSentence}`);
      }
    }

    const summaryMsg: Message = {
      role: 'user',
      content: `[Earlier conversation summary - ${middle.length} messages compressed]\n${summaryParts.join('\n')}`,
    };

    return [...systemMsgs, ...first2, summaryMsg, ...last5];
  }

  // ── Layer 12: Markdown simplification ───────────────────────────────────

  private layer12MarkdownSimplification(msgs: Message[], opts: CompressionOptions): Message[] {
    if (opts.preserveFormatting) return msgs;

    return msgs.map((m) => ({
      role: m.role,
      content: this.preservingCodeBlocks(m.content, (text) => {
        let simplified = text;

        // Convert markdown tables to CSV-like format
        simplified = simplified.replace(
          /\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)*)/g,
          (_match, headerRow: string, bodyRows: string) => {
            const headers = headerRow
              .split('|')
              .map((h: string) => h.trim())
              .filter(Boolean);
            const rows = bodyRows
              .trim()
              .split('\n')
              .map((row: string) =>
                row
                  .split('|')
                  .map((c: string) => c.trim())
                  .filter(Boolean),
              );
            const lines = [headers.join(', ')];
            for (const row of rows) {
              lines.push(row.join(', '));
            }
            return lines.join('\n') + '\n';
          },
        );

        // Convert headers to bold text
        simplified = simplified.replace(/^#{1,6}\s+(.+)$/gm, '**$1**');

        // Remove horizontal rules
        simplified = simplified.replace(/^[-*_]{3,}$/gm, '');

        // Strip HTML comments
        simplified = simplified.replace(/<!--[\s\S]*?-->/g, '');

        // Remove emphasis markers but keep text
        simplified = simplified.replace(/\*{1,2}(.+?)\*{1,2}/g, '$1');
        simplified = simplified.replace(/_{1,2}(.+?)_{1,2}/g, '$1');

        return simplified;
      }),
    }));
  }

  // ── Utility methods ─────────────────────────────────────────────────────

  private estimateTokensForMessages(msgs: Message[]): number {
    let total = 0;
    for (const m of msgs) {
      // ~4 tokens for role/delimiters + content
      total += 4 + Math.ceil(m.content.length / 4);
    }
    return total;
  }

  /**
   * Apply a transform function to text outside of code blocks.
   */
  private preservingCodeBlocks(
    text: string,
    fn: (segment: string) => string,
  ): string {
    const parts = text.split(/(```[\s\S]*?```)/);
    return parts
      .map((part, i) => (i % 2 === 1 ? part : fn(part)))
      .join('');
  }

  private extractWords(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2),
    );
  }

  private cosineSimilarity(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;

    let intersection = 0;
    for (const word of a) {
      if (b.has(word)) intersection++;
    }

    return intersection / Math.sqrt(a.size * b.size);
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const advancedCompressor = new AdvancedCompressor();
