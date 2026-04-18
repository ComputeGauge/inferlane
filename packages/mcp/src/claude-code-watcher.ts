// ============================================================================
// ClaudeCodeWatcher — Auto-ingest real usage from Claude Code transcript logs.
//
// Claude Code writes JSONL transcripts at ~/.claude/projects/**/*.jsonl with
// structured `message.usage` blocks (input/output tokens, cache hits). We
// parse those events and feed them into the SpendTracker + persistence layer
// so the fuel gauge reflects *actual* usage without any API key or manual
// logging.
//
// Zero network. Zero config. Opt out with INFERLANE_NO_CC_WATCH=1.
// ============================================================================

import { promises as fsp } from 'fs';
import { readdirSync, statSync, watch } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface UsageEvent {
  provider: 'anthropic';
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cost: number;
  createdAt: string;
  uuid: string;
}

// Anthropic pricing per million tokens (cache-aware).
// Cache creation = 1.25x base input. Cache read = 0.1x base input.
interface TierPrice { inputPerM: number; outputPerM: number }
const TIERS: Record<'opus' | 'sonnet' | 'haiku', TierPrice> = {
  opus:   { inputPerM: 15, outputPerM: 75 },
  sonnet: { inputPerM: 3,  outputPerM: 15 },
  haiku:  { inputPerM: 1,  outputPerM: 5 },
};

function tierForModel(model: string): TierPrice | null {
  const m = model.toLowerCase();
  if (m.includes('opus')) return TIERS.opus;
  if (m.includes('sonnet')) return TIERS.sonnet;
  if (m.includes('haiku')) return TIERS.haiku;
  return null;
}

function computeCost(model: string, input: number, output: number, cacheCreate: number, cacheRead: number): number {
  const tier = tierForModel(model);
  if (!tier) return 0;
  const inputM = input / 1_000_000;
  const outputM = output / 1_000_000;
  const cacheCreateM = cacheCreate / 1_000_000;
  const cacheReadM = cacheRead / 1_000_000;
  return inputM * tier.inputPerM
    + outputM * tier.outputPerM
    + cacheCreateM * tier.inputPerM * 1.25
    + cacheReadM * tier.inputPerM * 0.1;
}

interface FileState { offset: number; inode: number }

export interface WatcherHandlers {
  onUsage: (event: UsageEvent) => void;
  seenUuid: (uuid: string) => boolean;
}

export class ClaudeCodeWatcher {
  private projectsDir: string;
  private fileStates: Map<string, FileState> = new Map();
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private fsWatchers: Array<ReturnType<typeof watch>> = [];
  private handlers: WatcherHandlers;
  private running = false;

  constructor(handlers: WatcherHandlers, projectsDir?: string) {
    this.projectsDir = projectsDir || join(homedir(), '.claude', 'projects');
    this.handlers = handlers;
  }

  async start(): Promise<{ scanned: number; cost: number } | null> {
    if (process.env.INFERLANE_NO_CC_WATCH === '1') return null;

    try {
      const dirStat = statSync(this.projectsDir);
      if (!dirStat.isDirectory()) return null;
    } catch {
      // Claude Code not installed — silently skip
      return null;
    }

    this.running = true;

    // Initial backfill: scan this month's transcripts
    const backfill = await this.scanAll(/* initial */ true);

    // Poll every 10s for new lines (lightweight — just stat + read tail)
    this.pollInterval = setInterval(() => {
      this.scanAll(false).catch(() => { /* best-effort */ });
    }, 10_000);

    return backfill;
  }

  stop(): void {
    this.running = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    for (const w of this.fsWatchers) {
      try { w.close(); } catch { /* ignore */ }
    }
    this.fsWatchers = [];
  }

  private listJsonlFiles(dir: string, out: string[]): void {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        this.listJsonlFiles(full, out);
      } else if (e.isFile() && e.name.endsWith('.jsonl')) {
        out.push(full);
      }
    }
  }

  private async scanAll(initial: boolean): Promise<{ scanned: number; cost: number }> {
    const files: string[] = [];
    this.listJsonlFiles(this.projectsDir, files);

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    let scanned = 0;
    let cost = 0;

    for (const file of files) {
      let st;
      try { st = statSync(file); } catch { continue; }

      // Only consider files modified this month on initial scan (bound the work)
      if (initial && st.mtimeMs < monthStart) continue;

      const prev = this.fileStates.get(file);
      const currentSize = st.size;
      const currentInode = st.ino;

      // Handle rotation/truncation
      let startAt = 0;
      if (prev && prev.inode === currentInode && prev.offset <= currentSize) {
        startAt = prev.offset;
      }

      if (startAt === currentSize && prev) {
        continue; // no new bytes
      }

      try {
        const fh = await fsp.open(file, 'r');
        try {
          const buf = Buffer.alloc(currentSize - startAt);
          await fh.read(buf, 0, buf.length, startAt);
          const text = buf.toString('utf8');

          let lineStart = 0;
          for (let i = 0; i < text.length; i++) {
            if (text[i] === '\n') {
              const line = text.slice(lineStart, i);
              lineStart = i + 1;
              const event = this.parseLine(line);
              if (event && !this.handlers.seenUuid(event.uuid)) {
                this.handlers.onUsage(event);
                scanned += 1;
                cost += event.cost;
              }
            }
          }
          // Advance offset to end of last complete line only
          this.fileStates.set(file, {
            offset: startAt + lineStart,
            inode: currentInode,
          });
        } finally {
          await fh.close();
        }
      } catch {
        // Locked or deleted — skip this pass
      }
    }

    return { scanned, cost };
  }

  private parseLine(line: string): UsageEvent | null {
    if (!line || line[0] !== '{') return null;
    let d;
    try { d = JSON.parse(line); } catch { return null; }
    const msg = d?.message;
    if (!msg || typeof msg !== 'object') return null;
    const usage = msg.usage;
    const model = msg.model;
    if (!usage || !model || typeof model !== 'string') return null;

    const input = Number(usage.input_tokens) || 0;
    const output = Number(usage.output_tokens) || 0;
    const cacheCreate = Number(usage.cache_creation_input_tokens) || 0;
    const cacheRead = Number(usage.cache_read_input_tokens) || 0;

    if (input + output + cacheCreate + cacheRead === 0) return null;
    if (!tierForModel(model)) return null;

    const cost = computeCost(model, input, output, cacheCreate, cacheRead);
    const uuid = d.uuid || d.requestId || `${model}:${d.timestamp}:${input}:${output}`;

    return {
      provider: 'anthropic',
      model,
      inputTokens: input,
      outputTokens: output,
      cacheCreationTokens: cacheCreate,
      cacheReadTokens: cacheRead,
      cost,
      createdAt: d.timestamp || new Date().toISOString(),
      uuid: String(uuid),
    };
  }
}
