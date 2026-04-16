# InferLane Ship Checklist

State of play after the automated cleanup pass on 2026-04-11. Everything in **[DONE]** is already on disk or in flight; everything in **[YOU]** needs your hands on the keyboard.

---

## Automated changes applied

**[DONE]** — Fixed all `inferlane.com` → `inferlane.ai` references in the packages we're publishing:
- `packages/mcp-server/` — src, package.json, README, dist rebuilt
- `packages/agent-hooks/` — src, package.json, README, dist rebuilt
- `packages/plugin/` — plugin.json, marketplace.json, README

**[DONE]** — `@inferlane/mcp-server` version bumped to `1.1.0` with:
- New `inferlane-mcp-http` bin (Streamable HTTP transport for Managed Agents)
- Security hardening: bound to `127.0.0.1` by default, requires Bearer token, env-key fallback gated by explicit `INFERLANE_ALLOW_ENV_FALLBACK=1` opt-in
- MIT license field + LICENSE file
- `engines.node >=20`
- Repository + homepage + bugs URLs
- Rewritten README with accurate install instructions for Claude Code, Claude Desktop, Goose, and programmatic embedding

**[DONE]** — `@inferlane/agent-hooks@0.1.0` — new package, never published, ready to go:
- `engines.node >=20`, MIT, LICENSE, README, repository/homepage/bugs
- TypeScript builds clean; dist ships `index.js` + `index.d.ts`

**[DONE]** — Brand assets generated in `public/`:
- `logo.svg` (240×56, dark background wordmark)
- `logo-dark.svg` (240×56, light background variant)
- `og-image.svg` + `og-image.png` (1200×630, rasterized via librsvg)
- `apple-touch-icon.svg` + `apple-touch-icon.png` (180×180)
- `favicon-16x16.png`, `favicon-32x32.png` (from existing `icon.svg`)
- `icon-192.png`, `icon-512.png` (PWA / Android)
- `manifest.webmanifest` (PWA manifest, theme color + icons)

**[DONE]** — `src/app/layout.tsx` updated:
- Full `icons` array with SVG + PNG fallbacks
- Apple touch icon wired up
- PWA manifest linked
- OG image (`/og-image.png`) wired into OpenGraph + Twitter cards

**[DONE]** — Prisma migration prepared at `prisma/migrations/20260411000000_add_fleet_and_ollama/migration.sql`. Contents:
- `CREATE TYPE FleetRuntime / FleetSessionStatus / FleetEventType`
- `ALTER TYPE AIProvider ADD VALUE 'OLLAMA'`
- `CREATE TABLE fleets / fleet_sessions / fleet_events`
- `ALTER TABLE proxy_requests ADD COLUMN fleetSessionId`
- All indexes + foreign keys
- **All additive, non-destructive** — diffed against live Neon DB

**[DONE]** — Vercel production redeploy triggered (background) to pick up the new metadata, assets, privacy/terms pages (they exist in source but weren't on the 18-day-old deployment), and the Fleet API routes.

---

## Pre-existing issues I flagged but did NOT fix

These touch pre-existing code outside the packages we're publishing. Read before you fix — some may be intentional.

**`inferlane.com` references still remain in:**
- `src/app/api/nodes/referral/invite/route.ts` — uses `.com` as fallback when `NEXTAUTH_URL` is unset
- `src/app/api/nodes/connect/route.ts` — same pattern, 2 occurrences
- `src/app/api/credits/purchase/route.ts` — same pattern
- `src/app/developers/page.tsx` — **user-facing** docs page shows `https://inferlane.com/api` in code examples. This is visible to every visitor and is wrong.
- `packages/mcp/`, `packages/cli/`, `packages/sdk/` — pre-existing packages with many `.com` references. Unclear if intentional (e.g., separate API domain) or stale.

**Recommendation:** at minimum fix `developers/page.tsx` (customer-visible) and the API route fallbacks. The other packages you should audit separately before publishing them.

---

## [YOU] — Required before shipping

### 1. Create GitHub org and repo
- Register `github.com/inferlane` as an organization (free, 2 min)
- Create a public repo at `github.com/inferlane/inferlane`
- Push at least the `packages/plugin/` directory so the Claude Code marketplace entry `inferlane/inferlane` resolves

Commands once the org exists:
```bash
cd "/Users/heathbertram/Downloads/Dapp Dev/inferlane"
git remote add public https://github.com/inferlane/inferlane.git
git push public main
```

### 2. Attach custom domain to Vercel
Current state: project has **0 domains** configured. Live Next.js app is only reachable at `inferlane.vercel.app`.

If you own `inferlane.ai`:
```bash
npx vercel domains add inferlane.ai
npx vercel alias <latest-deployment-url> inferlane.ai
```
Then update DNS at your registrar to point at Vercel's nameservers or add the `A`/`CNAME` records Vercel provides.

If you don't own `inferlane.ai` yet: **buy it now, before shipping any package**. Every package README, plugin.json, OG image, and layout.tsx references it. Users clicking through will hit a dead domain otherwise.

### 3. Run the Prisma migration in production
The migration file is in place but not applied. Choose one of:

**Option A — Use `db push` (matches your existing workflow, since no migrations existed before):**
```bash
cd "/Users/heathbertram/Downloads/Dapp Dev/inferlane"
DATABASE_URL="<your-neon-url>" npx prisma db push
```
This applies the schema to the DB directly and skips the migration file.

**Option B — Use migrations properly (cleaner but requires baseline first):**
The migrations/ directory we created has only the Fleet additions. Before you can `migrate deploy`, you'd need to baseline the rest of the schema:
```bash
DATABASE_URL="<neon-url>" npx prisma migrate resolve --applied "<previous-baseline-name>"
# Then the new migration can be applied:
DATABASE_URL="<neon-url>" npx prisma migrate deploy
```
This is more invasive. **I'd just use Option A** unless you want to start tracking migrations properly.

### 4. npm publish (2FA required)
Once the domain is attached and the site redeploys cleanly, publish:
```bash
# Republish mcp-server with the new version
cd "/Users/heathbertram/Downloads/Dapp Dev/inferlane/packages/mcp-server"
npm publish --access public --otp <2fa-code>

# First publish of agent-hooks
cd "/Users/heathbertram/Downloads/Dapp Dev/inferlane/packages/agent-hooks"
npm publish --access public --otp <2fa-code>
```

### 5. Test the plugin install flow end to end
After GitHub repo is up + npm packages are live:
```bash
# From a fresh Claude Code session:
/plugin marketplace add inferlane/inferlane
/plugin install inferlane@inferlane
```
Walk through the `userConfig` prompt for the API key, verify the tools appear in `/mcp`, run `il_suggest_model` or `il_estimate_cost` to confirm offline tools work.

### 6. Submit to the official Claude Code marketplace
Once step 5 works with a real user (ideally someone other than you):
- Go to https://claude.ai/settings/plugins/submit
- Reviewer will check: homepage resolves, GitHub repo exists, README is clean, plugin.json is valid, security posture is reasonable
- Approval is days-to-weeks

---

## [YOU] — Recommended before launch announcement

### 7. Privacy policy URL
The privacy-policy page exists in source (`src/app/privacy-policy/page.tsx`) but wasn't on the 18-day-old deployment. The redeploy in [DONE] should fix this. Verify `https://inferlane.ai/privacy-policy` returns 200 once DNS is live.

### 8. npm package README preview
Before you publish, run:
```bash
cd packages/mcp-server && npm pack --dry-run
cd ../agent-hooks && npm pack --dry-run
```
Confirm each tarball only contains `dist/` + LICENSE + README + package.json.

### 9. Add dependency license check
```bash
cd packages/mcp-server && npx license-checker --production --summary
cd ../agent-hooks && npx license-checker --production --summary
```
Look for anything GPL/AGPL — if present, you can't ship under MIT.

### 10. Rate limit the Fleet API
The new `/api/fleet/sessions/:id/events` route is on the hot path for the agent-hooks package. Before any real usage, add rate limiting (per API key, token bucket). Left alone, a broken client in a loop could hammer it.

---

## [YOU] — Post-launch polish

- Claim `@inferlane` on Twitter/X
- Submit MCP server to https://registry.modelcontextprotocol.io via `mcp-publisher` CLI
- Write launch blog post
- Add GitHub Actions CI (`tsc --noEmit` + `npm pack --dry-run` on every PR)
- Add tests for the MCP server and agent-hooks
