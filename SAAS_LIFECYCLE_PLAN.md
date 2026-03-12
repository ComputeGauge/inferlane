# ComputeGauge — SaaS Lifecycle Plan

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
| Landing Page Test | TODO | Deploy computegauge.ai with current landing page. Add Plausible/PostHog. Track: bounce rate, CTA clicks, demo conversions |
| Waitlist | TODO | Add email capture to landing page ("Get early access"). Use Resend or Loops for collection |
| Pre-Sales | TODO | Reach out to 5 AI-heavy startups. Offer free pilot of proxy routing. Validate willingness to pay |
| Demand Testing | TODO | Post on HN "Show HN: ComputeGauge — FinOps for AI APIs". Post on r/MachineLearning. Track signups/week |

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

## 4. Design — IN PROGRESS

| Step | Status | Action |
|------|--------|--------|
| Wireframes | DONE | Implicit in built dashboard — 6 pages with full layouts |
| UI Design | DONE | Dark theme, glassmorphism cards, gradient accents, Recharts visualizations |
| UX Flows | IN PROGRESS | Core flows work (demo login → dashboard → connect provider → set alert). Need: onboarding wizard, first-run experience |
| Prototype | DONE | Working demo mode serves as interactive prototype |
| Design System | TODO | Extract reusable component library: Button variants, Card, Modal, Badge, Input styles. Currently inline — no shared design tokens |

---

## 5. Development — IN PROGRESS

| Step | Status | Notes |
|------|--------|-------|
| Frontend | DONE | 6 dashboard pages + landing page + auth modal. All rendering correctly |
| Backend | DONE | 6 API route groups: providers, alerts, api-keys, proxy, spend, stripe |
| APIs | IN PROGRESS | Routes built but 5/6 dashboard pages use mock data instead of real API calls |
| Database | DONE | Prisma 7 schema: User, Subscription, ProviderConnection, ApiKey, ProxyRequest, Alert, AuditLog |
| Authentication | DONE | NextAuth (Google, Apple, GitHub, Microsoft, email) + demo mode with cookie bypass |
| Integrations | TODO | Real provider API connections (Anthropic usage API, OpenAI /v1/usage, etc.) not yet wired |

**Next dev priority: Wire dashboard pages to real API endpoints (currently using mock-data.ts)**

---

## 6. Infrastructure — TODO (Critical Gap)

| Step | Status | Action |
|------|--------|--------|
| Cloud Hosting | TODO | Deploy to Vercel. Set up: production env vars, custom domain computegauge.ai, edge functions |
| DevOps | TODO | Vercel auto-deploys from git push to main. Set up: preview deployments for PRs |
| CI/CD | TODO | GitHub Actions (or GitLab CI): lint, type-check, test on every push. Block merge on failure |
| Monitoring | TODO | Add: Vercel Analytics (free), Sentry for error tracking, uptime monitoring (BetterStack or UptimeRobot) |
| Security | IN PROGRESS | AES-256-GCM key vault done, API key auth done, rate limiting done, path sanitization done. Still need: CSP headers, CORS policy, production HTTPS enforcement, Dependabot |

**Priority: HIGH — can't validate without deploying. This unblocks Validation and Launch.**

---

## 7. Testing — IN PROGRESS

| Step | Status | Action |
|------|--------|--------|
| Unit Testing | IN PROGRESS | 8 tests passing (crypto + rate-limit). Need: API route tests, auth flow tests, component tests |
| Integration Testing | TODO | Test full flows: signup → connect provider → view dashboard → create alert → delete alert |
| Bug Fixing | IN PROGRESS | Audit found and fixed 19 issues across 10 files. Ongoing |
| Performance Testing | TODO | Lighthouse audit, API response time benchmarks, proxy latency measurement |
| Beta Testing | TODO | Recruit 5-10 beta testers from validation interviews. Track: errors, confusion points, feature requests |

---

## 8. Launch — TODO

| Step | Status | Action |
|------|--------|--------|
| Landing Page | DONE (code) / TODO (deploy) | Built with hero, features, pricing, FAQ. Needs: deploy to computegauge.ai |
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
| HackerNews | 1 | Community | "Show HN: ComputeGauge — FinOps for AI APIs". Value-first, no marketing speak |
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
| SEO Wins | TODO | Target keywords: "AI API cost tracking", "LLM cost comparison", "AI FinOps", "reduce AI costs". Write 5 blog posts targeting long-tail keywords |
| Content Marketing | TODO | Blog at computegauge.ai/blog: "How we saved 40% on AI API costs", "The hidden cost of GPT-4 vs Claude", pricing comparison guides |
| Social Media | TODO | Twitter/X: Daily AI cost tips, pricing updates, model comparisons. LinkedIn: B2B thought leadership |
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
| Integrations | IN PROGRESS | MCP server designed in BUSINESS_PLAN.md (Phase 0). CLI designed. Not yet built/published to npm |

**The MCP server + CLI are the #1 distribution strategy per BUSINESS_PLAN.md — highest priority after deploy.**

---

## 11. Conversion — IN PROGRESS

| Step | Status | Action |
|------|--------|--------|
| Sales Funnel | IN PROGRESS | Funnel exists: Landing → Demo → Sign Up → Connect Provider → Upgrade. Not yet measured |
| Free Trial | DONE (design) | Demo mode built. Free tier ($0) with 3 providers, 1K requests/day |
| Freemium Model | DONE (design) | Free/Pro/Team/Enterprise tiers defined in pricing. Stripe integration started |
| Pricing Strategy | DONE | $0/9/29/49 tiers + proxy margin + FinOps % + enterprise contracts — see BUSINESS_PLAN.md |
| Checkout Optimization | TODO | Stripe Checkout flow needs testing. Add: annual discount toggle, social proof, trust badges |

---

## 12. Revenue — IN PROGRESS

| Step | Status | Action |
|------|--------|--------|
| Subscriptions | IN PROGRESS | Stripe integration built (webhook + checkout). Need: test end-to-end, connect to dashboard subscription status |
| Upsells | TODO | In-app prompts when hitting free tier limits ("You've used 900/1000 requests — upgrade to Pro") |
| Add-ons | TODO | Phase 3+: On-prem agent ($49/cluster), priority support, custom integrations |
| Annual Plans | TODO | Add annual pricing toggle (20% discount) to pricing page + Stripe |
| Enterprise Deals | TODO | Phase 5+: Custom pricing, dedicated support, SLA, SOC 2 compliance |

---

## 13. Analytics — TODO

| Step | Status | Action |
|------|--------|--------|
| User Tracking | TODO | Add PostHog or Plausible. Track: page views, feature usage, session duration, demo-to-signup rate |
| Funnel Analysis | TODO | Measure: Landing → Demo → Signup → Provider Connected → Alert Created → Paid conversion |
| Cohort Analysis | TODO | Week-over-week retention by signup cohort. Identify: when users churn, what features retain |
| KPI Dashboard | TODO | Internal metrics page: MAU, MRR, churn rate, ARPU, CAC, NRR. Reference BUSINESS_PLAN.md Key Metrics |
| A/B Testing | TODO | Test: pricing page layouts, CTA copy, onboarding flows. PostHog feature flags or GrowthBook |

**Priority: MEDIUM — add basic tracking (PostHog) at deploy time. Advanced analytics after 100+ users.**

---

## 14. Retention — TODO

| Step | Status | Action |
|------|--------|--------|
| User Onboarding | TODO | First-run wizard: "Welcome → Connect your first provider → See your spend → Set a budget alert" |
| Email Automation | TODO | Transactional: welcome, weekly spend summary, alert triggered. Re-engagement: inactive 7 days. Use Resend or Loops |
| Customer Support | TODO | Start with: in-app feedback widget, support@computegauge.ai. Scale to: Intercom or Crisp |
| Feature Adoption | TODO | In-app tooltips/guides for new features. Track feature discovery rate in PostHog |
| Churn Reduction | TODO | Exit survey on cancellation. Identify: top churn reasons, offer rescue discounts |

---

## 15. Growth — TODO

| Step | Status | Action |
|------|--------|--------|
| Referral Programs | TODO | "Invite a teammate, both get 1 month Pro free". Built into dashboard settings |
| Community Building | TODO | Discord server for ComputeGauge users. Share: cost optimization tips, model benchmarks, feature requests |
| Product Led Growth | IN PROGRESS | Demo mode is PLG. MCP server (when built) is PLG. CLI is PLG. Core strategy per BUSINESS_PLAN.md |
| Viral Loops | TODO | Shareable spend reports ("I saved $X with ComputeGauge this month"). Public credibility leaderboards |
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
12. **Publish CLI to npm** — `@computegauge/cli` with `cg spend`, `cg pricing`, `cg compare`
13. **Launch Directory Phase 3** — Remaining Tier 1 long-tail platforms
14. **Onboarding wizard** — First-run experience for new signups
15. **Weekly email digest** — Automated spend summary via Resend

---

*Last updated: March 2026*
*Framework source: Universal SaaS Lifecycle Tree*
