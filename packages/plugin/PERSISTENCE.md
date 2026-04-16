# InferLane Persistence — One-Command Setup for Every LLM Client

By default, Claude (and other LLMs) don't *remember* to think about cost at
the start of a new conversation. The tools are available, but without a
standing instruction they only get used when you prompt them explicitly.

This document describes the persistence installer that solves that —
a small idempotent script that writes a marker-delimited activation block
to every persistent-context file your coding LLM respects.

## One-command install

```sh
# From anywhere — uses the bin shipped with @inferlane/mcp-server
npx @inferlane/mcp-server inferlane-persist
```

That's it. The installer will:

1. Detect which LLM clients you use (Claude Code, Cursor, Copilot,
   Gemini Code Assist, Aider, AGENTS.md).
2. Write a small block between `<!-- BEGIN INFERLANE v1 -->` and
   `<!-- END INFERLANE v1 -->` markers to each applicable file.
3. Leave existing content untouched.
4. Report exactly what changed.

## Scopes

```sh
# Global — writes to ~/.claude/CLAUDE.md only
npx @inferlane/mcp-server inferlane-persist --scope=global

# Project — writes to ./CLAUDE.md, ./.cursorrules, ./AGENTS.md, etc.
npx @inferlane/mcp-server inferlane-persist --scope=project

# Both (default) — global + project
npx @inferlane/mcp-server inferlane-persist
```

## Dry run

See what would be written without actually writing anything:

```sh
npx @inferlane/mcp-server inferlane-persist --dry-run
```

## Uninstall

Removes exactly the block the installer added. Never touches anything
outside the markers. Files we created will be removed if our block was
the only content.

```sh
npx @inferlane/mcp-server inferlane-unpersist
```

## What gets written

The activation block is the `templates/activation.md` shipped in the
package. Current content at a glance:

- Before any non-trivial LLM call, consider a cheaper model — don't
  default to Opus or reasoning models by reflex.
- If local inference is available, prefer it for non-critical work.
- Use `pick_model` / `assess_routing` / `triage` when unsure.
- Log requests via `log_request`.
- Report spend via `get_spend_summary` / `session_cost`.

You can review or edit the template at
`node_modules/@inferlane/mcp-server/templates/activation.md` after
install if you want to customise it for your team.

## Where it writes

| Client | File | Auto-create? |
|---|---|---|
| Claude Code (global) | `~/.claude/CLAUDE.md` | Yes |
| Claude Code (project) | `./CLAUDE.md` | Yes |
| Cursor | `./.cursorrules` | No — only if you already use it |
| GitHub Copilot | `./.github/copilot-instructions.md` | No |
| Gemini Code Assist | `./.gemini/styleguide.md` | No |
| Aider | `./CONVENTIONS.md` | No |
| Cross-client convention | `./AGENTS.md` | No |

"No" means we won't create the file if you don't already have it — we
only update files that belong to clients you've opted into.

## Idempotent

Re-running the installer doesn't duplicate the block. If our block is
already present, it's replaced in place (which also upgrades from older
versions automatically). Running against a fresh project and then
immediately re-running will report `0 files changed`.

## Why not just edit `~/.claude/CLAUDE.md` manually?

You can. This installer exists because:

1. It handles multiple LLM clients at once.
2. It's reversible — `inferlane-unpersist` cleans exactly what was
   added.
3. It upgrades automatically when the template changes — old versions
   of the block are matched by the `v\d+` marker pattern and replaced.
4. It's safe to re-run in CI or on every plugin upgrade.

## Security

- The installer never reads files outside the targets listed above.
- It never writes outside its own marker block.
- It never makes network calls.
- Everything it does is visible in a dry run.
- Source: `packages/mcp-server/bin/inferlane-persist.mjs`

## Using with Claude Code plugins

If you install InferLane via the Claude Code plugin rather than npm,
the plugin will run the installer for you during setup. You can still
invoke it manually to re-apply or migrate:

```sh
npx @inferlane/mcp-server inferlane-persist
```
