#!/usr/bin/env node
/**
 * InferLane — cross-LLM persistence uninstaller.
 *
 * Removes every InferLane activation block written by
 * install-persistence.mjs. Only touches content between our markers —
 * never deletes user content, never removes the surrounding file.
 *
 * If removing the block leaves the file empty, the file is also removed
 * ONLY for files we created with createIfMissing. Files that existed
 * before we touched them are left in place (empty if needed).
 *
 * Usage:
 *   node packages/plugin/scripts/uninstall-persistence.mjs [options]
 *
 * Options mirror install-persistence.mjs. See --help for details.
 */

import { existsSync, readFileSync, writeFileSync, statSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LEGACY_BLOCK_RE =
  /\n?<!-- BEGIN INFERLANE v\d+ -->[\s\S]*?<!-- END INFERLANE v\d+ -->\n?/g;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const opts = {
  scope: 'both',
  projectDir: process.cwd(),
  dryRun: false,
  quiet: false,
  clients: 'all',
};

for (const arg of args) {
  if (arg === '--dry-run') opts.dryRun = true;
  else if (arg === '--quiet') opts.quiet = true;
  else if (arg.startsWith('--scope=')) opts.scope = arg.slice('--scope='.length);
  else if (arg.startsWith('--project-dir=')) opts.projectDir = resolve(arg.slice('--project-dir='.length));
  else if (arg.startsWith('--clients=')) opts.clients = arg.slice('--clients='.length);
  else if (arg === '--help' || arg === '-h') {
    console.log(readFileSync(__filename, 'utf8').match(/\/\*\*[\s\S]*?\*\//)[0]);
    process.exit(0);
  } else {
    console.error(`Unknown option: ${arg}`);
    process.exit(1);
  }
}

if (!['global', 'project', 'both'].includes(opts.scope)) {
  console.error(`--scope must be one of: global, project, both`);
  process.exit(1);
}

function log(...parts) {
  if (!opts.quiet) console.log(...parts);
}

function resolveTargets() {
  const home = homedir();
  const proj = opts.projectDir;
  const all = [
    { label: 'Claude Code (global CLAUDE.md)', client: 'claude', scope: 'global', path: join(home, '.claude', 'CLAUDE.md'), ourCreation: true },
    { label: 'Claude Code (project CLAUDE.md)', client: 'claude', scope: 'project', path: join(proj, 'CLAUDE.md'), ourCreation: true },
    { label: 'Cursor (.cursorrules)', client: 'cursor', scope: 'project', path: join(proj, '.cursorrules'), ourCreation: false },
    { label: 'GitHub Copilot (.github/copilot-instructions.md)', client: 'copilot', scope: 'project', path: join(proj, '.github', 'copilot-instructions.md'), ourCreation: false },
    { label: 'Gemini Code Assist (.gemini/styleguide.md)', client: 'gemini', scope: 'project', path: join(proj, '.gemini', 'styleguide.md'), ourCreation: false },
    { label: 'Aider (CONVENTIONS.md)', client: 'aider', scope: 'project', path: join(proj, 'CONVENTIONS.md'), ourCreation: false },
    { label: 'AGENTS.md (cross-client)', client: 'agents-md', scope: 'project', path: join(proj, 'AGENTS.md'), ourCreation: false },
  ];

  let filtered = all.filter((t) => {
    if (opts.scope === 'global') return t.scope === 'global';
    if (opts.scope === 'project') return t.scope === 'project';
    return true;
  });

  if (opts.clients !== 'all') {
    const allowed = new Set(opts.clients.split(',').map((s) => s.trim()));
    filtered = filtered.filter((t) => allowed.has(t.client));
  }

  return filtered;
}

function removeFromTarget(target) {
  if (!existsSync(target.path)) {
    return { action: 'absent', path: target.path };
  }

  let original;
  try {
    original = readFileSync(target.path, 'utf8');
  } catch (err) {
    return { action: 'error', path: target.path, reason: err.message };
  }

  LEGACY_BLOCK_RE.lastIndex = 0;
  if (!LEGACY_BLOCK_RE.test(original)) {
    return { action: 'no-block', path: target.path };
  }

  LEGACY_BLOCK_RE.lastIndex = 0;
  const next = original.replace(LEGACY_BLOCK_RE, '').trimEnd() + '\n';

  if (opts.dryRun) {
    return { action: 'removed', path: target.path };
  }

  try {
    if (next.trim().length === 0 && target.ourCreation) {
      // File is empty and we created it — remove it entirely.
      unlinkSync(target.path);
      return { action: 'deleted', path: target.path };
    }
    writeFileSync(target.path, next, 'utf8');
    return { action: 'removed', path: target.path };
  } catch (err) {
    return { action: 'error', path: target.path, reason: err.message };
  }
}

function main() {
  const targets = resolveTargets();
  if (targets.length === 0) {
    log('No targets matched. Nothing to do.');
    return 0;
  }

  log(`InferLane persistence uninstaller`);
  log(`Scope: ${opts.scope}  Project: ${opts.projectDir}`);
  if (opts.dryRun) log('DRY RUN — no files will be written.');
  log('');

  let removed = 0;
  let errors = 0;
  for (const target of targets) {
    const result = removeFromTarget(target);
    switch (result.action) {
      case 'absent':
        log(`  · ${target.label}  (not present)`);
        break;
      case 'no-block':
        log(`  · ${target.label}  (no InferLane block to remove)`);
        break;
      case 'removed':
        log(`  - ${target.label}`);
        log(`      cleaned ${result.path}`);
        removed++;
        break;
      case 'deleted':
        log(`  - ${target.label}`);
        log(`      deleted ${result.path} (empty after removal)`);
        removed++;
        break;
      case 'error':
        log(`  ! ${target.label}  (error: ${result.reason})`);
        errors++;
        break;
    }
  }

  log('');
  log(`${removed} file${removed === 1 ? '' : 's'} ${opts.dryRun ? 'would be' : ''} cleaned.`);
  if (errors > 0) {
    log(`${errors} error${errors === 1 ? '' : 's'} occurred.`);
    return 2;
  }
  return 0;
}

process.exit(main());
