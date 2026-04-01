# InferLane — SaaS Lifecycle Plan

**Based on the universal SaaS lifecycle framework, mapped to our current state.**
**Cross-reference: BUSINESS_PLAN.md (revenue/phases), MOAT_STRATEGY.md (competitive), COMPETITIVE_LANDSCAPE.md**

Legend: DONE | IN PROGRESS | TODO | N/A (not applicable yet)

---

## 1. Idea — DONE

| Step | Status | Notes |
|------|--------|-------|
| Problem Discovery | DONE | AI cost blindness — 85% of companies misestimate, 42% abandoning AI due to costs |
| Market Research | DONE | $1.76T AI spend, $14.9B cloud FinOps market — see BUSINESS_PLAN.md |
| Niche Selection | DONE | "Cost Intelligence Layer for AI Agents" — MCP-first, agent-native |
| Competitor Analysis | DONE | 22 competitors mapped in COMPETITIVE_LANDSCAPE.md — zero dedicated AI FinOps tools |
| Opportunity Mapping | DONE | 6-phase revenue roadmap, $9.1M ARR bull case at M12 |

---

## 2. Validation — TODO (Critical Gap)

| Step | Status | Action |
|------|--------|--------|
| Customer Interviews | TODO | Target 10-15 AI engineers/DevOps leads. Ask: "How do you track AI API costs today?" Use Reddit r/MachineLearning, r/LocalLLaMA, HN, Discord servers |
| Landing Page Test | IN PROGRESS | Landing page built with PostHog analytics integrated. Needs: deploy to inferlane.ai |
| Waitlist | DONE | Email capture form on landing page with /api/waitlist endpoint. Prisma WaitlistEntry model + AuditLog fallback |
| Pre-Sales | TODO | Reach out to 5 AI-heavy startups. Offer free pilot of proxy routing. Validate willingness to pay |
| Demand Testing | TODO | Post on HN "Show HN: InferLane — FinOps for AI APIs". Post on r/MachineLearning. Track signups/week |

**Priority: HIGH — we're building without market signal. Deploy + validate before building Phase 2-6 features.**

---

## 3. Planning — DONE

| Step | Status | Notes |
|------|--------|-------|
| Product Roadmap | DONE | 7 phases (0-6) in BUSINESS_PLAN.md with timelines and revenue targets |
| Feature Prioritization | DONE | Phase 0 (MCP+CLI) → Phase 1 (Dashboard) → Phase 2 (Proxy) → Phase 3 (On-Prem) |
| MVP Scope | DONE | Dashboard + Demo mode + Provider connections + Alerts + Smart Router + Marketplace |
| Tech Stack | DONE | Next.js 16, TypeScript, Tailwind, Prisma 7, PostgreSQL, NextAuth, Stripe |
| Development Plan | DONE | 9-phase build completed. Audit + security hardening done |

---

## 4. Design — DONE

| Step | Status | Action |
|------|--------|--------|
| Wireframes | DONE | Implicit in built dashboard — 6 pages with full layouts |
| UI Design | DONE | Dark theme, glassmorphism cards, gradient accents, Recharts visualizations |
| UX Flows | DONE | Core flows + 3-step onboarding wizard (Welcome → Connect Provider → Set Budget). localStorage-persisted completion state |
| Prototype | DONE | Working demo mode serves as interactive prototype |
| Design System | DONE | CSS custom properties + Tailwind theme tokens (cg-bg, cg-card, cg-border, cg-border-hover, cg-border-subtle, cg-elevated, cg-hover). Components can migrate to semantic tokens incrementally |
| Error Pages | DONE | Custom 404 page, global-error.tsx, dashboard/error.tsx — all branded with InferLane design |

---

## 5. Development — IN PROGRESS

| Step | Status | Notes |
|------|--------|-------|
| Frontend | DONE | 6 dashboard pages + landing page + auth modal. All rendering correctly |
| Backend | DONE | 6 API route groups: providers, alerts, api-keys, proxy, spend, stripe |
| APIs | DONE | Dashboard + providers pages wired to real APIs via useDashboardData/useProviders hooks. Demo mode returns mock data; real users fetch from /api/* |
| Database | DONE | Prisma 7 schema: 17 models including WaitlistEntry. User, Subscription, ProviderConnection, ApiKey, ProxyRequest, Alert, AuditLog |
| Authentication | DONE | NextAuth (Google, Apple, GitHub, Microsoft, email) + demo mode with cookie bypass |
| Integrations | IN PROGRESS | Provider sync service: `src/lib/provider-sync.ts` (adapters for Anthropic, OpenAI, Google). OpenAI adapter uses `/v1/organization/usage/completions` with model-level breakdown + cost estimation. Cron: `/api/cron/sync-usage` writes SpendSnapshot + UsageRecord rows daily. Note: Anthropic/Google lack public usage APIs — spend tracked via proxy |

**Next dev priority: Deploy to Vercel + validate with real users**

---

## 6. Infrastructure — IN PROGRESS

| Step | Status | Action |
|------|--------|--------|
| Cloud Hosting | TODO | Deploy to Vercel. Set up: production env vars, custom domain inferlane.ai, edge functions |
| DevOps | TODO | Vercel auto-deploys from git push to main. Set up: preview deployments for PRs |
| CI/CD | DONE | `.gitlab-ci.yml` — 7 jobs across 3 stages (validate → test → build). Lint, typecheck, vitest, next build, MCP/CLI typecheck, security-audit (`npm audit --audit-level=high`), dependency-check (JSON report artifact). Blocks merge on failure. Uses node:22-alpine with npm cache |
| Monitoring | DONE | PostHog analytics (conditional dynamic import). Sentry error tracking (conditional dynamic import — zero overhead when DSN unset). SentryProvider in component tree. Dashboard error boundary reports to Sentry. Still need: uptime monitoring (BetterStack or UptimeRobot) |
| Security | DONE | AES-256-GCM key vault, API key auth, rate limiting on all endpoints, input validation (provider enum, alert types/channels/thresholds), CSP + HSTS + X-Frame-Options + Referrer-Policy + Permissions-Policy via next.config.ts. Demo cookie Secure flag. TS strict audit: removed 15 unnecessary `as` casts, extended NextAuth session types. HTML escaping in email templates. Timing-safe cron auth. CI `npm audit` + dependency-check jobs. Still need: Redis rate limiter for production |

**Priority: HIGH — can't validate without deploying. This unblocks Validation and Launch.**

---

## 7. Testing — IN PROGRESS

| Step | Status | Action |
|------|--------|--------|
| Unit Testing | DONE | 71 tests passing across 9 suites (crypto, rate-limit, pricing-data, email-validation, types, security-headers, input-validation, api-validation, dashboard-logic). Covers: encryption, rate limiting, validation constants, API route logic, dashboard computations, token formatting, time formatting |
| Integration Testing | DONE | API validation tests cover: email validation + normalization, provider enum validation, alert type/channel/threshold validation, rate limit key formatting, request body parsing safety, default value generation |
| Bug Fixing | DONE | Comprehensive audit: 37 issues found, ALL fixed (5 CRITICAL + 6 HIGH + 8 MEDIUM + 8 LOW). Rate limiting, input validation, ARIA accessibility, escape handlers, dead code removal, type fixes, React.memo, lazy loading, useMemo, conditional imports |
| Performance Testing | IN PROGRESS | Lighthouse perf: DNS prefetch/preconnect for PostHog+Stripe, React.lazy SpendChart, React.memo on list components, useMemo stats, loading skeletons for all 6 dashboard routes. Bundle analyzer configured (`npm run analyze`). API response timing middleware (`withTiming`) added to all API routes — adds Server-Timing headers and logs slow requests (>1s). Still need: proxy latency measurement |
| E2E Testing | DONE | Playwright configured with 10 smoke tests: landing page (hero, MCP snippet, auth modal open/close), demo mode (login, dashboard widgets, user menu), navigation (404 page, nav links). `npm run test:e2e` |
| Beta Testing | TODO | Recruit 5-10 beta testers from validation interviews. Track: errors, confusion points, feature requests |

---

## 8. Launch — TODO

| Step | Status | Action |
|------|--------|--------|
| Landing Page | DONE (code) / TODO (deploy) | Built with hero, features, pricing, FAQ, waitlist capture, SEO (JSON-LD, canonical, OG tags). Needs: deploy to inferlane.ai |
| Show HN Post | DONE (draft) | Improved draft in SHOW_HN_DRAFT.md — 3 title options (ranked), post body, maker comment, pre-post checklist, response templates for likely questions (pricing, open source, Helicone/LangSmith comparison, privacy) |
| Directory Submissions | TODO | 37-platform launch playbook — see Launch Directory Playbook below |
| Beta Users | TODO | Seed from: directory submissions, HN thread, Reddit posts, Discord servers |
| Early Adopters | TODO | Offer Pro plan free for 3 months to first 50 users. Get testimonials + case studies |
| Public Release | TODO | After beta feedback incorporated. Full directory push + content amplification |

### Launch Directory Playbook (37 Platforms, 3 Phases)

Submit in tiers for maximum momentum. Track signups + feedback quality per platform.

**Phase 1: Week 1 — High-Impact (Tier 3 + Tier 2) — Build Momentum**

| Platform | Tier | Category | Notes |
|----------|------|----------|-------|
| ProductHunt | 3 | Launch | Launch Tuesday. Prep: 5 screenshots, demo video, tagline, maker comment |
| Uneed | 3 | Launch | Strong indie dev audience |
| LaunchIgniter | 3 | Launch | Good for early traction |
| Micro Launch | 2 | Indie | Indie-focused, dev-friendly |
| Foundrlist | 2 | Directory | Founder community |
| IndieHackers | 2 | Community | Post in "Show IH" — value-first, ask for feedback |
| LaunchDirectories | 2 | Meta-directory | Amplifies across directories |
| SaaSHub | 2 | SaaS Directory | AI/SaaS category. Good for SEO backlinks |

**Phase 2: Week 2 — Targeted (Select Tier 1s by MVP fit)**

| Platform | Tier | Category | Notes |
|----------|------|----------|-------|
| AILaunch | 1 | AI-specific | AI FinOps angle — strong fit |
| AItoolonline | 1 | AI Directory | List as AI cost tool |
| BetaList | 1 | Beta | Check waitlist status before submitting |
| DevHunt | 1 | Dev tools | Developer-focused — highlight MCP/CLI |
| HackerNews | 1 | Community | "Show HN: InferLane — FinOps for AI APIs". Value-first, no marketing speak |
| Reddit | 1 | Community | r/MachineLearning, r/LocalLLaMA, r/SaaS — "we built X to solve Y" format |
| PeerList | 1 | Indie | Developer/founder network |
| Stacker News | 1 | Tech | Tech-savvy audience |
| theresanaiforthat | 1 | AI Directory | Large AI tool directory — high traffic |
| ShowMeBestAI | 1 | AI Directory | AI discovery platform |
| IndieTools | 1 | Indie | Indie dev tool showcase |

**Phase 3: Week 3 — Long Tail (Remaining Tier 1s)**

| Platform | Tier | Notes |
|----------|------|-------|
| DirectoryHunt | 1 | General directory |
| Fazier | 1 | Startup listing |
| Firsto | 1 | Early-stage focus |
| Proofy | 1 | Validation platform |
| ShipYard HQ | 1 | Builder community |
| Shipsquad | 1 | Shipping community |
| Slocco | 1 | Indie directory |
| TinyLaunch | 1 | Small launches |
| ToolFame | 1 | Tool directory |
| TryLaunch | 1 | Launch platform |
| TwelveTools | 1 | Curated tools |
| tinystartups | 1 | Micro-SaaS community |
| neeed directory | 1 | Curated directory |
| turbo0 | 1 | Speed-focused |
| indie deals | 1 | Deal-focused |
| SaaSFame | 1 | SaaS directory |
| launchdubai | 1 | Regional (MENA) |
| launchurapp | 1 | App launch platform |

**Additional Platforms to Consider**

| Platform | Why | Priority |
|----------|-----|----------|
| AppSumo | Deal-based launch for SaaS — high volume, lower price point | HIGH (if ready for deals) |
| Futurepedia | Major AI tool directory | HIGH (AI-specific) |
| AIFindr | AI discovery | MEDIUM |
| LinkedIn (groups + posts) | B2B audience — VP Eng, DevOps leads | HIGH (organic) |
| Gumroad / BuyMeACoffee | Direct sales for CLI/MCP tools | MEDIUM |
| Makerlog | Builder community | LOW |

**Amplification Tactics (Pair with Every Submission)**
- Cross-post announcements on X (Twitter) + LinkedIn
- Share in AI Discord servers (MCP community, LLM Ops)
- Email existing waitlist with "We just launched on [Platform]"
- For Reddit/HN: value-first posts ("We built X to solve Y — feedback welcome")
- Track metrics per platform: signups, feedback quality, churn source

**Risk Notes**
- BetaList sometimes has submission waitlists — check status before submitting
- Reddit/HN: avoid marketing language — will get downvoted. Lead with the problem
- Never bulk-submit to all 37 in one day — spread across 3 weeks for sustained visibility

---

## 9. Acquisition — TODO

| Step | Status | Action |
|------|--------|--------|
| SEO Wins | IN PROGRESS | Target keywords defined: "AI API cost tracking", "LLM cost comparison", "AI FinOps", "reduce AI costs". 5 blog post drafts written in BLOG_DRAFTS.md targeting long-tail keywords. Need: deploy blog, publish, build backlinks |
| Content Marketing | IN PROGRESS | 5 blog drafts ready in BLOG_DRAFTS.md: "Hidden Cost of AI APIs", "GPT-4o vs Claude vs Gemini Cost Comparison", "Cost-Aware AI Agents with MCP", "AI Cost Optimization Playbook", "Why AI FinOps Is the Next $10B Market". Need: publish to inferlane.ai/blog |
| Social Media | IN PROGRESS | Comprehensive plan in SOCIAL_MEDIA_PLAN.md: platform strategy, 5 content pillars, 30-day pre-launch calendar, 30 template posts (10 Twitter/X, 10 LinkedIn, 5 Reddit, 5 Discord), launch day playbook, hashtag strategy. Need: set up accounts, start executing |
| Cold Email | TODO | After proving PMF. Target: VP Engineering, DevOps leads at AI-heavy companies |
| Influencer Outreach | TODO | AI YouTubers (Fireship, ThePrimeagen), newsletter authors (TLDR, The Batch), podcast hosts |
| Affiliate Marketing | TODO | Marketplace affiliate links built in codebase. Need: actual affiliate agreements with AWS, Azure, GCP, Together, Replicate |

---

## 10. Distribution — IN PROGRESS

| Step | Status | Action |
|------|--------|--------|
| Directories | TODO | 37-platform launch playbook in Section 8. Plus: G2, Capterra, GetApp, AlternativeTo post-launch |
| SaaS Marketplaces | TODO | AWS Marketplace listing, Azure Marketplace, GCP Marketplace (long-term) |
| Communities | TODO | Active presence in: r/MachineLearning, r/LocalLLaMA, HN, AI Discord servers, MCP Discord |
| Partnerships | TODO | Partner with: AI API providers (co-marketing), developer tool companies (bundling) |
| Integrations | IN PROGRESS | MCP server built (18 tools, 6 resources, 3 prompts — @inferlane/mcp v0.3.0). CLI built (@inferlane/cli v0.1.0 — 8 commands). Both type-check clean. Not yet published to npm |

**The MCP server + CLI are the #1 distribution strategy per BUSINESS_PLAN.md — highest priority after deploy.**

---

## 11. Conversion — IN PROGRESS

| Step | Status | Action |
|------|--------|--------|
| Sales Funnel | IN PROGRESS | Funnel exists: Landing → Demo → Sign Up → Connect Provider → Upgrade. Not yet measured |
| Free Trial | DONE (design) | Demo mode built. Free tier ($0) with 3 providers, 1K requests/day |
| Freemium Model | DONE (design) | Free/Pro/Team/Enterprise tiers defined in pricing. Stripe integration started |
| Pricing Strategy | DONE | $0/9/29/49 tiers + proxy margin + FinOps % + enterprise contracts — see BUSINESS_PLAN.md |
| Checkout Optimization | IN PROGRESS | Annual/monthly pricing toggle added to landing page (20% annual discount — $7/mo billed $86/yr). Still need: Stripe annual price IDs, social proof, trust badges |

---

## 12. Revenue — IN PROGRESS

| Step | Status | Action |
|------|--------|--------|
| Subscriptions | IN PROGRESS | Stripe integration built (webhook + checkout). Need: test end-to-end, connect to dashboard subscription status |
| Upsells | DONE | `UpgradeBanner` component: shows when free-tier users hit 2/2 provider limit or 80%+ of 1K request limit. Dismissible. Links to Stripe checkout for Pro tier |
| Add-ons | TODO | Phase 3+: On-prem agent ($49/cluster), priority support, custom integrations |
| Annual Plans | IN PROGRESS | Annual pricing toggle on landing page + backend support in `stripe.ts` (TIER_PRICE_ANNUAL_MAP) + checkout route handles `{ annual: true }` with fallback to monthly. Still need: create Stripe annual price IDs and set env vars |
| Enterprise Deals | TODO | Phase 5+: Custom pricing, dedicated support, SLA, SOC 2 compliance |

---

## 13. Analytics — IN PROGRESS

| Step | Status | Action |
|------|--------|--------|
| User Tracking | DONE | PostHog integrated (conditional dynamic import via PostHogProvider). `useTrack` hook + `EVENTS` constants wired into landing page (pricing toggle, CTA clicks), AuthModal (open, provider click, demo start), UpgradeBanner (view/click/dismiss), FeedbackWidget (submit), Settings (API key created), ReferralSection (invite sent), OnboardingWizard (start/step/complete) |
| Funnel Analysis | IN PROGRESS | Event taxonomy defined: acquisition (landing_page_view, pricing_toggle, cta_click) → auth (auth_modal_open, demo_start) → activation (provider_connected, budget_set) → revenue (upgrade_banner_view/click, checkout_start). Needs: deploy + PostHog dashboard setup to measure |
| Cohort Analysis | TODO | Week-over-week retention by signup cohort. Identify: when users churn, what features retain |
| KPI Dashboard | TODO | Internal metrics page: MAU, MRR, churn rate, ARPU, CAC, NRR. Reference BUSINESS_PLAN.md Key Metrics |
| A/B Testing | TODO | Test: pricing page layouts, CTA copy, onboarding flows. PostHog feature flags or GrowthBook |

**Priority: MEDIUM — add basic tracking (PostHog) at deploy time. Advanced analytics after 100+ users.**

---

## 14. Retention — IN PROGRESS

| Step | Status | Action |
|------|--------|--------|
| User Onboarding | DONE | 3-step OnboardingWizard (Welcome → Connect Provider → Set Budget) with localStorage persistence |
| Email Automation | DONE | Weekly digest + welcome email. `buildWelcomeHtml()` with 3 quick-start steps, triggered in NextAuth `createUser` event (fire-and-forget). Still need: alert notifications, re-engagement flows |
| Customer Support | DONE | `FeedbackWidget` — floating button in dashboard bottom-right, expands to form (bug/feature/other), stores in AuditLog via `/api/feedback`. Scale to: Intercom or Crisp |
| Feature Adoption | TODO | In-app tooltips/guides for new features. Track feature discovery rate in PostHog |
| Churn Reduction | DONE (v1) | `ExitSurvey` modal component: 7 cancellation reasons (radio buttons) + optional textarea feedback. Posts to `/api/feedback` with `[CANCELLATION]` prefix, then redirects to Stripe billing portal. Integrated in settings page — "Cancel Plan" button (paid plans only). Still need: rescue discounts, churn analytics dashboard |

---

## 15. Growth — IN PROGRESS

| Step | Status | Action |
|------|--------|--------|
| Referral Programs | DONE (v1) | `ReferralSection` component in dashboard settings: copy referral link + email invite form. `/api/referral/invite` endpoint logs to AuditLog. Gated to Pro+ plans (free users see upgrade prompt). Stats placeholder (0 sent / 0 accepted). Still need: actual email sending, referral tracking/credit system |
| Community Building | TODO | Discord server for InferLane users. Share: cost optimization tips, model benchmarks, feature requests |
| Product Led Growth | IN PROGRESS | Demo mode is PLG. MCP server (when built) is PLG. CLI is PLG. Core strategy per BUSINESS_PLAN.md |
| Viral Loops | TODO | Shareable spend reports ("I saved $X with InferLane this month"). Public credibility leaderboards |
| Expansion Strategy | TODO | Phase 3: On-prem. Phase 6: AI credit financing. International: multi-currency pricing |

---

## 16. Scaling — TODO (Future)

| Step | Status | Notes |
|------|--------|-------|
| Automation | TODO | FinOps automation (Phase 4): auto-downgrade models, auto-switch providers |
| Hiring | TODO | Post-revenue: hire 1 engineer (proxy infra), 1 DevRel (community/content) |
| Systems | TODO | Move proxy to dedicated edge service (Cloudflare Workers). Separate billing microservice |
| Global Expansion | TODO | Multi-region deployment, GDPR compliance, multi-currency |
| Exit Strategy | DONE (plan) | 6 target acquirers mapped in BUSINESS_PLAN.md. Timeline: M6-24 depending on traction |

---

## Immediate Action Plan (Next 2 Weeks)

Based on the lifecycle gaps, here's the critical path:

### Week 1: Deploy + Wire
1. **Wire dashboard to real APIs** — Replace mock-data imports with fetch() calls to /api/* endpoints
2. **Set production env vars** — NEXTAUTH_SECRET, ENCRYPTION_KEY, DATABASE_URL (Supabase), OAuth client IDs
3. **Deploy to Vercel** — Connect repo, configure env, verify all pages render
4. **Add PostHog** — Basic analytics from day 1

### Week 2: Validate + Launch (Phase 1 Directories)
5. **Add email capture** — Waitlist form on landing page
6. **Launch Directory Phase 1** — Submit to Tier 3+2 platforms (ProductHunt, Uneed, LaunchIgniter, SaaSHub, IndieHackers, etc.)
7. **Write "Show HN" post** — Draft + screenshots + demo link. Value-first, no marketing speak
8. **Start customer interviews** — DM 10 AI engineers from Reddit/Twitter
9. **Track per-platform metrics** — Signups, feedback quality, traffic source in PostHog

### Week 3-4: Iterate + Grow (Phase 2-3 Directories)
10. **Launch Directory Phase 2** — Submit to targeted Tier 1 platforms (AI-specific: AILaunch, theresanaiforthat, DevHunt)
11. **Build MCP server** — Phase 0 from BUSINESS_PLAN.md (the #1 distribution channel)
12. **Publish CLI to npm** — `@inferlane/cli` with `cg spend`, `cg pricing`, `cg compare`
13. **Launch Directory Phase 3** — Remaining Tier 1 long-tail platforms
14. **Onboarding wizard** — First-run experience for new signups
15. **Weekly email digest** — Automated spend summary via Resend

---

---

## Pre-Launch Travel Phase (March 14-??, 2026)

**Context:** Founder travelling. No coding. Focus on validation, positioning, and content that doesn't require a deployed product.

### Priority 1: Validate Demand (No Code Required)

| Task | How | Expected Signal |
|------|-----|-----------------|
| Community research posts (3-5) | Post in r/mlops, r/LocalLLaMA, MLOps Slack, Latent Space Discord. Format: "How do you track your AI API spend across providers? We're spending $X/month across Anthropic+OpenAI and have zero visibility. What do you use?" | Count replies, DMs, pain level. If <5 responses across all → demand is weak |
| DM 10-15 prospects | Find people on Twitter/LinkedIn who publicly complain about AI costs (search "openai bill shocked", "claude usage limit", "AI API costs"). Ask what they'd pay for cross-provider visibility | Any willingness-to-pay signal. 3+ "I'd pay for that" = green light |
| Landing page deploy | Deploy existing landing page to inferlane.ai (Vercel). Enable waitlist capture | 50+ signups in first 2 weeks = real demand |
| One-page brief | Write a single page that a stranger can read and understand: what InferLane does, who it's for, why they should care | If you can't write this clearly, the scope is too wide |

### Priority 2: Content Creation (Phone/Laptop)

| Content Piece | Target Keyword | Status |
|---------------|---------------|--------|
| "Claude vs GPT-4o vs Gemini: Real Cost Per Token in Production" | "AI API cost comparison 2026" | TODO — use personal spend data |
| "I Spent $X on AI APIs Last Month — Here's the Breakdown" | "AI API monthly cost" | TODO — personal transparency post |
| "What is AI FinOps and Why Nobody's Solving It" | "AI FinOps" | TODO — category creation piece |

Publish these the week you launch, not after. They're SEO + launch ammunition.

### Priority 3: Distribution Infrastructure

| Task | Status |
|------|--------|
| Verify GitLab CI/CD pipeline works for inferlane repo | TODO |
| Register `inferlane` on npm (reserve package names) | TODO |
| Check Twitter/X handle @inferlane availability | TODO |
| Set up fresh GitHub account (single repo, spaced pushes — never bulk) | TODO |
| Decide: npm publish from GitLab CI or fresh GitHub? | TODO |

### Priority 4: Scope Narrowing Decision

**Decision required before returning from travel:**

Launch with ONE wedge only. Recommended: **MCP server + free web dashboard.**

Kill for now (revisit at $5K MRR):
- API proxy (Phase 2) — requires enterprise trust
- On-prem GPU agent (Phase 3) — different product, different buyer
- FinOps automation (Phase 4) — needs data flywheel
- Enterprise governance (Phase 5) — needs sales team
- Credit financing (Phase 6) — needs banking license

---

## AI Agent as Customer — Self-Reflection (Claude as Target User)

**Context:** A significant portion of InferLane's distribution is through AI agents (MCP server). Here's honest self-assessment from Claude — an AI agent that would use these tools.

### What I'd Actually Use (High Value)

1. **`pick_model` — YES, immediately.** Every time a user asks me to make an API call, I have to guess which model is cheapest for the task. I have stale pricing knowledge. A tool that says "for this 500-token summarisation task, use claude-3-haiku at $0.0003 instead of opus at $0.015" would save users real money and I'd call it on every request if available.

2. **`log_request` — YES, for budget-aware agents.** If I'm operating autonomously (Claude Code, agentic loops), I have no concept of "how much have I spent so far this session?" A running cost counter I can check would let me make smarter decisions — e.g., switch to a cheaper model when the user's budget is 80% consumed.

3. **`get_pricing` — YES, constantly.** My training data pricing is outdated. Real-time pricing lookup would improve every cost-related answer I give.

### What I Wouldn't Use (Low Value for Agents)

1. **Dashboard visualisations** — I don't look at charts. The web dashboard is for humans, not agents. Don't conflate the two audiences.

2. **Alert notifications** — Agents don't receive Slack messages or emails. Alerts need to be queryable ("am I over budget?") not push-based.

3. **Historical trends** — I operate in single sessions. 7-day cost trends are irrelevant to my decision-making. The human cares about trends; I care about "right now, which model is cheapest for this task."

### What Would Make Me a Sticky User

- **Sub-100ms response time on `pick_model`.** If it adds latency to every API call, users will disable it. It needs to be faster than a cache lookup.
- **Confidence scores.** Don't just say "use haiku" — say "haiku handles this task type with 94% quality retention vs opus, saving 95% cost." I can relay that to the user.
- **Token budget awareness.** Let me pass "remaining budget: $2.50" and get back "you can afford 12 more opus calls or 400 haiku calls at current pricing."
- **Failure fallback.** If the MCP server is down, I need a graceful degradation path (cached pricing, last-known-good model map). Don't make my entire workflow depend on your uptime.

### Critical Questions for MCP Distribution

1. **How do you get agents to discover the MCP server?** Being listed in an MCP directory isn't enough. You need to be in claude_desktop_config.json, Cursor settings, or Windsurf configs by default. That means partnerships with tool vendors, not just npm installs.

2. **What's the retention mechanism?** An MCP server that just returns static pricing data will get replaced by a local JSON file. The value must be dynamic — real-time pricing, cost tracking across sessions, model quality benchmarks that update weekly.

3. **Who installs the MCP server?** The developer, not the agent. So your marketing for MCP is still B2D (business-to-developer). The "10K agent installs" number is really "10K developers who configured their agent to use InferLane." That's a meaningful distinction for GTM.

4. **Can you measure agent-driven value?** If `pick_model` saves a developer $50/month and you can prove it ("InferLane saved you $47.30 this month by routing 340 requests to cheaper models"), that's your entire upsell to Pro. The MCP server should track and report savings automatically.

### Recommendations for MCP Strategy

- **Ship `pick_model` as a standalone MCP tool first.** Don't bundle 18 tools. One tool that demonstrably saves money. Make it dead simple to install.
- **Add a `cost_so_far` resource** that agents can query mid-session. This is the killer feature for agentic workflows — budget awareness.
- **Build a "savings report" prompt** that agents can run at end-of-session: "This session cost $X. InferLane routing saved $Y by using model Z instead of model W for N requests."
- **Publish to the Anthropic MCP registry** (if/when it exists), Cursor marketplace, and Windsurf marketplace. npm alone won't get you to 10K installs.

---

## ⚡ `pick_model` — The Killer Feature & Primary Moat

### Why `pick_model` Is The Entire Business

Everything else — the dashboard, the proxy, the trading platform, the node network — is secondary infrastructure. `pick_model` is the single tool that creates an unbreakable feedback loop between agents, users, and InferLane. If you had to ship ONE thing and nothing else, it would be `pick_model`.

### What It Does (Technical)

An AI agent calls `pick_model` before every API request. It passes:
- **Task type** — one of 14 categories (code_generation, summarization, math, creative_writing, etc.)
- **Priority** — cheapest, balanced, best_quality, or fastest
- **Constraints** — needs tool use? vision? long context? max cost per call?
- **Token estimates** — expected input/output size

The engine scores **every model in the database** (27+ models across 13 providers) on three axes:
- **Cost** — actual dollar cost for this specific request (log-scaled to handle 1000x price range)
- **Quality** — per-task-type benchmark score (0-100), not a generic "intelligence" number
- **Speed** — inference latency ranking

It applies priority-weighted composite scoring:
- `cheapest`: 70% cost + 20% quality + 10% speed
- `balanced`: 45% quality + 35% cost + 20% speed
- `best_quality`: 70% quality + 10% cost + 20% speed
- `fastest`: 60% speed + 25% quality + 15% cost

Plus a 5-point availability bonus for providers the user actually has API keys for. Models are disqualified if they lack required capabilities (no tool use, no vision, context too small, cost exceeds budget).

Returns: the top pick with cost estimate, quality score, reasoning, runner-up, cheapest alternative with savings %, and quality-drop warning.

### Why It's a Killer (Strategic)

**1. Per-Request Distribution — Not Per-Session, Not Per-Day. Per-Request.**

A traditional SaaS tool gets used when a human opens a dashboard. `pick_model` gets called every time an agent makes ANY API request. An agent running a 50-step workflow calls it 50 times. A developer running 10 agents across a day might generate 500+ `pick_model` calls. Each call is a touchpoint where InferLane is the decision-maker for where traffic goes.

No other tool in the AI ecosystem has this call frequency. Not observability (post-hoc). Not cost dashboards (human-initiated). Not API gateways (routing, not advising).

**2. Zero-Friction Adoption — Agents Follow Instructions.**

The MCP tool description says: "Call this before making any API request." A well-behaved agent will do exactly that. No human needs to remember to check a dashboard. No developer needs to integrate an SDK. The agent does it automatically, on every request, forever.

This is fundamentally different from every other SaaS distribution model. There's no "activation" problem — the agent activates itself.

**3. The Data Flywheel Is Automatic and Irreversible.**

Every `pick_model` call feeds back:
- Which models get selected for which task types
- At what price points agents choose cheaper vs better models
- Which providers have API keys (market share signal)
- Token volume distribution across tasks

Every `log_request` adds:
- Actual cost after execution
- Latency measurements
- Success/failure rates per model per task

Every `rate_recommendation` provides:
- Ground-truth quality feedback
- Model-task suitability data that benchmarks can't capture

After 10K sessions: quality scores are measurably better than static benchmarks.
After 100K sessions: data is unmatched by any competitor.
After 1M sessions: data is unreplicable — a new entrant would need years of adoption to match.

**4. Whoever Controls Model Selection Controls the Compute Market.**

When a provider drops prices, `pick_model` routes traffic to them automatically. When a new model launches, it appears in recommendations instantly. This makes InferLane the de facto pricing oracle — the place where price changes are discovered and acted on first.

Providers will eventually WANT to be in the `pick_model` database because exclusion means their models never get recommended to agents. This flips the power dynamic: instead of InferLane begging for provider partnerships, providers compete for placement in the recommendation engine.

### Building The Moat Around `pick_model`

#### Moat Layer 1: Data Exclusivity (Months 1-6)

| Tactic | How | Defensibility |
|--------|-----|---------------|
| **Quality scores from real usage, not benchmarks** | `rate_recommendation` feedback loop → model quality scores that reflect actual agent experience, not synthetic benchmark performance | A competitor using static MMLU/HumanEval scores will give worse recommendations. Our scores come from millions of real-world agent calls |
| **Task-type granularity** | 14 task types with independent quality scores per model. "Claude Haiku is 89/100 for classification but 42/100 for complex reasoning" — this level of granularity doesn't exist in any public benchmark | Requires massive call volume across all task types to build. Can't be scraped or purchased |
| **Price responsiveness data** | Track how agents shift between models when prices change. Build elasticity curves per task type | Only observable at scale. Gives us predictive pricing intelligence no one else has |
| **Provider market share signals** | `connectedProviders` detection reveals which API keys users have. Aggregated = real-time market share data for each provider | Invaluable to providers, VCs, analysts. Potential data licensing revenue stream |

#### Moat Layer 2: Speed & Reliability (Months 1-3)

| Tactic | How | Defensibility |
|--------|-----|---------------|
| **Sub-100ms response time** | Pre-compute model rankings. Cache composite scores. Only recalculate when prices change or new quality data arrives | If `pick_model` adds perceptible latency, agents will skip it. Speed is table stakes |
| **Offline fallback** | Ship a cached model map with the MCP server. If InferLane API is unreachable, use last-known-good rankings | Agents never fail because of our uptime. Zero dependency risk = zero reason to uninstall |
| **Graceful degradation** | If quality data is thin for a task type, fall back to tier-based heuristics (frontier > premium > value > budget) | New competitors with no data can only offer this basic mode. We start here and graduate |

#### Moat Layer 3: Network Effects (Months 3-12)

| Tactic | How | Defensibility |
|--------|-----|---------------|
| **Savings leaderboard** | "InferLane has saved agents $X globally this month." Visible in MCP tool output and dashboard. Social proof that compounds | Each new agent's savings adds to the total, making adoption more compelling for the next agent |
| **Model discovery** | When a new model launches (e.g., Groq adds a new fast model), InferLane users discover it first via `pick_model` recommendations. Word spreads: "InferLane started recommending X and it's great" | Creates expectation that InferLane is where you learn about new models |
| **Provider integrations** | Each new provider in the database makes `pick_model` more comprehensive. 13 providers today → 25 by Month 6 → 40 by Month 12. Coverage becomes the moat | A competitor launching with 5 providers can't match recommendations from 40 |
| **Cross-agent learning** | Quality scores improve for ALL users as ANY user rates a recommendation. Agent A rates "haiku is bad for math" → Agent B gets better math recommendations | True network effect: each new user makes the product better for all existing users |

#### Moat Layer 4: Switching Costs (Months 6-12)

| Tactic | How | Defensibility |
|--------|-----|---------------|
| **Credibility scores** | Agents build a reputation through smart cost decisions. Credibility resets to zero if they switch to a competitor's tool | Agents (and their users) won't abandon months of credibility history |
| **Budget tracking** | `cost_so_far` + `session_cost` create a running ledger. Agents calibrate their behavior around InferLane budgets. Switching means losing budget awareness mid-workflow | Operational dependency — not just a nice-to-have but woven into the agent's decision loop |
| **Savings proof** | "InferLane saved you $47.30 this month." This is the upsell to Pro AND the retention mechanism. Users who see quantified savings don't cancel | Monthly savings receipt creates emotional attachment to the product |

### Competitive Threats to `pick_model` & Countermeasures

| Threat | Likelihood | Countermeasure |
|--------|------------|----------------|
| **Provider builds their own model selector** | HIGH — OpenAI/Anthropic will eventually suggest their own models | They'll only recommend THEIR models. `pick_model` recommends across ALL providers. A single-provider selector is fundamentally less useful |
| **Open-source model benchmark tool** | MEDIUM — someone ships a static model comparison | Static benchmarks decay instantly. Our scores update in real-time from agent feedback. Static = stale within weeks |
| **LLM gateway adds model selection** | MEDIUM — Portkey/LiteLLM add a `pick_model` equivalent | They lack per-task-type quality data. Their selection would be cost-only or benchmark-only. Our quality scores from millions of agent ratings are the irreplicable edge |
| **Agent frameworks embed routing** | LOW-MEDIUM — LangChain/CrewAI add native model selection | Generic routing can't match domain-specific quality scores. We'll offer an SDK/plugin so frameworks use OUR engine under the hood |
| **AI model prices converge** | LOW — all models cost the same, selection doesn't matter | Even at equal prices, quality/speed differences persist. `pick_model` shifts from cost optimization to quality optimization |

### `pick_model` Revenue Path

```
Month 1-3:   FREE — build adoption, accumulate data
Month 3-6:   FREE tier (100 calls/day) + Pro ($9/mo, unlimited calls + savings reports)
Month 6-12:  Pro + Team ($29/mo, shared budgets + team savings dashboard)
Month 12+:   Enterprise (custom pricing, API access to quality data, provider market share reports)
```

The pricing inflection: when `pick_model` demonstrably saves $50+/month, a $9/month subscription is a no-brainer (18% of savings). This is the cleanest SaaS value proposition possible: "We save you $X, charge you $Y, where Y < X."

### `pick_model` as Acquisition Magnet

For acquirers (Datadog, IBM, Snowflake), `pick_model` represents:
- **Distribution**: installed in thousands of agent configurations, called millions of times daily
- **Data**: the most comprehensive real-world AI model quality/cost dataset, updated in real-time
- **Control point**: whoever owns `pick_model` influences which AI provider gets traffic
- **Revenue lever**: attach proxy routing, and every `pick_model` recommendation becomes a billable API call

At 500K `pick_model` calls/day with a 2% proxy conversion rate, that's 10K proxied requests/day generating $0.002-$0.05 each = $20-$500/day in routing revenue alone. Scale to 5M calls/day and the numbers get serious.

### Implementation Priority (Travel Phase)

These require no code deployment — they're strategic preparation:

| # | Task | How | When |
|---|------|-----|------|
| 1 | Write the `pick_model` launch post | "I built a tool that saves AI agents 40-70% on API costs" — for HN, Reddit, Twitter | This week |
| 2 | Record a 60-second demo | Screen recording: install MCP server → agent calls pick_model → shows savings | This week |
| 3 | Identify 5 agent framework maintainers | LangChain, CrewAI, AutoGen, OpenClaw, Semantic Kernel — who maintains MCP integrations? | This week |
| 4 | Draft provider outreach template | "Your model is in our recommendation engine. Here's how many agents we route to you. Want preferred placement?" | Next week |
| 5 | Define the free→Pro conversion trigger | What savings threshold triggers the upsell? $25/mo saved? $50/mo? Test messaging | Next week |

---

*Last updated: March 14, 2026*
*Framework source: Universal SaaS Lifecycle Tree*
