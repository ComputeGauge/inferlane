#!/usr/bin/env bash
# InferLane — one-line installer
#
# Usage:
#   curl -fsSL https://install.inferlane.dev | bash
#   curl -fsSL https://install.inferlane.dev | bash -s -- --mode operator
#
# Modes:
#   mcp       Install MCP plugin for Claude Code (default)
#   operator  Install node daemon for compute operators
#   both      Install both
#
# Requirements:
#   - Node.js ≥20 (https://nodejs.org/)
#   - Claude Code (for mcp mode) — see https://claude.com/claude-code
#
# This script is idempotent. Re-running updates to the latest versions.

set -euo pipefail

# ── colour output (no-op in non-tty) ────────────────────────────────────────
if [ -t 1 ]; then
  BOLD="$(printf '\033[1m')"
  DIM="$(printf '\033[2m')"
  RED="$(printf '\033[31m')"
  GREEN="$(printf '\033[32m')"
  AMBER="$(printf '\033[33m')"
  BLUE="$(printf '\033[34m')"
  RESET="$(printf '\033[0m')"
else
  BOLD=""; DIM=""; RED=""; GREEN=""; AMBER=""; BLUE=""; RESET=""
fi

log()  { printf "%s[InferLane]%s %s\n" "$BLUE" "$RESET" "$1"; }
ok()   { printf "%s[InferLane]%s %s%s%s\n" "$GREEN" "$RESET" "$GREEN" "$1" "$RESET"; }
warn() { printf "%s[InferLane]%s %s%s%s\n" "$AMBER" "$RESET" "$AMBER" "$1" "$RESET"; }
die()  { printf "%s[InferLane]%s %s%s%s\n" "$RED" "$RESET" "$RED" "$1" "$RESET" >&2; exit 1; }

# ── arg parsing ─────────────────────────────────────────────────────────────
MODE="mcp"
while [ $# -gt 0 ]; do
  case "$1" in
    --mode) MODE="$2"; shift 2 ;;
    --mode=*) MODE="${1#*=}"; shift ;;
    --help|-h)
      cat <<EOF
InferLane installer

Usage:
  curl -fsSL https://install.inferlane.dev | bash [-- --mode MODE]

Modes:
  mcp       Install MCP plugin for Claude Code (default)
  operator  Install node daemon for compute operators
  both      Install both

Examples:
  # default: just the Claude Code plugin
  curl -fsSL https://install.inferlane.dev | bash

  # operator (run a node, earn credits):
  curl -fsSL https://install.inferlane.dev | bash -s -- --mode operator

  # both:
  curl -fsSL https://install.inferlane.dev | bash -s -- --mode both
EOF
      exit 0 ;;
    *) die "Unknown argument: $1 (try --help)" ;;
  esac
done

case "$MODE" in
  mcp|operator|both) ;;
  *) die "Invalid --mode: $MODE (must be mcp, operator, or both)" ;;
esac

# ── platform detection ──────────────────────────────────────────────────────
UNAME_S="$(uname -s)"
UNAME_M="$(uname -m)"
case "$UNAME_S" in
  Darwin) PLATFORM="macos" ;;
  Linux)  PLATFORM="linux" ;;
  *)      die "Unsupported platform: $UNAME_S (Windows users: use install.ps1)" ;;
esac

case "$UNAME_M" in
  arm64|aarch64) ARCH="arm64" ;;
  x86_64|amd64)  ARCH="x64" ;;
  *) die "Unsupported architecture: $UNAME_M" ;;
esac

log "Platform: ${BOLD}${PLATFORM} ${ARCH}${RESET}"
log "Mode: ${BOLD}${MODE}${RESET}"

# ── node prerequisite ───────────────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1; then
  die "Node.js not found. Install Node ≥20 from https://nodejs.org/ and re-run."
fi

NODE_MAJOR="$(node -e 'console.log(process.versions.node.split(".")[0])')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  die "Node.js 20+ required (found v${NODE_MAJOR}). Upgrade and re-run."
fi
ok "Node.js $(node -v)"

# ── mcp plugin install ──────────────────────────────────────────────────────
install_mcp() {
  log "Installing @inferlane/mcp..."
  if ! command -v claude >/dev/null 2>&1; then
    warn "Claude Code CLI not found. Install from https://claude.com/claude-code before using the plugin."
    warn "Continuing — the MCP package will still install globally so future Claude Code sessions can find it."
  fi

  # Ensure the package is fetchable (cache warm + version pinned to latest major)
  if npm exec --package=@inferlane/mcp@latest -- inferlane-mcp --version >/dev/null 2>&1; then
    ok "MCP package cached"
  else
    log "Fetching @inferlane/mcp@latest..."
    npm exec --package=@inferlane/mcp@latest -- inferlane-mcp --version || die "Failed to fetch MCP package"
  fi

  # Install the Claude Code plugin (if claude CLI available)
  if command -v claude >/dev/null 2>&1; then
    log "Installing Claude Code plugin..."
    claude plugins install inferlane@marketplace || warn "Plugin install returned non-zero; check 'claude plugins list'"
  fi

  ok "MCP installed"
  echo ""
  log "Next steps:"
  log "  1. Open your Claude Code session"
  log "  2. The fuel gauge auto-starts at ${BOLD}http://localhost:7070/dashboard${RESET}"
  log "  3. Set budgets (optional): ${DIM}claude plugins configure inferlane${RESET}"
}

# ── operator daemon install ─────────────────────────────────────────────────
install_operator() {
  log "Installing @inferlane/node-daemon..."

  INSTALL_DIR="${HOME}/.inferlane"
  mkdir -p "$INSTALL_DIR"

  # Fetch the daemon package to a known location
  log "Fetching daemon package..."
  if ! npm install --prefix "$INSTALL_DIR" @inferlane/node-daemon@latest 2>&1 | tail -5; then
    die "Daemon install failed. See $INSTALL_DIR for logs."
  fi

  DAEMON_BIN="$INSTALL_DIR/node_modules/.bin/inferlane-node"
  if [ ! -x "$DAEMON_BIN" ]; then
    die "Daemon binary not found at $DAEMON_BIN"
  fi

  # Symlink to /usr/local/bin if writable; otherwise to ~/.local/bin
  LINK_DIRS=("/usr/local/bin" "${HOME}/.local/bin")
  LINKED=""
  for dir in "${LINK_DIRS[@]}"; do
    mkdir -p "$dir" 2>/dev/null || continue
    if [ -w "$dir" ]; then
      ln -sf "$DAEMON_BIN" "$dir/inferlane-node"
      LINKED="$dir/inferlane-node"
      break
    fi
  done
  if [ -z "$LINKED" ]; then
    warn "Couldn't symlink to a bin directory. Add this to your PATH manually:"
    warn "  export PATH=\"$INSTALL_DIR/node_modules/.bin:\$PATH\""
  else
    ok "Linked: $LINKED"
  fi

  ok "Operator daemon installed"
  echo ""
  log "Next steps:"
  log "  1. Register: ${BOLD}inferlane-node register${RESET}"
  log "  2. Start:    ${BOLD}inferlane-node start${RESET}"
  log "  3. Earnings: ${BOLD}inferlane-node earnings${RESET}"
  log ""
  log "Operator Agreement: ${DIM}https://inferlane.dev/operator-agreement${RESET}"
  log "Acceptable Use:     ${DIM}https://inferlane.dev/aup${RESET}"
}

# ── run ─────────────────────────────────────────────────────────────────────
case "$MODE" in
  mcp)      install_mcp ;;
  operator) install_operator ;;
  both)     install_mcp; echo ""; install_operator ;;
esac

echo ""
ok "Done. Community: https://inferlane.dev/community"
