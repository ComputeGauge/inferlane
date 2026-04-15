#!/usr/bin/env node
/**
 * InferLane — cross-LLM persistence installer.
 *
 * Solves the "I have to ask Claude to connect InferLane every new session"
 * problem by writing a small, marker-delimited activation block into every
 * persistent-context file we can find on this machine. Idempotent (re-runs
 * update in place instead of duplicating). Reversible via
 * uninstall-persistence.mjs. Never touches content outside its own markers.
 *
 * Usage:
 *   node packages/plugin/scripts/install-persistence.mjs [options]
 *
 * Options:
 *   --scope=global|project|both   where to install (default: both)
 *   --project-dir=PATH            project dir for project-scoped files
 *                                 (default: process.cwd())
 *   --dry-run                     print what would change, don't write
 *   --quiet                       suppress non-error output
 *   --verbose                     dump client detection signals
 *   --force                       create files even for clients we did
 *                                 not auto-detect (useful for CI or when
 *                                 you know a client will be installed later)
 *   --clients=list                comma-separated: claude,cursor,copilot,
 *                                 gemini,aider,agents-md (default: all)
 *
 * Behaviour:
 *   - Auto-detects installed coding LLM clients using filesystem + PATH
 *     probes. Never spawns processes, never makes network calls, never
 *     throws on probe failures.
 *   - Creates files only for clients we detect. If you have none, we
 *     exit cleanly with a message and no files changed.
 *   - --force overrides detection for CI-like use cases.
 *
 * Exit codes:
 *   0  success (including "nothing to do" and "no clients detected")
 *   1  usage error
 *   2  IO error writing to a file
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectAllClients } from './detect-clients.mjs';

// ---- Constants ----

const VERSION = 'v1';
const BEGIN = `<!-- BEGIN INFERLANE ${VERSION} -->`;
const END = `<!-- END INFERLANE ${VERSION} -->`;

// Also match older versions so upgrades replace in place.
const LEGACY_BLOCK_RE =
  /<!-- BEGIN INFERLANE v\d+ -->[\s\S]*?<!-- END INFERLANE v\d+ -->\n?/g;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATE_PATH = resolve(__dirname, '..', 'templates', 'activation.md');

// ---- CLI parsing ----

const args = process.argv.slice(2);
const opts = {
  scope: 'both',          // global | project | both
  projectDir: process.cwd(),
  dryRun: false,
  quiet: false,
  clients: 'all',
  force: false,           // force-create files for clients we didn't detect
  verbose: false,         // dump detection signals
};

for (const arg of args) {
  if (arg === '--dry-run') opts.dryRun = true;
  else if (arg === '--quiet') opts.quiet = true;
  else if (arg === '--force') opts.force = true;
  else if (arg === '--verbose') opts.verbose = true;
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

// ---- Load activation template ----

// Minimal inline fallback — used only if the template file is missing
// from the package. Keeps the installer usable even if the package
// shipped without templates/activation.md.
const INLINE_FALLBACK =
  `${BEGIN}\n` +
  `## InferLane — cost-aware routing is active\n\n` +
  `Before any non-trivial LLM API call: consider a cheaper model, prefer\n` +
  `local inference, and use InferLane MCP tools (\`pick_model\`, \`assess_routing\`,\n` +
  `\`triage\`) when unsure. Log requests via \`log_request\`. Report spend via\n` +
  `\`session_cost\` / \`get_spend_summary\`.\n\n` +
  `Learn more: https://inferlane.dev\n` +
  `${END}\n`;

let activationBlock;
try {
  activationBlock = readFileSync(TEMPLATE_PATH, 'utf8').trim() + '\n';
} catch (err) {
  console.error(
    `(Warning) Could not read activation template at ${TEMPLATE_PATH}: ${err.message}`,
  );
  console.error('(Warning) Falling back to inline template.');
  activationBlock = INLINE_FALLBACK;
}

// Verify the block has the markers we expect.
if (!activationBlock.includes(BEGIN) || !activationBlock.includes(END)) {
  console.error(`Activation template is missing BEGIN/END markers for ${VERSION}`);
  process.exit(1);
}

// ---- Target resolution ----

/**
 * A target is a file we want to upsert the activation block into.
 *
 * `createIfMissing` is gated by three factors:
 *   1. The client must be detected as installed (or --force is set).
 *   2. The user didn't exclude the client via --clients.
 *   3. The scope allows it (global vs project).
 *
 * Every target is resolved; the main loop decides what to do with each.
 */
function resolveTargets(detections) {
  const home = homedir();
  const proj = opts.projectDir;
  const all = [];

  const claudeInstalled = detections.claude.installed;
  const cursorInstalled = detections.cursor.installed;
  const copilotInstalled = detections.copilot.installed;
  const geminiInstalled = detections.gemini.installed;
  const aiderInstalled = detections.aider.installed;
  const agentsMdRelevant = detections['agents-md'].installed;

  // Claude Code — global user-scoped memory.
  // Only auto-create if Claude is detected (or --force).
  all.push({
    label: 'Claude Code (global CLAUDE.md)',
    client: 'claude',
    scope: 'global',
    path: join(home, '.claude', 'CLAUDE.md'),
    createIfMissing: claudeInstalled || opts.force,
    detected: claudeInstalled,
  });

  // Claude Code — project-scoped memory
  all.push({
    label: 'Claude Code (project CLAUDE.md)',
    client: 'claude',
    scope: 'project',
    path: join(proj, 'CLAUDE.md'),
    createIfMissing: claudeInstalled || opts.force,
    detected: claudeInstalled,
  });

  // Cursor — project rules file
  all.push({
    label: 'Cursor (.cursorrules)',
    client: 'cursor',
    scope: 'project',
    path: join(proj, '.cursorrules'),
    createIfMissing: cursorInstalled || opts.force,
    detected: cursorInstalled,
  });

  // GitHub Copilot — repo-level custom instructions
  all.push({
    label: 'GitHub Copilot (.github/copilot-instructions.md)',
    client: 'copilot',
    scope: 'project',
    path: join(proj, '.github', 'copilot-instructions.md'),
    createIfMissing: copilotInstalled || opts.force,
    detected: copilotInstalled,
  });

  // Gemini Code Assist — project style guide
  all.push({
    label: 'Gemini Code Assist (.gemini/styleguide.md)',
    client: 'gemini',
    scope: 'project',
    path: join(proj, '.gemini', 'styleguide.md'),
    createIfMissing: geminiInstalled || opts.force,
    detected: geminiInstalled,
  });

  // Aider — conventions file
  all.push({
    label: 'Aider (CONVENTIONS.md)',
    client: 'aider',
    scope: 'project',
    path: join(proj, 'CONVENTIONS.md'),
    createIfMissing: aiderInstalled || opts.force,
    detected: aiderInstalled,
  });

  // AGENTS.md — cross-client convention. Relevant whenever any of the
  // other coding clients is installed, because those clients can be
  // configured to read it. We don't auto-create on a clean box.
  all.push({
    label: 'AGENTS.md (cross-client)',
    client: 'agents-md',
    scope: 'project',
    path: join(proj, 'AGENTS.md'),
    createIfMissing: agentsMdRelevant || opts.force,
    detected: agentsMdRelevant,
  });

  // Filter by scope
  let filtered = all.filter((t) => {
    if (opts.scope === 'global') return t.scope === 'global';
    if (opts.scope === 'project') return t.scope === 'project';
    return true;
  });

  // Filter by clients
  if (opts.clients !== 'all') {
    const allowed = new Set(opts.clients.split(',').map((s) => s.trim()));
    filtered = filtered.filter((t) => allowed.has(t.client));
  }

  return filtered;
}

// ---- Upsert logic ----

/**
 * Apply the activation block to a single file. If the file has an existing
 * InferLane block (any version), replace it in place. Otherwise append to
 * the end with a leading blank line.
 *
 * Returns: { action, path, changed } where action is one of:
 *   "created"     — we wrote a new file
 *   "updated"     — we modified an existing file
 *   "unchanged"   — our block was already present and current
 *   "skipped"     — client not detected, file absent, --force not set
 *   "error"       — IO error during read/write
 *
 * This function never throws; IO errors are reported in the result.
 */
function upsertTarget(target) {
  let exists = false;
  try {
    exists = existsSync(target.path);
  } catch {
    /* treat as missing */
  }

  // Skip non-existent files for clients we can't prove are installed
  // and where --force wasn't set. This is the "doesn't fail if the
  // client isn't installed" guarantee — we simply don't touch files
  // for clients the user doesn't use.
  if (!exists && !target.createIfMissing) {
    const reason = target.detected
      ? 'client detected but file does not exist and createIfMissing is off'
      : 'client not detected on this machine';
    return { action: 'skipped', path: target.path, changed: false, reason };
  }

  let original = '';
  if (exists) {
    try {
      original = readFileSync(target.path, 'utf8');
    } catch (err) {
      return { action: 'error', path: target.path, changed: false, reason: err.message };
    }
  }

  // Compose the new content.
  let next;
  if (LEGACY_BLOCK_RE.test(original)) {
    // Replace every existing InferLane block. The regex is stateful so
    // reset lastIndex before replace to be safe.
    LEGACY_BLOCK_RE.lastIndex = 0;
    next = original.replace(LEGACY_BLOCK_RE, activationBlock);
  } else {
    // Append. Add a single leading blank line if the file isn't empty.
    const sep = original.length > 0 && !original.endsWith('\n\n') ? '\n\n' : '';
    next = original + sep + activationBlock;
  }

  if (next === original) {
    return { action: 'unchanged', path: target.path, changed: false };
  }

  if (opts.dryRun) {
    return { action: exists ? 'updated' : 'created', path: target.path, changed: true };
  }

  try {
    // Ensure parent dir exists
    mkdirSync(dirname(target.path), { recursive: true });
    writeFileSync(target.path, next, 'utf8');
  } catch (err) {
    return { action: 'error', path: target.path, changed: false, reason: err.message };
  }

  return { action: exists ? 'updated' : 'created', path: target.path, changed: true };
}

// ---- Main ----

function log(...parts) {
  if (!opts.quiet) console.log(...parts);
}

function main() {
  // Detection never throws — every probe is wrapped in try/catch.
  let detections;
  try {
    detections = detectAllClients();
  } catch (err) {
    // Belt-and-braces: if the detection module itself is missing or
    // corrupt, fall back to "nothing detected" so we still run
    // cleanly for --force callers.
    log(`(client detection failed: ${err.message}; continuing with nothing detected)`);
    detections = {
      claude: { client: 'claude', installed: false, signals: [], checkedPaths: [] },
      cursor: { client: 'cursor', installed: false, signals: [], checkedPaths: [] },
      copilot: { client: 'copilot', installed: false, signals: [], checkedPaths: [] },
      gemini: { client: 'gemini', installed: false, signals: [], checkedPaths: [] },
      aider: { client: 'aider', installed: false, signals: [], checkedPaths: [] },
      'agents-md': { client: 'agents-md', installed: false, signals: [], checkedPaths: [] },
    };
  }

  log(`InferLane persistence installer ${VERSION}`);
  log(`Scope: ${opts.scope}  Project: ${opts.projectDir}`);
  if (opts.dryRun) log('DRY RUN — no files will be written.');
  if (opts.force) log('FORCE — will create files even for clients we did not detect.');
  log('');

  // Detection summary — shown upfront so users see what we saw.
  const detectedClients = Object.values(detections)
    .filter((d) => d.installed)
    .map((d) => d.client);
  if (detectedClients.length > 0) {
    log(`Detected clients: ${detectedClients.join(', ')}`);
  } else {
    log(`Detected clients: (none)`);
  }

  if (opts.verbose) {
    for (const d of Object.values(detections)) {
      log(`  [${d.client}] ${d.installed ? 'INSTALLED' : 'not detected'}`);
      for (const s of d.signals) log(`    signal: ${s}`);
    }
  }
  log('');

  const targets = resolveTargets(detections);

  if (targets.length === 0) {
    log('No targets matched the current scope + client filter. Nothing to do.');
    return 0;
  }

  let changed = 0;
  let errors = 0;
  let skipped = 0;

  for (const target of targets) {
    let result;
    try {
      result = upsertTarget(target);
    } catch (err) {
      // Belt-and-braces: upsertTarget should never throw, but if it does,
      // we absorb it so one failing target can't nuke the whole run.
      result = { action: 'error', path: target.path, changed: false, reason: err.message };
    }

    switch (result.action) {
      case 'created':
        log(`  + ${target.label}`);
        log(`      created ${result.path}`);
        changed++;
        break;
      case 'updated':
        log(`  ~ ${target.label}`);
        log(`      updated ${result.path}`);
        changed++;
        break;
      case 'unchanged':
        log(`  = ${target.label}  (already up to date)`);
        break;
      case 'skipped':
        log(`  · ${target.label}  (skipped: ${result.reason})`);
        skipped++;
        break;
      case 'error':
        log(`  ! ${target.label}  (error: ${result.reason})`);
        errors++;
        break;
    }
  }

  log('');
  const verb = opts.dryRun ? 'would be' : 'were';
  log(`${changed} file${changed === 1 ? '' : 's'} ${verb} changed, ${skipped} skipped.`);

  if (detectedClients.length === 0 && !opts.force) {
    log('');
    log('No coding LLM clients were detected on this machine.');
    log('InferLane\'s tools will still work inside Claude Code if you install');
    log('the plugin; re-run this command with --force to create files anyway,');
    log('or re-run after installing a supported client.');
  }

  // Never fail just because we had nothing to install. Only return
  // non-zero on real IO errors.
  if (errors > 0) {
    log(`${errors} error${errors === 1 ? '' : 's'} occurred.`);
    return 2;
  }
  return 0;
}

process.exit(main());
