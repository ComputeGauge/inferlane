# Roadmap

Public, honest, and updated as we ship. Nothing here is a promise — it's what
we're working on and in what order. If something matters to you, open a
discussion and we'll move it or mark it `help-wanted`.

**Legend:** ✅ shipped · 🛠 building now · 📅 next · 💭 considering · ❌ ruled out

---

## ✅ Shipped

- `@inferlane/mcp@0.7.0` — 49 MCP tools for model selection, spend tracking,
  routing, credibility scoring. Published on npm.
- Local-first **Compute Fuel Gauge** — `http://localhost:7070/dashboard`. Reads
  usage directly from `~/.claude/projects/*.jsonl`. Zero network, zero API key.
- **Claude Code usage auto-ingest** — per-user spend reflected without any
  manual logging.
- Claude Code plugin v1.1.0 — installs MCP + prompts for budgets + starts the
  local dashboard automatically.
- OpenAI-compatible `/v1/chat/completions` endpoint with moderation gate +
  Bearer-token auth.
- DarkBloom adapter (inference routing target — live).

## 🛠 Building now (sprint of ~2 weeks)

- **Real network crypto** — replace the base64 placeholder in
  `packages/daemon` with X25519 + AES-GCM. Baseline security is non-negotiable
  before anyone onboards as an operator.
- **kT credit ledger** — the "solar-battery" bootstrap model. Earn credits by
  serving inference on your Mac mini; spend them on inference from others.
  Closed internal economy; cash redemption comes later.
- **Cross-platform one-line installer** — `curl -fsSL install.inferlane.dev |
  bash` for macOS, Linux, and Windows (WSL) GPU operators.
- **Operator profiles + public contribution leaderboard** — pseudonymous,
  opt-in, framed as "top contributors this week" not "top earners".
- **Community Discord** — `#help-me-model`, `#new-operators`, `#benchmarks`,
  `#roadmap-requests`.

## 📅 Next (weeks 3–6)

- **MCP Pro subscription** — $10/mo team features: shared budgets, Slack
  alerts, historical export, SSO.
- **BYO-key routing markup** — route your Claude / OpenAI / Gemini traffic
  through us with a 5% margin; we never see your prompts (passthrough only).
- **Badges** — `OG-100`, `reliable-operator-30d`, `multi-model-host`,
  `10-merged-PR-club`.
- **Transparency report** — monthly auto-generated aggregates: tokens served,
  unique operators, unique consumers, credits in circulation, revenue, treasury.
- **Phala TEE partnership** — outreach, then route our privacy tier through
  their decentralised Intel SGX/TDX network.
- **Model catalogue** — curated open-weight models with hardware-class
  recommendations. Community-submitted benchmarks tied to operator hardware
  profiles.

## 💭 Considering (open questions)

- **Contributor marketplace** — UI widgets, dashboard themes, routing
  policies, integration recipes, provider adapters. Security-tiered:
  client-side widgets (low risk) and JSON policies (no code) launch first.
  Revenue share: 30-50% of attributed MRR for UI/integrations; kT bonuses
  for data-only contributions; 150k kT + negotiated revshare for daemon
  plugins. Creator dashboard shows installs, MRR attributed, payouts.
  Draws inspiration from Roblox Dev Exchange and Minecraft Marketplace.
  Target: v1 pilot in month 2-3 with UI + policy tiers only. See
  [CONTRIBUTING.md](./CONTRIBUTING.md) for the contribution tier ladder.
- **Public `/roadmap` and `/community` pages** — this file rendered as a
  live webpage with 👍 voting per item, a contributor wall, Discord CTA,
  and upcoming community-call schedule.
- **Gaming-rig operator class** — NVIDIA RTX 40/50-series + Apple Silicon
  Macs overlap heavily with the modding community (FiveM, Minecraft server
  owners, Roblox creators). Two-in-one conversion: their rig serves
  inference AND they contribute widgets/policies for their niches. No
  special product work beyond the existing cross-platform daemon +
  marketplace; dedicated recruitment channel.
- **Operator-modded dashboards + affinity routing** — top-performing
  operators get a customisable public dashboard (logo, theme, featured
  widgets, bio, benchmarks). Consumers visiting an operator's branded
  dashboard get affinity-routed to that operator's node when hardware
  and model requirements match. Operators can strike independent
  affiliate/sponsorship deals with widget creators via the marketplace;
  we facilitate attribution and payment splits on-platform. Inspired by
  Roblox experiences + Twitch affiliate programmes. Security boundary:
  operator dashboards are rendered from a sandboxed subset of the same
  marketplace components (no arbitrary HTML / JS injection). Target: v2
  post-marketplace launch (month 4-6).
- **Cash payouts** — **Not currently offered.** The Service operates in
  credits-only mode: kT credits are earned for serving inference and are
  redeemable for inference on the network; they do not convert to cash.
  If we introduce a cash pathway in the future it will be a separate,
  distinct commercial arrangement requiring affirmative opt-in by
  operators, acceptance of new path-specific terms, and completion of
  identity verification. Existing kT balances would not be converted
  as part of any such future change. No timeline; no commitment.
- **Frontier open-weight on DC partners** (IREN / Applied Digital / Crusoe /
  Core Scientific) — only after active-user + MRR base justifies a pilot
  prepay. Month 3+.
- **Enterprise tier** — SSO, audit logs, on-prem, SLA. Driven by first three
  inbound enterprise conversations, not speculative build.
- **Claude Code native integrations beyond the plugin** — statusline,
  slash-commands, chat-side gauge display.
- **Community Council** — 5 seats, rotating quarterly, top-contributor voted,
  advisory not binding. Month 2.
- **Additional compute-utility SKUs on the same peer infra** — iOS/macOS
  CI build farms, video transcoding, RAG indexing. Opt-in per operator.
- **Provider adapters for Bittensor subnets, Akash, io.net** — if we see
  consumer demand for that kind of privacy/pricing mix.

## ❌ Ruled out

- **Cryptocurrency / token** — kT credits are internal accounting, not
  tradable. No ICO, no airdrop. Cash redemption when it exists is plain USD.
- **Game-server hosting** — residential ISP conditions kill SLA economics;
  publishers hostile to player-run infra. Not our game.
- **Competing with OpenAI/Anthropic on frontier model quality** — we route
  TO them; we don't try to beat their best.

---

## How to influence this roadmap

1. **Open a discussion** in `#roadmap-requests` on Discord or as a GitHub
   issue tagged `roadmap-suggestion`. Describe the problem, not the solution.
2. **Vote** on existing items via the 👍 reaction. We review top-voted items
   in the monthly community call.
3. **Join the Community Council** (month 2+) — top 5 merged-code contributors
   or top 5 transparency-report feedback contributors rotate in for a quarter.
4. **Contribute code** — pick an `help-wanted` issue, submit a PR.
   See [CONTRIBUTING.md](./CONTRIBUTING.md).

Last updated: 2026-04-22.
