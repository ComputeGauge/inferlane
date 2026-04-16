/**
 * InferLane — LLM client detection.
 *
 * Probes the local machine for signals that a given AI coding client is
 * installed, independent of whether its persistent-context file exists
 * yet. Returns a structured result for each supported client so the
 * installer can make scope-appropriate decisions.
 *
 * Detection is strictly best-effort and strictly non-throwing:
 *   - Any fs/PATH probe that fails is treated as a negative signal.
 *   - No external processes are spawned.
 *   - No network calls.
 *   - Nothing is written.
 *
 * Supported clients:
 *   - claude      Claude Code (CLI) + Claude Desktop (MCP app)
 *   - cursor      Cursor editor
 *   - copilot     GitHub Copilot (via VS Code extension or gh CLI)
 *   - gemini      Gemini Code Assist (VS Code extension)
 *   - aider       Aider CLI
 *   - agents-md   Cross-client convention — considered "available"
 *                 whenever any other coding client is installed
 *
 * Each result has:
 *   {
 *     client: "claude",
 *     installed: true | false,
 *     signals: [...what we saw...],
 *     checkedPaths: [...what we looked at...],
 *   }
 *
 * The installer uses `installed` to decide whether to create a
 * missing persistent-context file for that client.
 */

import { existsSync, statSync, readdirSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { delimiter, join, sep } from 'node:path';

const PLATFORM = platform();         // 'darwin' | 'linux' | 'win32'

/**
 * Return true if any of the given filesystem paths exist. Never throws.
 */
function anyExists(paths) {
  for (const p of paths) {
    try {
      if (existsSync(p)) return true;
    } catch {
      /* swallow */
    }
  }
  return false;
}

/**
 * Return the first path from the list that exists, or null. Never throws.
 */
function firstExisting(paths) {
  for (const p of paths) {
    try {
      if (existsSync(p)) return p;
    } catch {
      /* swallow */
    }
  }
  return null;
}

/**
 * Look up a binary name on the current PATH without spawning a process.
 * Returns the full path of the first match, or null. Never throws.
 *
 * On Windows, also probes common extensions (.exe, .cmd, .bat).
 */
function whichBinary(name) {
  const PATH = process.env.PATH ?? '';
  if (!PATH) return null;

  const entries = PATH.split(delimiter).filter(Boolean);
  const candidates = PLATFORM === 'win32'
    ? [name, `${name}.exe`, `${name}.cmd`, `${name}.bat`]
    : [name];

  for (const dir of entries) {
    for (const cand of candidates) {
      try {
        const full = dir.endsWith(sep) ? dir + cand : dir + sep + cand;
        if (existsSync(full)) {
          const st = statSync(full);
          if (st.isFile()) return full;
        }
      } catch {
        /* swallow */
      }
    }
  }
  return null;
}

/**
 * Find a VS Code extension directory by prefix. VS Code stores extensions
 * as `<publisher>.<id>-<version>` under ~/.vscode/extensions (also
 * ~/.vscode-server/extensions for remote). Returns the first matching
 * directory name or null.
 */
function findVsCodeExtension(prefix) {
  const home = homedir();
  const roots = [
    join(home, '.vscode', 'extensions'),
    join(home, '.vscode-server', 'extensions'),
    join(home, '.vscode-insiders', 'extensions'),
    join(home, '.cursor', 'extensions'),              // Cursor forks VS Code
  ];
  for (const root of roots) {
    try {
      if (!existsSync(root)) continue;
      const entries = readdirSync(root);
      for (const entry of entries) {
        if (entry.toLowerCase().startsWith(prefix.toLowerCase())) {
          return join(root, entry);
        }
      }
    } catch {
      /* swallow */
    }
  }
  return null;
}

// ---- Per-client detectors ----

function detectClaude() {
  const home = homedir();
  const signals = [];
  const checked = [];

  // Claude Code CLI
  const appSupport = PLATFORM === 'darwin'
    ? join(home, 'Library', 'Application Support', 'Claude')
    : PLATFORM === 'win32'
      ? join(process.env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'Claude')
      : join(home, '.config', 'Claude');

  const probes = {
    'Claude Code config dir': join(home, '.claude'),
    'Claude Desktop support dir': appSupport,
    'Claude CLI binary on PATH': 'bin:claude',
    'CLAUDECODE env var': 'env:CLAUDECODE',
    'CLAUDE_CODE env var': 'env:CLAUDE_CODE',
  };

  if (PLATFORM === 'darwin') {
    probes['Claude Desktop app bundle'] = '/Applications/Claude.app';
  } else if (PLATFORM === 'win32') {
    const lad = process.env.LOCALAPPDATA ?? join(home, 'AppData', 'Local');
    probes['Claude Desktop install (AnthropicClaude)'] = join(lad, 'AnthropicClaude');
    probes['Claude Desktop install (Programs)'] = join(lad, 'Programs', 'Claude');
  }

  for (const [label, p] of Object.entries(probes)) {
    checked.push(`${label}: ${p}`);
    if (p.startsWith('bin:')) {
      const bin = p.slice('bin:'.length);
      const found = whichBinary(bin);
      if (found) signals.push(`${label} at ${found}`);
    } else if (p.startsWith('env:')) {
      const name = p.slice('env:'.length);
      if (process.env[name]) signals.push(`${label} is set`);
    } else {
      try {
        if (existsSync(p)) signals.push(`${label} exists`);
      } catch {
        /* swallow */
      }
    }
  }

  return {
    client: 'claude',
    installed: signals.length > 0,
    signals,
    checkedPaths: checked,
  };
}

function detectCursor() {
  const home = homedir();
  const signals = [];
  const checked = [];

  const paths = PLATFORM === 'darwin'
    ? [
        '/Applications/Cursor.app',
        join(home, 'Applications', 'Cursor.app'),
        join(home, 'Library', 'Application Support', 'Cursor'),
        join(home, '.cursor'),
      ]
    : PLATFORM === 'win32'
      ? [
          join(process.env.LOCALAPPDATA ?? join(home, 'AppData', 'Local'), 'Programs', 'cursor'),
          join(process.env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'Cursor'),
          join(home, '.cursor'),
        ]
      : [
          join(home, '.config', 'Cursor'),
          join(home, '.cursor'),
          '/usr/share/cursor',
          '/opt/Cursor',
        ];

  for (const p of paths) {
    checked.push(`path: ${p}`);
    try {
      if (existsSync(p)) signals.push(`${p} exists`);
    } catch {
      /* swallow */
    }
  }

  const cursorBin = whichBinary('cursor');
  checked.push(`bin: cursor on PATH`);
  if (cursorBin) signals.push(`cursor binary at ${cursorBin}`);

  return {
    client: 'cursor',
    installed: signals.length > 0,
    signals,
    checkedPaths: checked,
  };
}

function detectCopilot() {
  const home = homedir();
  const signals = [];
  const checked = [];

  // `gh` alone is not proof of Copilot — many users have it for PRs.
  // We only count gh as a signal if the gh-copilot extension is
  // actually installed under ~/.config/gh/extensions or similar.
  const ghExtRoots = [
    join(home, '.local', 'share', 'gh', 'extensions'),
    join(home, '.config', 'gh', 'extensions'),
    join(process.env.LOCALAPPDATA ?? '', 'GitHub CLI', 'extensions'),
  ];
  for (const root of ghExtRoots) {
    checked.push(`gh ext root: ${root}`);
    try {
      if (!existsSync(root)) continue;
      const entries = readdirSync(root);
      if (entries.some((e) => e.toLowerCase().includes('copilot'))) {
        signals.push(`gh-copilot extension in ${root}`);
      }
    } catch {
      /* swallow */
    }
  }

  // VS Code / Cursor extension (canonical signal)
  const ext = findVsCodeExtension('github.copilot');
  checked.push('vscode ext: github.copilot*');
  if (ext) signals.push(`Copilot extension at ${ext}`);

  const chatExt = findVsCodeExtension('github.copilot-chat');
  checked.push('vscode ext: github.copilot-chat*');
  if (chatExt) signals.push(`Copilot Chat extension at ${chatExt}`);

  // JetBrains copilot plugin — common plugin dir
  const jbRoots = PLATFORM === 'darwin'
    ? [join(home, 'Library', 'Application Support', 'JetBrains')]
    : PLATFORM === 'win32'
      ? [join(process.env.APPDATA ?? '', 'JetBrains')]
      : [join(home, '.config', 'JetBrains')];
  for (const root of jbRoots) {
    checked.push(`jetbrains plugin root: ${root}`);
    try {
      if (!existsSync(root)) continue;
      const entries = readdirSync(root);
      for (const entry of entries) {
        const pluginDir = join(root, entry, 'plugins', 'github-copilot-intellij');
        if (existsSync(pluginDir)) {
          signals.push(`JetBrains Copilot plugin at ${pluginDir}`);
        }
      }
    } catch {
      /* swallow */
    }
  }

  return {
    client: 'copilot',
    installed: signals.length > 0,
    signals,
    checkedPaths: checked,
  };
}

function detectGemini() {
  const home = homedir();
  const signals = [];
  const checked = [];

  const ext = findVsCodeExtension('google.geminicodeassist');
  checked.push('vscode ext: google.geminicodeassist*');
  if (ext) signals.push(`Gemini Code Assist extension at ${ext}`);

  // IntelliJ Gemini plugin
  const jbRoots = PLATFORM === 'darwin'
    ? [join(home, 'Library', 'Application Support', 'JetBrains')]
    : PLATFORM === 'win32'
      ? [join(process.env.APPDATA ?? '', 'JetBrains')]
      : [join(home, '.config', 'JetBrains')];
  for (const root of jbRoots) {
    try {
      if (!existsSync(root)) continue;
      const entries = readdirSync(root);
      for (const entry of entries) {
        const pluginDir = join(root, entry, 'plugins', 'google-gemini');
        checked.push(`jetbrains plugin: ${pluginDir}`);
        if (existsSync(pluginDir)) {
          signals.push(`Gemini IntelliJ plugin at ${pluginDir}`);
        }
      }
    } catch {
      /* swallow */
    }
  }

  // gcloud CLI (Gemini Code Assist Enterprise requires gcloud auth)
  const gcloud = whichBinary('gcloud');
  checked.push('bin: gcloud on PATH');
  // Note: gcloud alone is not proof of Gemini Code Assist; we do not
  // treat it as a signal unless combined with the extension above.

  return {
    client: 'gemini',
    installed: signals.length > 0,
    signals,
    checkedPaths: checked,
  };
}

function detectAider() {
  const home = homedir();
  const signals = [];
  const checked = [];

  const aiderBin = whichBinary('aider');
  checked.push('bin: aider on PATH');
  if (aiderBin) signals.push(`aider binary at ${aiderBin}`);

  const paths = [
    join(home, '.aider'),
    join(home, '.aider.conf.yml'),
    join(home, '.config', 'aider'),
  ];
  for (const p of paths) {
    checked.push(`path: ${p}`);
    try {
      if (existsSync(p)) signals.push(`${p} exists`);
    } catch {
      /* swallow */
    }
  }

  return {
    client: 'aider',
    installed: signals.length > 0,
    signals,
    checkedPaths: checked,
  };
}

// AGENTS.md is a cross-client convention — it's considered installed if
// any *other* coding client is installed, because that's when an AGENTS.md
// file has a reader. Detected last, after the others.
function detectAgentsMd(otherResults) {
  const anyInstalled = otherResults.some((r) => r.installed);
  return {
    client: 'agents-md',
    installed: anyInstalled,
    signals: anyInstalled
      ? [`at least one coding client is installed; AGENTS.md will be read`]
      : [],
    checkedPaths: [],
  };
}

// ---- Public API ----

/**
 * Run every detector and return the results keyed by client id.
 */
export function detectAllClients() {
  const claude = detectClaude();
  const cursor = detectCursor();
  const copilot = detectCopilot();
  const gemini = detectGemini();
  const aider = detectAider();
  const agentsMd = detectAgentsMd([claude, cursor, copilot, gemini, aider]);

  return {
    claude,
    cursor,
    copilot,
    gemini,
    aider,
    'agents-md': agentsMd,
  };
}

/**
 * Lookup by client id. Returns null if unknown.
 */
export function detectClient(id) {
  const all = detectAllClients();
  return all[id] ?? null;
}
