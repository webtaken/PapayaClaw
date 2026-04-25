# Phase 1 — Data Model: Composio Integration Layer

**Date**: 2026-04-22
**Scope**: Three new tables in `src/lib/schema.ts`. No changes to existing tables beyond an index addition.

All tables follow Constitution V conventions: `text` id primary keys, `.references()` on FKs, `createdAt` (`defaultNow()`) and `updatedAt` (with `$onUpdate`) on owner-editable tables.

---

## Entities

### `composio_connection`

One row per successful OAuth (or API-key) link between a PapayaClaw `user` and a specific third-party account on a specific toolkit. A user may have many rows for the same `toolkitSlug` (work + personal Gmail).

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PK (`$defaultFn` UUID) | PapayaClaw-side id |
| `userId` | `text` NOT NULL, FK → `user.id` | Owner |
| `toolkitSlug` | `text` NOT NULL | One of the 8 curated slugs (`gmail` / `googlecalendar` / `googledrive` / `googlesheets` / `notion` / `linear` / `slack` / `github`) |
| `composioConnectedAccountId` | `text` NOT NULL UNIQUE | Composio-side id — the source of truth for the credential |
| `initiationState` | `text` UNIQUE | Platform-issued opaque random state (128-bit URL-safe). Populated on `POST /connect`; consumed and nulled on the callback. Non-null presence MUST mean "pending awaiting callback." |
| `accountLabel` | `text` | Human-readable label shown in UI (e.g. email for Gmail, workspace name for Notion). Populated from the provider on successful callback |
| `status` | `text` NOT NULL DEFAULT `'pending'` | One of `pending` / `connected` / `reconnect_required` / `expired` / `revoked` |
| `lastHealthCheckAt` | `timestamp` | Last time we had a definitive health signal (callback success or invocation outcome) |
| `createdAt` | `timestamp` NOT NULL DEFAULT `now()` | |
| `updatedAt` | `timestamp` NOT NULL DEFAULT `now()`, `$onUpdate` | |

**Indexes**:
- `idx_composio_connection_user_toolkit` on `(userId, toolkitSlug)` — for listing a user's connections grouped by service and for runtime account-resolution lookups.

**State transitions**:

```
pending ──(callback success)───────▶ connected
pending ──(callback error / timeout)▶ (row deleted by cleanup sweep, not transitioned)
connected ──(invocation auth error)─▶ reconnect_required
reconnect_required ──(reconnect OK)─▶ connected
connected ──(provider revoked)──────▶ revoked
revoked / expired / reconnect_required ──(reconnect OK)─▶ connected
any ──(user disconnects)────────────▶ (row deleted after Composio disconnect succeeds)
```

**Validation rules**:
- `toolkitSlug` MUST be one of the 8 curated slugs (enforced at the service layer + Zod schema; DB column stays `text` for forward-compat).
- `status` transitions are enforced in `connection-service.ts`; the DB does not use a CHECK constraint in v1 (Drizzle supports it but the service-level guard is sufficient).
- A row in `pending` older than 15 minutes with no callback is eligible for cleanup.

**Relationships**:
- `user` 1 ⟶ * `composio_connection`.
- `composio_connection` 1 ⟵ * `instance_integration.selectedConnectionId` (nullable — only set when the service is enabled on an instance and the user has >1 account for it).

---

### `instance_integration`

Per-instance, per-toolkit configuration. One row per `(instanceId, toolkitSlug)` — created lazily on first toggle. Absence of a row means the service is off for that instance.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PK (`$defaultFn` UUID) | |
| `instanceId` | `text` NOT NULL, FK → `instance.id` (cascade on delete) | |
| `toolkitSlug` | `text` NOT NULL | Same enumeration as `composio_connection.toolkitSlug` |
| `enabled` | `boolean` NOT NULL DEFAULT `false` | Per-service on/off toggle. When `false`, the row may still be kept to preserve `selectedConnectionId` memory across re-toggles |
| `selectedConnectionId` | `text`, FK → `composio_connection.id` | When user has >1 connection for this toolkit, which one this instance uses. Nullable when user has exactly 0 or 1 matching connection (in the 1-case the service layer resolves it implicitly) |
| `createdAt` | `timestamp` NOT NULL DEFAULT `now()` | |
| `updatedAt` | `timestamp` NOT NULL DEFAULT `now()`, `$onUpdate` | |

**Constraints**:
- UNIQUE `(instanceId, toolkitSlug)` — one row per service per instance.
- `selectedConnectionId` MUST reference a `composio_connection` whose `userId` equals the `instance.userId` of `instanceId`. Enforced at the service layer (not via DB — Drizzle does not support cross-table CHECKs conveniently).

**Cascade**: Deleting an `instance` row removes its `instance_integration` rows.

**Validation rules**:
- If `enabled = true` and the user has no connection in `connected` state for `toolkitSlug`, the invoke service rejects every call — the UI prevents enabling in that situation, so the DB does not enforce it.
- Changing `selectedConnectionId` invalidates any cached tool manifest the bot has (see Runtime Invariants below).

---

### `integration_invocation`

Append-only audit row for every proxied tool invocation. Never updated, never deleted by normal flow. Retention left open in v1.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PK (`$defaultFn` UUID) | |
| `instanceId` | `text` NOT NULL, FK → `instance.id` (cascade on delete) | |
| `userId` | `text` NOT NULL, FK → `user.id` | Denormalised for efficient per-user queries later |
| `toolkitSlug` | `text` NOT NULL | |
| `actionSlug` | `text` NOT NULL | Composio action identifier (e.g. `GMAIL_SEND_EMAIL`). Opaque string from the SDK |
| `outcome` | `text` NOT NULL | One of `success` / `provider_error` / `auth_denied` / `connection_unhealthy` / `not_enabled` |
| `errorClass` | `text` | Composio or provider error class when outcome ≠ `success`. No message bodies, no stack traces |
| `latencyMs` | `integer` | Measured from invoke-service entry to SDK call return; nullable if the call never made it past the gate (`auth_denied` / `not_enabled`) |
| `occurredAt` | `timestamp` NOT NULL DEFAULT `now()` | |

**Indexes**:
- `idx_invocation_instance_time` on `(instanceId, occurredAt DESC)` — serves the activity panel "last 50" query in a single bounded-range scan.

**Validation rules (FR-019)**:
- The invoke service MUST NOT pass action arguments or results into any of the columns above. A review checklist item (and a lint-style grep in PR review) enforces this.

**Cascade**: `instance` delete cascades rows (audit is instance-scoped — cross-instance aggregation is v2 and will use a soft-delete retention table if it needs longevity).

---

### `integration_lifecycle_event`

Append-only audit row for connection lifecycle events (FR-018). Separate from `integration_invocation` so the per-instance activity panel (FR-017a) remains invocation-only. Not surfaced in the v1 UI.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PK (`$defaultFn` UUID) | |
| `userId` | `text` NOT NULL, FK → `user.id` | Owner |
| `connectionId` | `text` NOT NULL | Value of `composio_connection.id` at event time (NOT a live FK — row may have been deleted after a disconnect) |
| `toolkitSlug` | `text` NOT NULL | |
| `eventType` | `text` NOT NULL | One of `created` / `completed` / `reconnected` / `disconnected` / `flagged_unhealthy` / `revoked_cascade` |
| `errorClass` | `text` | Upstream error class when `eventType='flagged_unhealthy'` |
| `occurredAt` | `timestamp` NOT NULL DEFAULT `now()` | |

**Indexes**: `idx_lifecycle_user_time` on `(userId, occurredAt DESC)`.

**Retention**: same open policy as `integration_invocation` — addressed in v2.

---

## Schema additions — Drizzle pseudocode

Dropped into `src/lib/schema.ts` below the existing `instance` table. Follows existing style (named column strings, `.references()`, no enums).

```ts
export const composioConnection = pgTable("composio_connection", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id),
  toolkitSlug: text("toolkit_slug").notNull(),
  composioConnectedAccountId: text("composio_connected_account_id")
    .notNull()
    .unique(),
  initiationState: text("initiation_state").unique(),
  accountLabel: text("account_label"),
  status: text("status").notNull().default("pending"),
  lastHealthCheckAt: timestamp("last_health_check_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const instanceIntegration = pgTable("instance_integration", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  instanceId: text("instance_id")
    .notNull()
    .references(() => instance.id, { onDelete: "cascade" }),
  toolkitSlug: text("toolkit_slug").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  selectedConnectionId: text("selected_connection_id").references(
    () => composioConnection.id,
  ),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
// UNIQUE (instance_id, toolkit_slug) applied in migration.

export const integrationInvocation = pgTable("integration_invocation", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  instanceId: text("instance_id")
    .notNull()
    .references(() => instance.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id),
  toolkitSlug: text("toolkit_slug").notNull(),
  actionSlug: text("action_slug").notNull(),
  outcome: text("outcome").notNull(),
  errorClass: text("error_class"),
  latencyMs: integer("latency_ms"),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
});
// INDEX (instance_id, occurred_at DESC) applied in migration.

export const integrationLifecycleEvent = pgTable("integration_lifecycle_event", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id),
  connectionId: text("connection_id").notNull(),
  toolkitSlug: text("toolkit_slug").notNull(),
  eventType: text("event_type").notNull(),
  errorClass: text("error_class"),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
});
// INDEX (user_id, occurred_at DESC) applied in migration.
```

Migration: `npx drizzle-kit push` after the schema edit applies these four tables and their indices.

---

## Runtime invariants

1. **Tool manifest freshness** (FR-012): the bot must not cache the tool manifest across invocations. Either re-fetch per-turn, or invalidate on every `PATCH /api/instances/[id]/integrations/[toolkit]`. v1 requires re-fetch per-turn from the bot — stateless and trivial to reason about.
2. **Ownership check** (FR-001, FR-022): every user-facing endpoint that touches `instance_integration` or an instance's activity panel joins `instance.userId` against the Better Auth session and returns 404 (not 403) on mismatch — no information leak about the existence of other users' instances.
3. **Account-ownership check** on `selectedConnectionId`: when setting it, service verifies `composioConnection.userId === instance.userId`. Mismatch → 400.
4. **Audit atomicity** (FR-017): the invoke service writes the audit row in the same transaction as any status mutation it performs on `composio_connection`. A successful upstream call followed by a DB write failure is acceptable (returned to the bot as success; a follow-up reconciliation sweep can re-emit lost rows) — the inverse is not.
