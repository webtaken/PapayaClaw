---

description: "Task list for Composio Integration Layer (004-composio-integration)"
---

# Tasks: Composio Integration Layer

**Input**: Design documents from `/specs/004-composio-integration/`
**Prerequisites**: plan.md, spec.md (both required); research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Not requested in the feature specification. Verification relies on type-checking (`next build` runs `tsc --noEmit`), ESLint, and the manual `quickstart.md` walkthrough. Add automated tests only if a test runner is introduced to the project.

**Organization**: Tasks grouped by user story. User stories from `spec.md`:

- **US1** (P1) — Connect a third-party service
- **US2** (P2) — Manage my connections
- **US3** (P2) — Make connected services available to a specific bot
- **US4** (P1) — Bot executes a third-party action end-to-end
- **US5** (P2) — Owner sees what a bot actually did (activity panel)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1…US5)
- File paths below are absolute within the repo (rooted at `src/`, `messages/`, or the spec folder)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the one new dependency and the environment knobs every subsequent phase needs.

- [X] T001 Install `@composio/core` and pin version in `package.json` / `package-lock.json` via `npm install @composio/core`
- [X] T002 Add `COMPOSIO_API_KEY` and `COMPOSIO_REDIRECT_URL` to `.env.local.example` with inline comment documenting the Composio dashboard registration step (from `specs/004-composio-integration/quickstart.md` §2)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, Composio client, shared catalog + error module, i18n baseline, and brand icons. Every user story phase depends on this.

**⚠️ CRITICAL**: No user story work may begin until this phase is complete.

- [X] T003 Extend `src/lib/schema.ts` with four new Drizzle tables (`composioConnection`, `instanceIntegration`, `integrationInvocation`, `integrationLifecycleEvent`) per `specs/004-composio-integration/data-model.md`; include FK `.references()` with `{ onDelete: "cascade" }` on `instance_id` for the invocation table; `composioConnection` includes `initiationState` column (UNIQUE); no CHECK constraints (service-layer enforcement)
- [X] T004 Add the required DB indices (`idx_composio_connection_user_toolkit` on `composio_connection(user_id, toolkit_slug)` and `idx_invocation_instance_time` on `integration_invocation(instance_id, occurred_at DESC)`) and the UNIQUE `(instance_id, toolkit_slug)` on `instance_integration` via a drizzle-kit migration file, then run `npx drizzle-kit push`
- [X] T004a Add the `idx_lifecycle_user_time` index on `integration_lifecycle_event(user_id, occurred_at DESC)` in the same drizzle-kit migration file as T004
- [X] T005 Create `src/lib/composio.ts`: server-only Composio client singleton (`getComposio()`), a `sessionFor(userId: string)` helper returning the per-user session, and a dev-only startup self-test that introspects the 8 curated toolkit slugs and fails loud on mismatch (per research R4)
- [X] T006 [P] Create `src/lib/integrations/catalog.ts`: exported `TOOLKIT_SLUGS` tuple (`gmail`, `googlecalendar`, `googledrive`, `googlesheets`, `notion`, `linear`, `slack`, `github`), exported `CATALOG: readonly CatalogEntry[]` with `slug`, `labelKey`, `descriptionKey`, `iconId`, and a `getCatalogEntry(slug)` helper; source of truth that matches `specs/004-composio-integration/contracts/schemas.ts` `TOOLKIT_SLUGS`
- [X] T007 [P] Create `src/lib/integrations/errors.ts`: typed `IntegrationError` class with discriminated `code` field matching `ErrorCode` enum in `specs/004-composio-integration/contracts/schemas.ts`; helper `toResponse(err)` that produces the documented `{ error: { code, message } }` envelope; sensitive-field-safe `message` formatting (no args, no stack traces)
- [X] T008 [P] Create `src/components/icons/google-sheets.tsx`: named-export PascalCase `GoogleSheets` component, inline SVG using brand colours (green), accepts `SVGProps<SVGSVGElement>`
- [X] T009 [P] Create `src/components/icons/linear.tsx`: named-export `Linear` component following the same pattern as the existing icons
- [X] T010 [P] Create `src/components/icons/github.tsx`: named-export `GitHub` component; monochrome using `currentColor` so dark mode picks it up via Tailwind `text-*` classes
- [X] T011 Add new `Integrations` namespace to `messages/en.json` with baseline keys: `Integrations.title`, `Integrations.description`, `Integrations.services.gmail.label`, `Integrations.services.gmail.description`, … for all 8 services, plus status labels (`connected`, `pending`, `reconnectRequired`, `expired`, `revoked`) and common action labels (`connect`, `manage`, `disconnect`, `reconnect`, `confirm`, `cancel`)
- [X] T012 Mirror the full `Integrations` namespace in `messages/es.json` with Spanish translations; Constitution IV requires locale parity before merge

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 — Connect a third-party service (Priority: P1) 🎯 MVP

**Goal**: Signed-in user can open the integrations tab of any instance, pick one of the 8 curated services from the catalog, complete the upstream OAuth, and see the connection marked **Connected** with the returned account label. Pending rows are persisted on initiation; the callback atomically transitions them to `connected` or deletes them on failure.

**Independent Test**: From a fresh DB state, a signed-in user clicks **Connect** on the Gmail card, approves consent at Google, and returns to the integrations tab showing Gmail in `Connected` state with `accountLabel` populated. Reloading the page preserves the state. Acceptance Scenarios 1–3 from `spec.md` User Story 1 pass.

- [X] T013 [US1] Implement `src/lib/integrations/connection-service.ts` (create file): `initiateConnection({ userId, toolkitSlug })` — generates a 128-bit URL-safe random `state` via `crypto.randomBytes(16).toString('base64url')`, calls `session.toolkits.authorize(toolkitSlug, { state })` (append to redirect URL if SDK doesn't forward it), inserts a `composio_connection` row with `status='pending'`, SDK-returned `composioConnectedAccountId`, and `initiationState=state`, returns `{ connectionId, redirectUrl }`
- [X] T014 [US1] Extend `src/lib/integrations/connection-service.ts`: `completeConnection({ state })` — looks up the pending row by `initiationState`, rejects if no match / age > 15 min / `status != 'pending'`, fetches the connected account from Composio to read `accountLabel`, sets `status='connected'` + `lastHealthCheckAt`, nulls `initiationState` (single-use), returns the updated row; on provider error, deletes the pending row and returns null
- [X] T014a [US1] In `src/lib/integrations/connection-service.ts`, emit `integration_lifecycle_event` rows: `eventType='created'` on `initiateConnection`, `eventType='completed'` on successful callback, in the same transaction as the status mutation (FR-018 atomicity). Lifecycle events are audit-only in v1 — no activity-panel change.
- [X] T015 [P] [US1] Create `src/app/api/integrations/catalog/route.ts`: GET handler returning the 8-entry catalog, `Session` auth (reject 401 without it), `Cache-Control: private, s-maxage=3600`, Zod-validates response against `CatalogResponse` from the contracts file
- [X] T016 [P] [US1] Create `src/app/api/integrations/connect/route.ts`: POST handler; `Session` auth; Zod-parses `ConnectRequest`; calls `connection-service.initiateConnection`; 201 with `ConnectResponse`; maps thrown `IntegrationError` to the error envelope (400 `INVALID_TOOLKIT`, 502 `UPSTREAM_UNAVAILABLE`)
- [X] T017 [US1] Create `src/app/api/integrations/callback/route.ts`: GET handler; Zod-parses `CallbackQuery` (`state` REQUIRED); looks up `composio_connection` by `initiationState`; rejects (redirect with error flag) if no row found, row age > 15 min (`createdAt` delta), or `status != 'pending'`; on match calls `connection-service.completeConnection({ state })` which consumes `initiationState` (nulls it) atomically with the status mutation; on success redirects to `/{locale}/dashboard?connected={toolkitSlug}`; on failure redirects to `/{locale}/dashboard?integrationError={toolkitSlug}`
- [X] T018 [P] [US1] Create `src/components/dashboard/integrations/service-catalog-grid.tsx`: client component; SWR-fetches `/api/integrations/catalog` and `/api/integrations/connections`; renders the 8 services as shadcn `Card` tiles (4-per-row lg, 2-per-row sm) with the brand icon, i18n label, description, and a `Connect` button (or `Connected (N)` badge when the user has matching connections); **MUST** follow `frontend-design`, `interface-design`, and `shadcn` skills per Constitution VII
- [X] T019 [US1] Rewrite `src/components/dashboard/tabs/integrations-tab.tsx`: remove the placeholder "coming soon" body; render `<ServiceCatalogGrid />` as the first section; preserve the existing `useTranslations("InstanceDetail")` pattern but add a new `useTranslations("Integrations")` for the new strings; handle the `?connected=` / `?integrationError=` URL flags by emitting a Sonner toast + SWR revalidation on mount
- [X] T020 [US1] Wire the `Connect` click handler inside `service-catalog-grid.tsx`: POST `/api/integrations/connect` with the selected `toolkitSlug`, then `window.location.assign(redirectUrl)`; error states emit Sonner toasts with the i18n'd error message

**Checkpoint**: MVP — a user can connect Gmail (and each of the other 7 services) end-to-end. Nothing else works yet; that is deliberate.

---

## Phase 4: User Story 4 — Bot executes a third-party action end-to-end (Priority: P1)

**Goal**: A deployed OpenClaw bot, authenticated by its `instance.callbackSecret`, fetches its tool manifest from the platform, invokes an allowed action, and receives the result. The platform enforces the service-level authorisation gate, records an audit row, and handles auth-class failures by transitioning the underlying connection to `reconnect_required`.

**Independent Test**: With a manually-seeded `instance_integration` row (`enabled=true`, `selectedConnectionId` pointing at a `connected` connection), a bot using the instance's `callbackSecret` calls `GET /api/instances/:id/tools/manifest` and receives a non-empty tool list, then `POST /api/instances/:id/tools/invoke` with a real action and receives `{ outcome: "success", result: … }`. Acceptance Scenarios 1–4 from `spec.md` User Story 4 pass.

- [X] T021 [US4] Create `src/lib/integrations/invoke-service.ts`: `buildManifest({ instanceId })` — joins `instance` + `instance_integration` + `composio_connection`, filters to `enabled=true` toolkits whose selected (or sole) connection is `status='connected'`, calls `session.tools()` for the owning user scoped to those slugs, returns the `ManifestToolDto[]`
- [X] T022 [US4] Extend `src/lib/integrations/invoke-service.ts`: `invokeAction({ instanceId, actionSlug, arguments })` — (1) derives `toolkitSlug` from the action prefix and rejects if not in curated 8; (2) gates on `instance_integration.enabled` and connection `status='connected'` (outcome `not_enabled` / `connection_unhealthy`); (3) calls Composio execution with the owning user's session; (4) catches auth-class errors, transitions the connection to `reconnect_required` **and emits an `integration_lifecycle_event` row with `eventType='flagged_unhealthy'` + `errorClass`**, returns `connection_unhealthy`; (5) writes the `integration_invocation` audit row with sensitive fields stripped per FR-019; returns `InvokeResponse`
- [X] T023 [P] [US4] Create `src/app/api/instances/[id]/tools/manifest/route.ts`: GET handler; `InstanceSecret` auth (reuse the same Bearer-`callbackSecret` pattern used in `src/app/api/instances/[id]/status/route.ts`); calls `invoke-service.buildManifest`; Zod-validates against `ManifestResponse`; 401 on bad secret, 404 on unknown instance
- [X] T024 [US4] Create `src/app/api/instances/[id]/tools/invoke/route.ts`: POST handler; `InstanceSecret` auth; Zod-parses `InvokeRequest`; calls `invoke-service.invokeAction`; maps outcomes to HTTP status per `contracts/rest-api.md` (200 success, 400 `NOT_ENABLED`, 409 `CONNECTION_UNHEALTHY`, 502 `PROVIDER_ERROR`); 30-second timeout; emits the audit row even when the outcome is a gating failure (`not_enabled` / `connection_unhealthy`) so the activity panel reflects it
- [X] T025 [US4] Add a lint-style grep check to a PR-review checklist (`specs/004-composio-integration/checklists/requirements.md` → new `security-review.md` subsection) reminding reviewers that `invoke-service.ts` MUST NOT pass `arguments` or `result` into any `integration_invocation` column (FR-019); document the test procedure: search for `arguments` or `result` in SQL-binding positions within `invoke-service.ts`

**Checkpoint**: US1 + US4 together form the bare end-to-end: a user connects Gmail, an operator seeds the toggle row in DB, the bot sends an email. Both P1 stories satisfied.

---

## Phase 5: User Story 3 — Make connected services available to a specific bot (Priority: P2)

**Goal**: Bot owner, from the instance's integrations tab, sees their connected services listed, can toggle each on/off for this instance, and can pick which connected account the instance uses when the user holds multiple for the same service.

**Independent Test**: With a signed-in user who has ≥1 connected service, the instance toggles section lists those services with working Switches; flipping one to on, saving, and reloading persists the state; `GET /api/instances/:id/integrations` confirms. Acceptance Scenarios 1–3 from `spec.md` User Story 3 pass.

- [X] T026 [US3] Create `src/lib/integrations/instance-binding-service.ts`: `listBindings({ instanceId, userId })` — returns one `InstanceBindingDto` per curated toolkit (8 entries even when no row exists in `instance_integration`), populating `availableConnections` from the user's `composio_connection` rows for that slug
- [X] T027 [US3] Extend `src/lib/integrations/instance-binding-service.ts`: `upsertBinding({ instanceId, userId, toolkitSlug, enabled, selectedConnectionId })` — verifies `instance.userId === userId`, when `enabled=true` requires at least one `connected` connection for the toolkit, requires `selectedConnectionId` when >1 candidate exists, verifies the selected connection belongs to `userId`, upserts the row by `(instanceId, toolkitSlug)`; throws `IntegrationError` with codes `NO_CONNECTED_ACCOUNT` / `AMBIGUOUS_ACCOUNT` / `SELECTED_CONNECTION_NOT_OWNED`
- [X] T028 [P] [US3] Create `src/app/api/instances/[id]/integrations/route.ts`: GET handler; `Session` auth; verifies instance ownership (returns 404 on mismatch, not 403, per runtime invariant #2); calls `listBindings`; Zod-validates against `InstanceBindingsResponse`
- [X] T029 [P] [US3] Create `src/app/api/instances/[id]/integrations/[toolkit]/route.ts`: PATCH handler; `Session` auth; instance ownership check; Zod-parses `InstanceBindingUpdate`; calls `upsertBinding`; returns the updated binding; maps domain errors to documented HTTP 400s
- [X] T030 [P] [US3] Create `src/components/dashboard/integrations/instance-toggles.tsx`: client component; SWR-fetches `/api/instances/:id/integrations`; renders one row per toolkit where the user has ≥1 connection (hide empty rows); each row is a shadcn `Switch` + (when multiple connections) a shadcn `Select` for account pick; PATCH on change with optimistic update and Sonner error-toast rollback
- [X] T031 [US3] Integrate `<InstanceToggles />` into `src/components/dashboard/tabs/integrations-tab.tsx` as the second section beneath the catalog grid; pass the `instanceId` from the tab's parent `InstanceDetail`

**Checkpoint**: US3 complete — owner can self-service the per-bot toggles that US4 reads at runtime.

---

## Phase 6: User Story 2 — Manage my connections (Priority: P2)

**Goal**: User sees every connection they own, the bots using each (by name), can disconnect (with confirmation listing affected instances) or reconnect a `reconnect_required` / `expired` / `revoked` row.

**Independent Test**: A user with three connections sees them listed with service, account label, status, and "Used by: <instance names>" metadata; clicking **Disconnect** shows the confirmation dialog naming the affected instances; confirming removes the row upstream + locally; a subsequent bot manifest call from any affected instance omits the disconnected service. Acceptance Scenarios 1–3 from `spec.md` User Story 2 pass.

- [X] T032 [US2] Extend `src/lib/integrations/connection-service.ts`: `listConnections({ userId })` — returns `ConnectionDto[]` including `pending` rows
- [X] T033 [US2] Extend `src/lib/integrations/connection-service.ts`: `disconnect({ userId, connectionId })` — verifies ownership, in a single transaction (a) calls Composio disconnect for `composioConnectedAccountId`, (b) nulls `instance_integration.selectedConnectionId` where it references this row, (c) deletes the row; if upstream disconnect fails, the local row stays and an `IntegrationError('UPSTREAM_UNAVAILABLE')` propagates
- [X] T033a [US2] In `disconnect`, emit `integration_lifecycle_event` with `eventType='disconnected'` before deleting the row. In `reinitiate` (T034), emit `eventType='reconnected'` after a successful callback (T014a already covers the `completed` emission for the initial connect — `reinitiate` reuses the same callback path and adds the `reconnected` event).
- [X] T034 [US2] Extend `src/lib/integrations/connection-service.ts`: `reinitiate({ userId, connectionId })` — for rows in `reconnect_required` / `expired` / `revoked` / `connected`, generates a fresh `state`, returns a fresh `redirectUrl`; preserves the row's `id`; updates `composioConnectedAccountId` if Composio rotates it; writes the new `initiationState` onto the row
- [X] T035 [US2] Extend `src/lib/integrations/connection-service.ts`: `revokeAllForUser({ userId })` — iterates every `composio_connection` row for the user, emits `integration_lifecycle_event` with `eventType='revoked_cascade'` per row, calls upstream disconnect for each, deletes locally; wires SC-007 cascade. Expose for the Better Auth user-deletion path (add a call site near the existing deletion logic in `src/lib/auth.ts` or wherever user removal happens; if no such hook exists yet, wire it via the Better Auth events API per constitution VI)
- [X] T036 [P] [US2] Create `src/app/api/integrations/connections/route.ts`: GET handler; `Session` auth; calls `listConnections`; Zod-validates against `ConnectionsResponse`
- [X] T037 [P] [US2] Create `src/app/api/integrations/connections/[id]/route.ts`: DELETE handler calling `disconnect` (204 on success, 404 / 502 documented), PATCH handler calling `reinitiate` with `ReconnectRequest` body (200 with `ReconnectResponse`)
- [X] T038 [P] [US2] Create `src/components/dashboard/integrations/connection-list.tsx`: client component; SWR-fetches `/api/integrations/connections` and `/api/instances` (to resolve "used by" labels); renders connections grouped by service; each row has status `Badge`, account label, "Used by" chips, and a `Disconnect` / `Reconnect` action; MUST follow `frontend-design`, `interface-design`, and `shadcn` skills
- [X] T039 [P] [US2] Create `src/components/dashboard/integrations/reconnect-dialog.tsx`: shared shadcn `Dialog` component used by both the catalog grid's reconnect affordance and the connection list's reconnect action; on confirm, PATCH `/api/integrations/connections/:id` and redirect to `redirectUrl`
- [X] T040 [US2] Wire disconnect confirmation into `connection-list.tsx`: shadcn `AlertDialog` listing the affected instances by name (from the SWR-fetched instance list), requires explicit confirm before DELETE; Sonner success toast on completion
- [X] T041 [US2] Integrate `<ConnectionList />` into `src/components/dashboard/tabs/integrations-tab.tsx` as a collapsible section under the catalog grid (default-open when the user has ≥1 connection, collapsed when empty)

**Checkpoint**: Connection lifecycle fully managed from the UI. User-deletion cascade wired.

---

## Phase 7: User Story 5 — Owner sees what a bot actually did (Priority: P2)

**Goal**: Per-instance activity panel showing the last 50 tool invocations for that instance with service, action name, timestamp, and outcome classification.

**Independent Test**: After an instance has executed three actions (mix of successes and failures), opening the integrations tab shows exactly three entries in chronological order with correct outcome classification and no raw provider stack traces exposed. Acceptance Scenarios 1–3 from `spec.md` User Story 5 pass.

- [X] T042 [P] [US5] Create `src/app/api/instances/[id]/integration-activity/route.ts`: GET handler; `Session` auth; instance ownership check; Drizzle query on `integration_invocation` with `where instanceId = …` ORDER BY `occurredAt DESC` LIMIT 50; Zod-validates against `ActivityResponse`
- [X] T043 [P] [US5] Create `src/components/dashboard/integrations/activity-panel.tsx`: client component; SWR-fetches `/api/instances/:id/integration-activity`; renders a shadcn `Table` with columns `Service` (icon + label), `Action` (`actionSlug` in mono font), `Outcome` (colour-coded `Badge`), `When` (relative timestamp); handles empty state with a clear illustration + i18n copy (per Acceptance Scenario 3)
- [X] T044 [US5] Integrate `<ActivityPanel />` into `src/components/dashboard/tabs/integrations-tab.tsx` as the third and final section

**Checkpoint**: All five user stories independently functional. The audit-log mitigation premise from Clarification Q3 is now verifiable by owners.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T045 [P] Run `.specify/scripts/bash/update-agent-context.sh claude` to ensure `CLAUDE.md` reflects the final state (already run once during `/speckit.plan`; re-run if any plan edits landed during implementation)
- [X] T046 [P] Run `npm run lint` and fix any new ESLint violations in touched files
- [X] T047 [P] Run `npm run build` — verifies TypeScript strict-mode compliance across all new code and confirms no `any` or `@ts-ignore` slipped in (Constitution II, NON-NEGOTIABLE)
- [ ] T048 Walk the 10-step `specs/004-composio-integration/quickstart.md` manually against a dev environment; resolve any divergence
- [X] T049 Verify dark-mode parity: open the integrations tab with `.dark` class toggled, confirm all three sections and every brand icon remain legible (Constitution VII)
- [X] T050 Verify `messages/en.json` and `messages/es.json` are at full key parity for the `Integrations` namespace (Constitution IV); use `diff` on key sets or a small script; missing keys block merge
- [X] T051 Review `src/lib/integrations/invoke-service.ts` against FR-019 — confirm no path writes `arguments`, `result`, or any field derived from them into the `integration_invocation` audit row; attach evidence (greppable code excerpt) to the PR description
- [ ] T052 [P] Confirm the `idx_invocation_instance_time` index is actually being used by the activity panel query — `EXPLAIN` the Drizzle-generated SQL on a seeded table with ≥10k rows; if the planner prefers a seq scan, adjust the index or query
- [X] T053 Re-run Constitution Check against the shipped code using `plan.md` §Constitution Check as the rubric; update Complexity Tracking only if new exceptions have been introduced

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup; BLOCKS all user stories
- **US1 (Phase 3)**: depends on Foundational
- **US4 (Phase 4)**: depends on Foundational; runtime-independent of US3 (gating on absent `instance_integration` rows returns `NOT_ENABLED`, which is the correct behaviour)
- **US3 (Phase 5)**: depends on Foundational; independent of US1 at the code level but only useful when the user has ≥1 connection
- **US2 (Phase 6)**: depends on US1 (reads `composio_connection` rows produced by US1)
- **US5 (Phase 7)**: depends on US4 (reads `integration_invocation` rows produced by US4)
- **Polish (Phase 8)**: depends on all desired user stories being complete

### User Story Dependencies (runtime)

- US1 ↔ US4: independent at the API surface; composed end-to-end only when both are shipped
- US3 ↔ US4: US4 reads the table US3 writes; both ship cleanly solo (US3 with an unused toggle, US4 that always returns `NOT_ENABLED`)
- US2 and US5 are strictly additive surfaces

### Within each user story

- Services before API routes
- API routes and client components can parallelise (different files)
- UI integration into `integrations-tab.tsx` is the serialisation point — only one task per story mutates that file, placed last in the story

---

## Parallel Example: Phase 2 (Foundational)

```bash
# After T003 + T004 + T005 land, these four can run simultaneously:
Task: "Create src/lib/integrations/catalog.ts" (T006)
Task: "Create src/lib/integrations/errors.ts" (T007)
Task: "Create src/components/icons/google-sheets.tsx" (T008)
Task: "Create src/components/icons/linear.tsx" (T009)
Task: "Create src/components/icons/github.tsx" (T010)
```

## Parallel Example: User Story 1

```bash
# After T013 + T014 + T017 land, these three can run simultaneously:
Task: "Create src/app/api/integrations/catalog/route.ts" (T015)
Task: "Create src/app/api/integrations/connect/route.ts" (T016)
Task: "Create src/components/dashboard/integrations/service-catalog-grid.tsx" (T018)
```

## Parallel Example: User Story 2

```bash
# After T032–T035 land, these four can run simultaneously:
Task: "Create src/app/api/integrations/connections/route.ts" (T036)
Task: "Create src/app/api/integrations/connections/[id]/route.ts" (T037)
Task: "Create src/components/dashboard/integrations/connection-list.tsx" (T038)
Task: "Create src/components/dashboard/integrations/reconnect-dialog.tsx" (T039)
```

---

## Implementation Strategy

### MVP (US1 + US4 only — both P1)

1. Phase 1 (Setup) + Phase 2 (Foundational)
2. Phase 3 (US1 — Connect)
3. Phase 4 (US4 — Bot execution)
4. **STOP and VALIDATE**: run quickstart §5–§7; Gmail send works end-to-end with a manually-seeded `instance_integration` row
5. Ship as MVP behind a feature flag if the rest of the UI isn't ready

### Incremental delivery

1. MVP (US1 + US4) → demo
2. Add US3 (per-instance toggles) → users can self-service without hitting the DB directly
3. Add US2 (connection management) → disconnect/reconnect surfaces
4. Add US5 (activity panel) → audit visibility closes the Q3 mitigation loop
5. Phase 8 polish → merge-ready

### Parallel team strategy

With three developers:

1. All three complete Phase 1 + Phase 2 together (schema + catalog + icons + i18n are cheap and shared)
2. Once Foundational is done:
   - Developer A: US1 (Connect) → US2 (Manage connections) — owns the `connection-service.ts` surface
   - Developer B: US3 (Toggles) → US5 (Activity panel) — owns the `instance-binding-service.ts` and `integration-activity` surfaces
   - Developer C: US4 (Bot execution) — owns `invoke-service.ts` and the bot-facing routes
3. All three converge on `integrations-tab.tsx` integrations (T019, T031, T041, T044) in sequence, coordinated by a single person to avoid merge conflicts

---

## Notes

- `[P]` tasks = different files, no blocking dependencies on incomplete siblings
- `[Story]` label maps each task to a spec user story for traceability
- Each story's final UI-integration task (T019, T031, T041, T044) is the serialisation point inside `integrations-tab.tsx` — do not parallelise across stories
- Verify TypeScript strict-mode + ESLint pass after every task group, not just at the end
- Commit after each task or logical group
- Stop at any Checkpoint to demo/validate that story independently
- Avoid: broadening scope to per-action allow-listing, triggers, white-label OAuth, usage metering, or the cross-instance dashboard — all are v2 per spec Assumptions
