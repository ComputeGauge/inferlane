#!/usr/bin/env bash
# ============================================================================
# InferLane Local Setup
# ----------------------------------------------------------------------------
# One-command installer that gets you running InferLane with a free local
# model (Gemma 4 via Ollama), so routine tasks never hit the Claude API.
#
# What it does:
#   1. Detects your platform (macOS / Linux)
#   2. Installs Ollama if missing
#   3. Starts the Ollama daemon
#   4. Pulls an appropriately sized Gemma 4 model for your RAM
#   5. Verifies the model works with a smoke test
#   6. Prints the exact config block to add to Claude Code / Desktop / Goose
#
# Usage:
#   curl -fsSL https://inferlane.dev/install.sh | bash
#   # or
#   npx @inferlane/mcp local-setup
#
# Safe to re-run: every step is idempotent.
# ============================================================================

set -euo pipefail

# ─── Styling ──────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  BOLD="$(printf '\033[1m')"; DIM="$(printf '\033[2m')"
  RED="$(printf '\033[31m')"; GREEN="$(printf '\033[32m')"
  YELLOW="$(printf '\033[33m')"; BLUE="$(printf '\033[34m')"
  CYAN="$(printf '\033[36m')"; RESET="$(printf '\033[0m')"
else
  BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; BLUE=""; CYAN=""; RESET=""
fi

step()    { printf "\n${BOLD}${BLUE}▸${RESET} ${BOLD}%s${RESET}\n" "$1"; }
info()    { printf "  ${DIM}%s${RESET}\n" "$1"; }
success() { printf "  ${GREEN}✓${RESET} %s\n" "$1"; }
warn()    { printf "  ${YELLOW}!${RESET} %s\n" "$1"; }
err()     { printf "  ${RED}✗${RESET} %s\n" "$1" >&2; }
die()     { err "$1"; exit 1; }

# ─── Banner ───────────────────────────────────────────────────────────────
printf "${BOLD}${CYAN}"
cat <<'BANNER'
┌──────────────────────────────────────────────────────────┐
│              InferLane Local Setup                      │
│  Run routine AI tasks for free on your own hardware.    │
└──────────────────────────────────────────────────────────┘
BANNER
printf "${RESET}\n"

# ─── Detect platform ──────────────────────────────────────────────────────
step "Detecting platform"
OS="$(uname -s)"
ARCH="$(uname -m)"
case "$OS" in
  Darwin) PLATFORM="macos" ;;
  Linux)  PLATFORM="linux" ;;
  *)      die "Unsupported OS: $OS. InferLane local setup currently supports macOS and Linux." ;;
esac
success "Platform: $PLATFORM ($ARCH)"

# ─── Detect RAM to pick the right model size ─────────────────────────────
step "Checking system memory"
if [ "$PLATFORM" = "macos" ]; then
  RAM_BYTES=$(sysctl -n hw.memsize 2>/dev/null || echo 0)
else
  # Linux: use /proc/meminfo MemTotal (KB)
  RAM_KB=$(awk '/^MemTotal:/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)
  RAM_BYTES=$((RAM_KB * 1024))
fi
RAM_GB=$((RAM_BYTES / 1024 / 1024 / 1024))
success "${RAM_GB} GB RAM detected"

# Pick model size based on RAM. These are conservative — leave headroom for OS+apps.
# Gemma 4 variants on Ollama (approximate disk/memory footprint):
#   gemma4:2b    ~2 GB   — fits anywhere
#   gemma4:4b    ~4 GB   — 8 GB minimum system
#   gemma4       ~10 GB  — 16 GB recommended (MoE, ~4B active)
#   gemma4:26b   ~17 GB  — 32 GB recommended
if [ "$RAM_GB" -ge 32 ]; then
  MODEL_TAG="gemma4"
  MODEL_LABEL="Gemma 4 26B (~10 GB)"
elif [ "$RAM_GB" -ge 16 ]; then
  MODEL_TAG="gemma4"
  MODEL_LABEL="Gemma 4 26B (~10 GB)"
elif [ "$RAM_GB" -ge 8 ]; then
  MODEL_TAG="gemma4:4b"
  MODEL_LABEL="Gemma 4 4B (~4 GB)"
else
  MODEL_TAG="gemma4:2b"
  MODEL_LABEL="Gemma 4 2B (~2 GB)"
fi
info "Recommended model for your hardware: ${BOLD}${MODEL_LABEL}${RESET}"

# ─── Install Ollama if missing ────────────────────────────────────────────
step "Checking for Ollama"
if command -v ollama >/dev/null 2>&1; then
  OLLAMA_VERSION="$(ollama --version 2>&1 | head -1 | awk '{print $NF}')"
  success "Ollama already installed ($OLLAMA_VERSION)"
else
  warn "Ollama not found — installing"
  if [ "$PLATFORM" = "macos" ]; then
    if command -v brew >/dev/null 2>&1; then
      info "Using Homebrew"
      brew install ollama || die "brew install ollama failed"
    else
      info "Homebrew not found — using the Ollama installer script"
      curl -fsSL https://ollama.com/install.sh | sh || die "Ollama install failed"
    fi
  else
    info "Using the Ollama installer script"
    curl -fsSL https://ollama.com/install.sh | sh || die "Ollama install failed"
  fi
  success "Ollama installed"
fi

# ─── Start Ollama daemon ──────────────────────────────────────────────────
step "Starting Ollama daemon"
if curl -sf http://localhost:11434/api/version >/dev/null 2>&1; then
  success "Ollama is already running"
else
  info "Launching Ollama in the background"
  if [ "$PLATFORM" = "macos" ] && command -v brew >/dev/null 2>&1; then
    brew services start ollama >/dev/null 2>&1 || true
  else
    # Fallback: direct daemon spawn, detached
    nohup ollama serve >/tmp/ollama.log 2>&1 &
    disown 2>/dev/null || true
  fi
  # Wait up to 20s for the daemon to come up
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -sf http://localhost:11434/api/version >/dev/null 2>&1; then
      success "Ollama daemon is up"
      break
    fi
    sleep 2
  done
  curl -sf http://localhost:11434/api/version >/dev/null 2>&1 \
    || die "Ollama daemon failed to start. Check /tmp/ollama.log for details."
fi

# ─── Pull the model ───────────────────────────────────────────────────────
step "Pulling ${MODEL_TAG}"
# Check if already present
if ollama list 2>/dev/null | awk '{print $1}' | grep -qx "${MODEL_TAG}"; then
  success "${MODEL_TAG} is already downloaded"
else
  info "This may take several minutes depending on your connection"
  ollama pull "${MODEL_TAG}" || die "Failed to pull ${MODEL_TAG}"
  success "${MODEL_TAG} downloaded"
fi

# ─── Smoke test ───────────────────────────────────────────────────────────
step "Smoke-testing the model"
RESPONSE=$(curl -sf -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  --data "{\"model\":\"${MODEL_TAG}\",\"prompt\":\"Reply with exactly one word: OK\",\"stream\":false,\"options\":{\"num_predict\":5}}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('response','').strip())" 2>/dev/null || true)

if [ -z "$RESPONSE" ]; then
  err "Smoke test failed — no response from Ollama"
  warn "The model downloaded but didn't generate. Check: ollama run ${MODEL_TAG}"
  exit 1
fi
success "Model responds: ${DIM}\"$(echo "$RESPONSE" | head -c 60)\"${RESET}"

# ─── Print the config block ──────────────────────────────────────────────
step "Configuration — add this to your MCP client"

cat <<CONFIG

${BOLD}Claude Code${RESET} (${DIM}~/.claude/mcp.json${RESET}) — add to mcpServers:
${GREEN}
  "inferlane": {
    "command": "npx",
    "args": ["-y", "@inferlane/mcp@latest"],
    "env": {
      "INFERLANE_LOCAL_MODEL": "${MODEL_TAG}",
      "OLLAMA_HOST": "http://localhost:11434"
    }
  }
${RESET}

${BOLD}Claude Desktop${RESET} (${DIM}~/Library/Application Support/Claude/claude_desktop_config.json${RESET}):
${GREEN}
  "mcpServers": {
    "inferlane": {
      "command": "npx",
      "args": ["-y", "@inferlane/mcp@latest"],
      "env": {
        "INFERLANE_LOCAL_MODEL": "${MODEL_TAG}",
        "OLLAMA_HOST": "http://localhost:11434"
      }
    }
  }
${RESET}

${BOLD}Goose${RESET} (${DIM}~/.config/goose/config.yaml${RESET}) — under extensions:
${GREEN}
  inferlane:
    type: stdio
    enabled: true
    cmd: npx
    args: ["-y", "@inferlane/mcp@latest"]
    envs:
      INFERLANE_LOCAL_MODEL: "${MODEL_TAG}"
      OLLAMA_HOST: "http://localhost:11434"
    timeout: 60
${RESET}
CONFIG

# ─── Final summary ────────────────────────────────────────────────────────
printf "\n${BOLD}${GREEN}━━━ Ready ━━━${RESET}\n"
info "Local model:  ${BOLD}${MODEL_TAG}${RESET}"
info "Endpoint:     http://localhost:11434"
info "Cost:         \$0.00 per token"
info "Privacy:      Runs 100% on your machine — no data leaves your device"
printf "\n"
info "${DIM}Next: restart Claude Code / Claude Desktop / Goose to pick up the new config.${RESET}"
info "${DIM}Test: ask Claude \"What's the cheapest model for a simple extraction task?\"${RESET}"
info "${DIM}     InferLane should now recommend ${MODEL_TAG} for routine tasks.${RESET}"
printf "\n"
