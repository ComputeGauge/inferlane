---
document: Auth.js v5 Upgrade Plan
version: 1.0.0
status: Design — ready to execute in Phase 1.5 window
drafted_by: Claude (AI)
drafted_at: 2026-04-15
---

# Auth.js v5 Upgrade Plan

## Why

The remaining high-severity dependency alert comes from this chain:

```
next-auth@4.24.13  →  nodemailer (vulnerable version)
```

`npm audit fix` cannot resolve it without a breaking upgrade to
`next-auth` v5 / Auth.js v5. We deferred it during Turn 3 because
auth changes can break every route at once if mishandled. This memo
is the plan for a deliberate, reversible migration.

## Surface area

Call sites of `next-auth` today:

- `src/lib/auth.ts` — `authOptions` with Google/GitHub/Credentials
  providers and Prisma adapter
- `src/lib/auth-api-key.ts` — fallback to `getServerSession` when
  Bearer token auth fails
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth handler
- Dashboard pages using `useSession()` from `next-auth/react`
- Middleware / proxy.ts — session check

Total call sites: roughly 30 files. Most are read-only uses of
`useSession`, a handful hold `getServerSession` imports.

## Key breaking changes in v5

1. **Package name changes.** `next-auth` → `next-auth` (package name
   stays for v5 betas, but imports move). Prisma adapter moves to
   `@auth/prisma-adapter`.
2. **Config file move.** v4's `authOptions` in `src/lib/auth.ts`
   becomes an `auth.ts` at the project root exporting `auth()`,
   `handlers`, `signIn`, `signOut` from the `NextAuth(config)` call.
3. **Session fetching API.** v5 exports a `auth()` function that
   returns the session; `getServerSession(authOptions)` is gone.
4. **Middleware.** `withAuth` helper is replaced by a universal
   `auth` function you import from the root config.
5. **Callbacks.** v4 `session` and `jwt` callbacks have slightly
   different signatures; most of ours are copy-paste compatible.
6. **Credentials provider.** v5 requires the authorize function to
   return `null` on failure rather than throwing.

## Migration strategy

### Phase 1 — Preparatory (no code change)

- [ ] Pin v4 in package.json exactly so the next `npm install`
      doesn't accidentally jump major.
- [ ] Tag the release point: `git tag pre-authjs-v5`.
- [ ] Snapshot DB (Neon has PITR — we just note the timestamp).

### Phase 2 — Install v5 in parallel (branch)

- [ ] Create branch `feat/auth-js-v5`.
- [ ] `npm install next-auth@beta @auth/prisma-adapter` (beta tag
      until v5 GA stabilises; track the tag in release notes).
- [ ] Move `src/lib/auth.ts` → project root `auth.ts`, export
      `{ handlers, auth, signIn, signOut }` from `NextAuth(config)`.
- [ ] Update `authOptions` → new config shape (providers array
      stays identical; adapter import changes).

### Phase 3 — Rewire entry points

- [ ] `src/app/api/auth/[...nextauth]/route.ts`:
      `export const { GET, POST } = handlers`
- [ ] `src/lib/auth-api-key.ts`: replace `getServerSession` call
      with `const session = await auth();`. Return shape is the
      same; no other change needed.
- [ ] Middleware / `middleware.ts`: replace with the universal
      `auth` function wrapper. If we keep edge middleware, verify
      v5's edge compatibility — fall back to route-level checks if
      not.
- [ ] Dashboard pages using `useSession`: no change required if we
      continue using `SessionProvider` from `next-auth/react` —
      v5 keeps backwards-compatible hooks.

### Phase 4 — Fix known breakage points

- [ ] Credentials provider: make `authorize()` return `null` on
      failure instead of throwing.
- [ ] JWT callback: verify the `token` shape v5 expects matches
      what our callback reads.
- [ ] Cookie names: v5 changes some internal cookie names; verify
      by reading v5 upgrade guide.
- [ ] CSRF token handling: v5 simplifies; verify our form posts
      still include the token.

### Phase 5 — Test

- [ ] Manual sign-in via Google and GitHub in dev.
- [ ] Manual sign-in via Credentials (email + password).
- [ ] Manual sign-in via email magic link (if still enabled).
- [ ] Dashboard session persistence across page reloads.
- [ ] Logout invalidates the session.
- [ ] API key auth (Bearer) still works on Fleet routes (independent
      of session path).
- [ ] `npm audit` shows the previously-high next-auth → nodemailer
      chain as resolved.

### Phase 6 — Ship

- [ ] Merge `feat/auth-js-v5` → `main`.
- [ ] Deploy to Vercel preview.
- [ ] Watch error budget for 24 hours; rollback by reverting the
      merge commit if anything breaks.
- [ ] Announce in CHANGELOG.

## Rollback plan

`git revert -m 1 <merge-commit>` + redeploy. Because the DB schema
does not change (Auth.js v5 uses the same Prisma tables), a rollback
is a code-only action with no data migration.

If we discover corrupted session records from the beta, we can also:
- Clear the `Session` and `Account` tables (user will re-authenticate)
- Keep the `User` table intact (no user data loss)

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| v5 beta instability | Medium | High | Wait for GA if the migration window is tight; otherwise use a pinned commit |
| Edge middleware incompatibility | Medium | Medium | Fall back to Node runtime for auth-heavy routes |
| Session cookie drift causes universal logout | Low | Medium | Announce ahead of time; users re-login once |
| Credentials provider auth throws vs returns null | Low | High | Already listed in Phase 4 |

## Hard gates

None. This is pure code + tests.

## References

- [Auth.js v5 migration guide](https://authjs.dev/getting-started/migrating-to-v5)
- [Auth.js v5 changelog](https://github.com/nextauthjs/next-auth/releases)
- `commercial/security/asvs-l2.md` — tracks this as the remaining
  high-severity open item from V14.4.1
