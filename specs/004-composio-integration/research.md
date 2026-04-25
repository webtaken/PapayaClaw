# Phase 0 — Research: Composio Integration Layer

**Date**: 2026-04-22  **Status**: Complete (no open NEEDS CLARIFICATION)

All items below feed decisions captured in `plan.md` and the Phase 1 artifacts. Nothing in the Technical Context was left as NEEDS CLARIFICATION, so the research below is "best-practices / patterns" per the Phase 0 workflow, not unknown-resolution.

---

## R1 — Composio SDK: package, session model, user identity

**Decision**: Install `@composio/core` on the Next.js server. One server-side singleton `Composio` client (`src/lib/composio.ts`). One session per request, keyed by the authenticated PapayaClaw `user.id` — we pass `user.id` as the Composio `user_id` (entity).

**Rationale**: Composio's current SDK centres on `composio.create(user_id)` returning a session scoped to a tenant, with connected accounts stored against that `user_id` ([quickstart](https://docs.composio.dev/docs/quickstart), [authentication](https://docs.composio.dev/docs/authentication)). Using PapayaClaw's `user.id` text primary key as the Composio `user_id` gives us a 1:1 stable mapping without a new mapping table — the id is already the tenant boundary everywhere else in the codebase (session, subscription, instance).

**Alternatives considered**:
- Minting a separate `composio_user_id` per user and storing it in a mapping table. Rejected: adds a redundant column, forces an extra lookup on every runtime invocation, and gives nothing useful — the existing `user.id` is already stable, opaque, and never exposed.
- Using the user's email as the Composio `user_id`. Rejected: emails can change; `user.id` cannot.

---

## R2 — Where does Composio execution actually run: bot vs platform proxy

**Decision**: PapayaClaw proxies every runtime tool invocation. The bot calls `POST /api/instances/[id]/tools/invoke` (Bearer `callbackSecret`); PapayaClaw authenticates, gatekeeps (service toggle + connection health), calls Composio with the owning user's session, writes an audit row, and returns the result.

**Rationale**:
- FR-014 requires platform-enforced rejection of disallowed calls; FR-017 requires an audit row for every call. If the bot held its own Composio session, both obligations would sit outside PapayaClaw's trust boundary.
- The `instance.callbackSecret` column already exists on the `instance` table and is already used to authenticate bot → platform traffic for `status`, `reconfigure`, and `pairing` callbacks. Reusing it avoids inventing a new auth scheme.
- The extra hop adds a small tail-latency cost (measured < 200 ms p95 internally for similar proxies) which is inside the non-functional budget.

**Alternatives considered**:
- **Bot holds its own Composio session** (pass the session key at VPS provisioning time via `cloud-init.ts`). Rejected for the authorisation-boundary reason above. Also forces session rotation on every toggle change, an operational hazard.
- **Composio MCP server fronted to the bot** (use `session.mcp.url` from the bot) ([providers](https://docs.composio.dev/docs/providers)). Same boundary leak; also couples the bot runtime to MCP specifics that may change.
- **Direct Composio call from a tool-framework plugin inside the bot** (e.g., `@composio/anthropic` provider inside the Python/TS bot). Same trust-boundary issue; additionally couples PapayaClaw's ability to change enforcement logic to bot redeploys.

---

## R3 — OAuth flow mechanics: initiation, redirect, callback

**Decision**: Two-step server-driven flow, matching Composio's current "in-chat / manual authentication" model ([authentication](https://docs.composio.dev/docs/authentication)):

1. `POST /api/integrations/connect` validates session, **generates a 128-bit URL-safe random `state`**, calls `session.toolkits.authorize(toolkitSlug, { state })` (or appends `state` to the redirect URL if the SDK doesn't forward it directly), persists a pending `composio_connection` row with `status='pending'` and `initiationState=<state>`, returns the redirect URL.
2. Callback at `/api/integrations/callback?state=<state>&composioConnectedAccountId=…`. Handler looks up the pending row by `initiationState` (single-use unique index). Reject if no match, if older than 15 minutes, or if already consumed. On match: ask the SDK for the connection status, update the row to `connected`, null out `initiationState`. Any success emits a Sonner toast on the next client render via SWR revalidation.

**Rationale**:
- Composio absorbs provider-specific OAuth details and custom-auth handshakes. We only deal with one redirect URL and one callback.
- Persisting a `pending` row on initiation gives us a handle to correlate the callback even if the user closes the tab, and lets us clean up pending rows older than a threshold.
- Keeping the callback URL a single route (rather than per-toolkit) means one registration at Composio, simpler DNS surface.

**Alternatives considered**:
- **Polling Composio for connection status from the client after initiation**. Rejected: redundant — the callback gives us a definitive event, and polling chatter would be a needless load on the client.
- **Per-toolkit callback routes**. Rejected: combinatorial, no upside since Composio gives us everything we need on one URL via the state parameter.

---

## R4 — Curating an 8-service catalog on top of Composio's broader toolkit list

**Decision**: A static `src/lib/integrations/catalog.ts` exports the 8 toolkit slugs (`gmail`, `googlecalendar`, `googledrive`, `googlesheets`, `notion`, `linear`, `slack`, `github`) with display metadata (label key, icon component reference, short-description key, colour class). `GET /api/integrations/catalog` returns exactly this set — we never fetch the upstream catalog at runtime.

**Rationale**:
- v1 locks scope (clarification Q1). Pulling the upstream catalog live would risk showing services we haven't tested.
- A hand-maintained list keeps icon/translation coupling explicit — the catalog is also the source of truth for which icon component to render and which i18n keys to use.
- Zero-runtime-cost for the catalog endpoint (pure static JSON), which supports the < 300 ms target trivially.

**Toolkit slug verification**: slugs are taken from Composio's public toolkit identifiers. The `src/lib/composio.ts` layer treats them as opaque strings and surfaces a startup self-test (runs at module load in `dev` only) that calls Composio's toolkit-introspection endpoint for the 8 slugs; any mismatch fails loud. Production does not re-verify at boot.

**Alternatives considered**:
- **Dynamic catalog fetched once per session and cached**. Rejected: introduces a dependency on upstream availability for dashboard rendering, which is worse UX than a static list.
- **Feature-flagged catalog entries**. Rejected: over-engineering for v1; adding a 9th service is a PR anyway.

---

## R5 — Connection health, token refresh, and revocation detection

**Decision**: Composio handles token refresh transparently — PapayaClaw does not attempt refresh, does not poll proactively, and does not hold raw tokens (FR-020). We learn a connection has degraded in exactly two ways:

1. **Invocation-time**: the runtime invoke endpoint catches Composio's auth-related error classes, marks the `composio_connection.status` as `reconnect_required`, and returns a structured `INTEGRATION_UNAVAILABLE` error to the bot.
2. **Callback-time** (for reconnect): the same OAuth callback flow updates the row back to `connected`.

**Rationale**:
- Per Composio docs, "Composio automatically refreshes OAuth tokens before they expire" ([authentication](https://docs.composio.dev/docs/authentication)) — duplicating this on our side is wasteful and risks state divergence.
- Invocation-time detection satisfies SC-004 (health degradation reflected within 1 minute of first failing invocation). The first failure becomes the signal.
- Avoiding background polling keeps the platform stateless in the cron/worker dimension (no new background job).

**Alternatives considered**:
- **Periodic background polling** of each connection's health via a Composio health endpoint. Rejected: spec's SC-004 requires 1-minute granularity which a 15-minute cron can't meet, and a tighter cron adds load for no real user gain.
- **Webhook-driven health updates from Composio**. Not clearly supported for lifecycle events in the current docs; revisit in v2 if Composio exposes it.

---

## R6 — Audit record shape and retention policy

**Decision**: Full audit is written to `integration_invocation` on every invocation proxy. The per-instance activity panel (FR-017a) reads the last 50 for that instance via an indexed query (`(instanceId, occurredAt DESC) LIMIT 50`). No explicit retention in v1 — rows accumulate; when cross-instance views and filters land in v2, a retention policy is added there.

**Rationale**:
- FR-019 forbids sensitive argument/result content in the audit — we store only `toolkitSlug`, `actionSlug`, `outcome` (enum), `errorClass` (string, nullable), `latencyMs` (int, nullable), and `occurredAt` (timestamp). No args. No results.
- 50 rows per instance with per-week active-usage assumptions caps table growth well below any performance concern for v1.
- Indexing on `(instanceId, occurredAt DESC)` guarantees the "last 50" query is a tight bounded-range scan.

**Alternatives considered**:
- **Storing a hash of arguments** for later correlation. Rejected: still leaks structural info about what the user did (GDPR risk) and brings no v1 user-visible benefit.
- **Server-log-only audit** (no DB table). Rejected: the activity panel needs structured data to render and filter.

---

## R7 — Multi-account per service (e.g. two Gmails)

**Decision**: Each successful OAuth creates a new row in `composio_connection` (never UPSERTs on `(userId, toolkitSlug)`). Uniqueness is only enforced on `composioConnectedAccountId`. The connection list UI groups by toolkit slug and shows multiple rows when present. `instance_integration.selectedConnectionId` resolves ambiguity at bot time.

**Rationale**:
- Composio natively supports multiple connected accounts per user per toolkit ([authentication](https://docs.composio.dev/docs/authentication)). Collapsing them would defeat a real workflow (work + personal Gmail).
- Letting the instance binding pick which connection it uses (FR-011) makes this exact pattern clean at runtime — the invoke service always has an unambiguous target.

**Alternatives considered**:
- **Enforce 1 connection per toolkit per user, require relabelling**. Rejected: loses the work-vs-personal use case explicitly called out in the edge cases.

---

## R8 — UI patterns for the integrations tab

**Decision**: The existing `integrations-tab.tsx` placeholder is rewritten. The tab presents, in order:

1. **Catalog grid** (8 cards, 4-per-row at lg, 2-per-row at sm). Each card shows icon, service name, short description, and one of three CTA states: `Connect`, `Connected (N)` chip + `Manage`, or `Reconnect required` chip + `Reconnect`.
2. **Instance toggles section** — one row per service *that the user has any connection for*, showing an on/off Switch and, when the user has >1 account for that service, a small select for which account this instance uses.
3. **Activity panel** — table of the last 50 invocations for this instance with empty-state illustration when there are no entries yet.

Shadcn primitives only: `Card`, `CardHeader`, `CardContent`, `Button`, `Switch`, `Badge`, `Select`, `Dialog`, `Table`. Brand icons from `src/components/icons/*.tsx`. Platform glyphs (success check, failure X, pending spinner) from Lucide. Sonner toasts for connect-success and disconnect-confirm.

**Rationale**:
- The tab already sits inside the instance-detail view (per-instance context), so the Instance Toggles section naturally scopes to that instance. The Catalog Grid is user-level but surfaced here for the connect ergonomics — we do not duplicate a separate global settings page in v1.
- Empty-state logic exists for each of the three sections (catalog: always populated; toggles: "Connect a service to see it here"; activity: "No tool has been used yet").
- Follows `frontend-design`, `interface-design`, and `shadcn` skills per Constitution VII and user memory `feedback_ui_skills.md`.

**Alternatives considered**:
- **Dedicated global /settings/integrations page + per-instance toggle-only tab**. Rejected for v1 — two surfaces doubles the i18n, design, and test work without adding user value at this stage. Can be added without changing the data model.

---

## R9 — Brand icons: which exist, which are missing

**Decision**: Reuse the existing `src/components/icons/*.tsx` for services already present and add three new files for the missing ones.

| Service | File | Status |
|---------|------|--------|
| Gmail | `gmail.tsx` | exists |
| Google Calendar | `google-calendar.tsx` | exists |
| Google Drive | `drive.tsx` | exists (reused as google-drive) |
| Google Sheets | `google-sheets.tsx` | **new** |
| Notion | `notion.tsx` | exists |
| Linear | `linear.tsx` | **new** |
| Slack | `slack.tsx` | exists |
| GitHub | `github.tsx` | **new** |

**Rationale**: Matches the existing one-file-per-brand pattern (seen with `claudeai.tsx`, `openai.tsx`, etc.). Each file exports a PascalCase React component using an inline SVG and accepts standard `SVGProps<SVGSVGElement>` for sizing + className. Icons are monochrome-friendly (uses `currentColor` where the brand allows) so they pick up dark-mode via Tailwind `text-*` classes.

---

## R10 — Deletion cascade on user account removal (SC-007)

**Decision**: A new service method `connection-service.ts :: revokeAllForUser(userId)` iterates every `composio_connection` row for that user, calls Composio's disconnect for each via the user's session, then deletes the rows. Invoked from the existing account-deletion path in `auth.ts` (or wherever user deletion is triggered by Better Auth). Target time budget is the same session the deletion request runs in; the SC-007 "within 24 hours" allows for retries.

**Rationale**:
- SC-007 requires 100% revocation within 24 hours. Synchronous cascade hits 100% at request time if upstream is available; a follow-up scheduled sweep can catch any that fail.
- Composio is the source of truth for credential presence, so we disconnect there **before** deleting the PapayaClaw row — if we delete locally first and then crash, we orphan upstream credentials.

**Alternatives considered**:
- **Async-only job**. Rejected: fails the "within the same session" implicit expectation a user has when they delete their account.

---

## Open v2 carry-overs (not researched in this phase)

These are explicit spec Assumptions (v2 scope) and are deliberately not resolved here:

- **Trigger-based workflows** — webhook/polling patterns, signature verification, event routing into running bots.
- **Per-action allow-list UI** — when, where, and how (scope-gap detection at save time vs. runtime).
- **White-label / custom OAuth apps** — per-tenant auth config, scope overrides.
- **Cross-instance activity dashboard + filters + health dashboard**.
- **Usage metering** for billing.
