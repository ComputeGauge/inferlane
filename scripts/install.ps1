# InferLane — one-line installer for Windows (PowerShell)
#
# Usage:
#   iwr -useb https://install.inferlane.dev/ps1 | iex
#   iwr -useb https://install.inferlane.dev/ps1 | % { & ([ScriptBlock]::Create($_)) -Mode operator }
#
# Modes:
#   mcp       Install MCP plugin for Claude Code (default)
#   operator  Install node daemon for compute operators
#   both      Install both
#
# Requirements:
#   - Node.js >=20 (https://nodejs.org/)
#   - Claude Code (for mcp mode) — see https://claude.com/claude-code
#
# Re-running this script is safe; it updates to the latest versions.

param(
    [ValidateSet('mcp', 'operator', 'both')]
    [string]$Mode = 'mcp'
)

$ErrorActionPreference = 'Stop'

function Write-Log  ([string]$msg) { Write-Host "[InferLane] $msg" -ForegroundColor Cyan }
function Write-Ok   ([string]$msg) { Write-Host "[InferLane] $msg" -ForegroundColor Green }
function Write-Warn2([string]$msg) { Write-Host "[InferLane] $msg" -ForegroundColor Yellow }
function Write-Die  ([string]$msg) { Write-Host "[InferLane] $msg" -ForegroundColor Red; exit 1 }

# ── platform detection ──────────────────────────────────────────────────────
$arch = switch ($env:PROCESSOR_ARCHITECTURE) {
    'AMD64' { 'x64' }
    'ARM64' { 'arm64' }
    default { Write-Die "Unsupported architecture: $($env:PROCESSOR_ARCHITECTURE)" }
}

Write-Log "Platform: Windows $arch"
Write-Log "Mode: $Mode"

# ── node prerequisite ───────────────────────────────────────────────────────
try {
    $nodeVer = (node -v) 2>&1
    $nodeMajor = [int]($nodeVer -replace '^v(\d+).*', '$1')
    if ($nodeMajor -lt 20) {
        Write-Die "Node.js 20+ required (found $nodeVer). Upgrade from https://nodejs.org/"
    }
    Write-Ok "Node.js $nodeVer"
} catch {
    Write-Die "Node.js not found. Install Node >=20 from https://nodejs.org/ and re-run."
}

# ── mcp plugin install ──────────────────────────────────────────────────────
function Install-Mcp {
    Write-Log "Installing @inferlane/mcp..."

    $claude = Get-Command claude -ErrorAction SilentlyContinue
    if (-not $claude) {
        Write-Warn2 "Claude Code CLI not found. Install from https://claude.com/claude-code before using the plugin."
        Write-Warn2 "Continuing — the MCP package will still install globally."
    }

    # Ensure package is fetchable / cached
    & npm exec --package=@inferlane/mcp@latest -- inferlane-mcp --version 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Fetching @inferlane/mcp@latest..."
        & npm exec --package=@inferlane/mcp@latest -- inferlane-mcp --version
        if ($LASTEXITCODE -ne 0) { Write-Die "Failed to fetch MCP package" }
    }
    Write-Ok "MCP package ready"

    if ($claude) {
        Write-Log "Installing Claude Code plugin..."
        & claude plugins install inferlane@marketplace
        if ($LASTEXITCODE -ne 0) {
            Write-Warn2 "Plugin install returned non-zero; check 'claude plugins list'"
        }
    }

    Write-Ok "MCP installed"
    Write-Host ""
    Write-Log "Next steps:"
    Write-Log "  1. Open your Claude Code session"
    Write-Log "  2. The fuel gauge auto-starts at http://localhost:7070/dashboard"
    Write-Log "  3. Set budgets (optional): claude plugins configure inferlane"
}

# ── operator daemon install ─────────────────────────────────────────────────
function Install-Operator {
    Write-Log "Installing @inferlane/node-daemon..."

    $installDir = Join-Path $env:USERPROFILE ".inferlane"
    if (-not (Test-Path $installDir)) {
        New-Item -ItemType Directory -Path $installDir | Out-Null
    }

    Write-Log "Fetching daemon package..."
    Push-Location $installDir
    try {
        & npm install @inferlane/node-daemon@latest 2>&1 | Select-Object -Last 10 | Out-Host
        if ($LASTEXITCODE -ne 0) { Write-Die "Daemon install failed. See $installDir for logs." }
    } finally {
        Pop-Location
    }

    $daemonCmd = Join-Path $installDir "node_modules\.bin\inferlane-node.cmd"
    if (-not (Test-Path $daemonCmd)) {
        Write-Die "Daemon binary not found at $daemonCmd"
    }

    # Add to user PATH if not already there
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $binDir = Join-Path $installDir "node_modules\.bin"
    if ($userPath -notlike "*$binDir*") {
        [Environment]::SetEnvironmentVariable("Path", "$userPath;$binDir", "User")
        Write-Ok "Added $binDir to User PATH (restart terminal to use 'inferlane-node')"
    } else {
        Write-Ok "PATH already includes daemon bin"
    }

    Write-Ok "Operator daemon installed"
    Write-Host ""
    Write-Log "Next steps (new terminal required for PATH update):"
    Write-Log "  1. Register: inferlane-node register"
    Write-Log "  2. Start:    inferlane-node start"
    Write-Log "  3. Earnings: inferlane-node earnings"
    Write-Host ""
    Write-Log "Operator Agreement: https://inferlane.dev/operator-agreement"
    Write-Log "Acceptable Use:     https://inferlane.dev/aup"
}

# ── run ─────────────────────────────────────────────────────────────────────
switch ($Mode) {
    'mcp'      { Install-Mcp }
    'operator' { Install-Operator }
    'both'     { Install-Mcp; Write-Host ""; Install-Operator }
}

Write-Host ""
Write-Ok "Done. Community: https://inferlane.dev/community"
