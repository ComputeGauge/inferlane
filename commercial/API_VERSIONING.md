---
document: API Versioning Policy
version: 1.0.0
status: Authoritative
owner: InferLane Engineering
---

# InferLane API Versioning Policy

## Scope

This policy covers the public HTTP API exposed by InferLane — the
`/api/v1/*`, `/api/fleet/*`, `/api/dispatch/*`, `/api/nodes/*`,
`/api/sessions/*`, `/api/scheduler/*`, `/api/proxy/*`, `/api/savings/*`,
and `/api/openapi.json` endpoint families.

It does NOT cover:
- Internal-only `/api/cron/*` endpoints (operated by us, secured by
  `CRON_SECRET`)
- NextAuth endpoints (`/api/auth/*`)
- Webhook endpoints (`/api/*/webhook/*`)
- Internal admin surfaces (`/api/admin/*`)

## Version number shape

We use a single-digit major version number in the URL path for any
breaking change. Minor and patch changes are communicated via
CHANGELOG and do not change the URL.

Current version: **v1** (launch). Paths look like `/api/v1/chat/completions`.

We also serve un-versioned pragmatic endpoints like `/api/fleet/...`
for the agent observability surface. These are treated as **v1** by
convention; when we ship v2 we'll alias them under `/api/v2/fleet/...`
with the un-prefixed form becoming a permanent redirect for 12 months.

## What counts as a breaking change

All of the following are breaking and require a new major version:

- Removing or renaming a field in a response object.
- Changing a field's type (e.g. `string` → `object`).
- Adding a new required field to a request body.
- Changing the meaning of a field value without changing its name
  (semantic drift).
- Changing an enum value's spelling or removing an enum value.
- Changing a status code returned for a given failure mode (e.g.
  400 → 404).
- Reordering pagination semantics.
- Removing or renaming an endpoint.
- Increasing auth requirements (e.g. adding a new scope to an
  existing endpoint).
- Changing rate-limit budgets downward (widening the limit is
  non-breaking; tightening is breaking).

The following are **not** breaking and go out without a version bump:

- Adding a new optional field to a request or response.
- Adding a new enum value for a non-exhaustive field (clients must
  tolerate unknown values per the spec).
- Adding a new endpoint.
- Widening rate limits.
- Relaxing validation.
- Performance and latency improvements.
- Adding new HTTP response headers.

## Deprecation process

When we ship a new major version that breaks compatibility:

1. **Announce** — CHANGELOG, blog post, in-app notification, email
   to account owners. Minimum 90 days before the old version is
   removed. Enterprise customers get 180 days.

2. **Tag deprecated endpoints** — add a `Deprecation` HTTP header
   pointing at the announcement per [RFC 8594] and a `Sunset`
   header with the removal date per [RFC 8594].

3. **Overlap window** — both versions are served concurrently
   during the deprecation period. The new version is the default
   for new customers; the old version continues to serve existing
   traffic.

4. **Dashboard nag** — the dashboard shows a banner listing which
   deprecated endpoints the customer still calls and links to the
   migration guide.

5. **Removal** — on the sunset date, the deprecated endpoints
   return `410 Gone` with a pointer to the new path. We keep that
   410 responder in place for an additional 6 months so customer
   monitoring picks it up cleanly.

## Non-breaking change process

Non-breaking changes ship whenever they're ready. The CHANGELOG is
updated, the OpenAPI spec (`/api/openapi.json`) is refreshed, and
dashboards note the addition. No deprecation window is needed.

## OpenAPI spec

The canonical spec lives at `src/lib/openapi/spec.ts` and is served
from `GET /api/openapi.json`. Every change that affects the API
shape (breaking or not) must update the spec in the same PR. CI
verifies the spec loads cleanly.

## Client library compatibility

The `@inferlane/sdk` npm package targets the current major version
by default. SDK `1.x` targets API `v1`. When we ship API `v2`, we'll
release SDK `2.x` with a new default and keep SDK `1.x` supported
for the entire deprecation window.

## Rate-limit header contract

All rate-limited endpoints return:

- `X-RateLimit-Limit` — the budget
- `X-RateLimit-Remaining` — remaining requests in the window
- `Retry-After` — seconds to wait when 429 is returned

These are stable across versions and are considered part of the API
surface.

## Error response contract

All error responses are JSON and conform to:

```json
{
  "error": "human-readable message",
  "details": { "optional": "structured data" }
}
```

This shape is stable across versions. Error codes inside `details`
may change without a version bump since clients are expected to
fall back to the top-level `error` string.

## Migration guides

Every breaking change publishes a migration guide at
`docs/migration/v<from>-to-v<to>.md` before the deprecation window
opens. Guides include:

- Summary of changes
- Per-endpoint diff (old vs new)
- Example curl / SDK snippets
- FAQ
- Contact channel for assistance

## References

- [RFC 8594 — The Sunset HTTP Header Field](https://www.rfc-editor.org/rfc/rfc8594)
- [OpenAPI 3.1 Specification](https://spec.openapis.org/oas/v3.1.0)
- `src/lib/openapi/spec.ts` — spec source of truth
- `commercial/security/asvs-l2.md` — ASVS L2 self-audit tracking this item
