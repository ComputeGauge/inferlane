# Contributing to InferLane

Thanks for considering contributing. The short version: we're a small team
building a community-owned AI inference network, we can't pay cash bounties
yet, but we can reward you with network credits, badges, and genuine influence
over the roadmap. If that sounds fair, read on.

## Who should contribute?

- **Developers** comfortable with TypeScript / Rust / Swift / SQL
- **Operators** running our daemon who want to shape what it does
- **Technical writers** who'd rather write crisp docs than ship ads
- **Researchers** with LLM / quantization / inference-routing expertise
- **Hardware enthusiasts** benchmarking their Mac minis / gaming rigs / GPU
  servers under real workloads

You don't need to be Australian. You don't need to know us. You don't need
permission to start — just open an issue or PR.

## What to work on

We keep a public [ROADMAP](./ROADMAP.md) and label GitHub issues:

- `good-first-issue` — small, clear scope, entry points for new contributors
- `help-wanted` — items we'd love help on but can't prioritise ourselves
- `roadmap-suggestion` — community proposals under discussion
- `help-wanted:large` — multi-week efforts worth committing to; coordinate
  with us before starting
- `docs` — anything writing-related
- `benchmark` — hardware benchmark submissions welcome, see
  `docs/benchmarks/README.md`

## How we reward contributions (no cash, yet)

When cash payouts launch (see [ROADMAP](./ROADMAP.md)), contributors with
vested kT balances can redeem at the same rate as operators. Until then:

| Contribution | Reward |
|---|---|
| Merged feature PR (`help-wanted`) | **50,000 kT** (~50M Llama 70B tokens) + contributor badge |
| Merged bug fix | **10,000 kT** + fix credit in release notes |
| Merged `help-wanted:large` | **150,000 kT** + public shout-out + Community Council consideration |
| Significant docs contribution | **5,000 kT** + docs-champion badge |
| Benchmark submission accepted | **2,000 kT** + entry in the public benchmark registry |
| Translation accepted | **5,000 kT** + translator badge |
| First-time contributor | **Bonus 2,500 kT** on your first merged PR |

Credits earned through contributions never expire (unlike standard operator
credits which expire at 6 months). They also stack with cash payouts when
those go live.

## Contribution tier ladder (the marketplace, when it launches)

Not every contribution is a merged PR. Starting in month 2-3 we'll open a
tiered marketplace so contributors can ship standalone components and earn
revenue-share on adoption, not just kT. Security-tiered so third-party code
never compromises the network:

| Tier | What it is | Review gate | Reward |
|---|---|---|---|
| **UI Widget** | React component rendered in iframe on the dashboard. Pure client-side, postMessage API only. No server/backend access. | Core team review + published to `@inferlane-community/*` npm scope | **40% of MRR** from users who activated the widget in prior 30 days (last-touch attribution, 30-day clawback on churn) |
| **Routing Policy** | Declarative JSON rules ("route Haiku for task X under $Y"). Data, not code. Runs through our safe evaluator. | Lint + schema validation — no human review | **kT bonus** per 1k adoptions |
| **Dashboard Theme** | CSS variables + token set. Visual only. | Lint + visual review | **kT bonus** + `theme-creator` badge |
| **Integration Recipe** | Pre-baked config for Slack/Linear/Discord/Notion webhook alerts. | Core team review | **30% of recipe-driven conversions** (e.g. user installs Slack recipe and upgrades to MCP Pro) |
| **Provider Adapter** | New LLM backend route (e.g. Cerebras, Mistral Hosted, SambaNova). | Full PR review, merged into main product | **50,000 kT merged** + negotiated revenue share for commercial adapters |
| **Daemon Plugin** | Operator-side logic: custom benchmarks, fleet coordination, regional routing. | PR-only, full code audit, signed releases, security review | **150,000 kT merged** + negotiated revshare for commercial plugins |

**Attribution rules** (to prevent gaming):
- Install events logged server-side, not trusted from client
- 30-day last-touch attribution window
- Refund clawback: user churn within 30 days refunds attribution
- Single creator capped at 15% of total platform revenue (prevents concentration risk)
- Verified identity via GitHub OAuth or Stripe Connect before any cash payout

**Phased launch:**
- **V1 (month 2-3)**: UI Widget + Routing Policy + Dashboard Theme. Pure client-side / data-only. No server surface for third-party code.
- **V2 (month 4-6)**: Integration Recipe + Provider Adapter. Heavier review, higher revshare.
- **V3 (month 6+)**: Daemon Plugin. Signed code only, full audit required.

## How to submit

1. **Check** the [ROADMAP](./ROADMAP.md) and open issues. If what you want to
   do isn't there, open a `roadmap-suggestion` issue *first*. It's cheaper
   than building the wrong thing.
2. **Fork + branch** — one feature per PR, clear commit messages, reference
   the issue number.
3. **Tests** — new code has tests. We won't block on 100% coverage, but
   happy-path + error-path at minimum.
4. **Conventional commits** — `feat(daemon): add SGX attestation handler`,
   `fix(mcp): don't double-count cache tokens in fuel gauge`, `docs: clarify
   operator payout timing`.
5. **Sign the DCO** — `git commit -s` on every commit. This asserts you have
   the right to contribute the code. No CLA, no copyright transfer.
6. **Open a PR** — describe the problem, the solution, and how you tested it.
   Link the issue. Screenshots / console logs if UI or daemon changes.

## Review expectations

- Target first-response SLA: **72 hours**. If we miss it, ping us in Discord.
- PRs we can't merge get explained, not ignored.
- We squash-merge. Your authorship is preserved in the commit trailer.
- If we ship your code in a release, you're credited in the release notes +
  your operator profile gets a `contributor` badge if you have one.

## Code of conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md). Short version: be the kind of
person others want to build with.

## What you won't get

- Cash bounties — can't afford them, won't pretend we can
- Equity or tokens — kT is internal network accounting, not an investment
  instrument
- Promised jobs — if we hire you later it's because we both think it's a fit,
  not because you contributed
- Secret access — everything we ship is either open-source or documented
  publicly

## Community Council (month 2+)

Once we have a rhythm of contributions, five seats open for a quarterly
rotation. Seats go to the top merged-code contributors and top
transparency-report reviewers over the prior quarter. The Council has
**advisory** influence on the roadmap (not veto), gets early-access to
architectural RFCs, and sits in a private Discord channel with the core team.

If you want to be on the Council, just contribute visibly for a quarter. We
notice.

## Questions

- GitHub discussions → fastest for public technical questions
- Discord `#contributing` → fastest for "how do I get started"
- Email (founders) → for anything that needs privacy or you'd rather not post
