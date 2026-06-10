# Staff Role + Privileged VPS Management — Design

**Date:** 2026-06-10
**Status:** Approved (pending implementation plan)

## Summary

Introduce two user roles — `user` (default) and `staff`. Staff gain two privileges:

1. **Deploy without paying** — provision a VPS instance directly, skipping the Polar checkout flow.
2. **Manage any user's VPS** — full parity with the owner (view detail, SSH terminal, reveal secrets, start/stop, reconfigure model + API key, delete) on **every** instance, not just their own.

The dashboard surfaces staff status with a `STAFF` header badge and tags non-owned instances with the owner's email.

Authorization is enforced **server-side only**. The client receives an `isStaff` flag for display purposes; it carries no authority.

## Decisions (locked during brainstorming)

| Question | Decision |
|---|---|
| Role storage | `role` text column on `user` table, default `'user'`. |
| Role assignment | Server-only `STAFF_EMAILS` env allowlist; persisted to the column, self-healing on each request. |
| Management surface | **Unified dashboard** — staff sees own + all other instances in one list, each tagged with owner. |
| Staff actions on others' VPS | **Full parity** — everything an owner can do, including reveal secrets and delete. |
| Staff deploy flow | Keep the Plan step (server-size choice), but **skip checkout** — provision directly, `subscriptionId: null`. |
| UI indicators | `STAFF` header badge + owner-email tag on non-owned instance cards. |
| Authorization pattern | Shared server helper (`getSessionContext` + `canAccessInstance`), called per route/action. |

## Current-state references

- Auth: Better Auth + Google, Drizzle adapter (`src/lib/auth.ts`). `user` table has no role field (`src/lib/schema.ts:9`).
- Deploy gating, two layers:
  - Frontend `PAID_MODE` (Polar product envs set) forces `createPendingCheckout` → Polar checkout (`src/components/dashboard/deploy-dialog.tsx:72`).
  - Backend `POST /api/instances` requires `getAvailableSubscription` when Polar configured (`src/app/api/instances/route.ts:49`).
- Free path already exists: provisions with `subscriptionId: null`, `serverType: "cx22"` when Polar not configured (`src/app/api/instances/route.ts:89`).
- Instance management scoped hard to owner: `eq(instance.userId, session.user.id)` in GET/PATCH/DELETE (`src/app/api/instances/[id]/route.ts`).
- Capacity gate `assertProvisioningCapacity` applies to all provisioning (`src/lib/hetzner-limits.ts`).
- Dashboard server fetch passes `user={ id, email }` only (`src/app/[locale]/dashboard/page.tsx`).

## 1. Data model

Add one column to `user` (`src/lib/schema.ts`):

```ts
role: text("role").notNull().default("user"), // 'user' | 'staff'
```

Drizzle migration adds the column; existing rows default to `'user'`. No other schema changes:

- `instance.subscriptionId` is already nullable — used for staff/free instances.
- `instance.userId` already records ownership — drives the owner tag and the access rule.

## 2. Role resolution (env allowlist → persisted column)

- New **server-only** env: `STAFF_EMAILS=alice@x.com,bob@x.com` (comma-separated). **Never** prefixed `NEXT_PUBLIC`.
- Util `isStaffEmail(email): boolean` parses the list once (trim, lowercase-compare).
- **Self-healing sync**, performed inside `getSessionContext()`:
  - If `isStaffEmail(user.email)` and stored `role !== 'staff'` → update column to `'staff'`.
  - If not in the list and stored `role === 'staff'` → demote to `'user'`.
- The sync writes **only when the stored value differs** (no-op when `role` already matches), so the common path — a staff user already marked `'staff'` — performs zero writes per request.
- Effect: editing the env promotes/demotes existing users on their next request — no re-login, no manual DB op. The env is the source of truth; the column is a persisted cache used for queries and display.

## 3. Authorization layer

New `src/lib/auth-context.ts`:

```ts
// wraps auth.api.getSession + role sync; accepts headers for non-request callers
getSessionContext(headers?: Headers): Promise<{ user; isStaff: boolean } | null>

// the single ownership/staff rule
canAccessInstance(ctx, inst): boolean // => ctx.isStaff || inst.userId === ctx.user.id
```

Every API route and server action replaces its raw `auth.api.getSession` call with `getSessionContext`. The access rule lives in exactly one place.

**Header injection caveat:** Next.js routes/actions get headers from `next/headers`, but the Socket.IO SSH server (`server.ts`) builds its own `Headers` from the raw socket request (`server.ts:50`) and cannot use `next/headers`. So `getSessionContext` must accept an optional `headers` argument; `server.ts` passes its hand-built `Headers`. Default (no arg) uses `await headers()` for the Next.js callers.

## 4. API changes

- `GET /api/instances` — staff: return **all** instances joined with owner email; user: own only (unchanged). `dashboard/page.tsx` server fetch mirrors this.
- `POST /api/instances` — staff: **bypass** the subscription check, accept `planType` and derive `serverType = PLAN_SERVER_TYPE[planType]`, provision with `subscriptionId: null`. The `assertProvisioningCapacity` check **still applies**. Non-staff path unchanged.
- `GET/PATCH/DELETE /api/instances/[id]` — replace the `eq(userId, session.user.id)` scoping with: fetch by `id`, then gate on `canAccessInstance(ctx, inst)`. Staff get full parity. Same treatment for the sub-routes: `status`, `reconfigure`, `whatsapp-numbers`, `pairing`.
  - **Write-clause note:** the `PATCH`/`DELETE`/`reconfigure` handlers currently re-apply `eq(userId, …)` inside their `db.update(...).where(...)` / `db.delete(...).where(...)` clauses, not just the initial fetch. After the `canAccessInstance` gate passes, those write `.where(...)` clauses must key on `id` alone — otherwise staff edits/deletes of another user's instance silently affect zero rows.
  - **Body-validation note:** `validateBody` (`route.ts:114`) does not currently accept `planType`. The POST handler's validation must be extended to read `planType` on the staff branch (map via `PLAN_SERVER_TYPE`); reject unknown values.
- **SSH terminal (`server.ts`)** — the Socket.IO `init` handler is owner-scoped at `server.ts:81` (`and(eq(instance.id, instanceId), eq(instance.userId, user.id))`). Replace with `getSessionContext(headers)` (passing the hand-built `Headers`) + `canAccessInstance`, fetching the instance by `id` alone. Without this, staff are blocked from SSH-ing into other users' VPS, contradicting full parity.

> Note on `whatsapp-numbers` / `pairing`: these two sub-routes manage channel pairing and number state (not secret reveal), but they are still owner-scoped today and must take the same `canAccessInstance` gate so staff can operate them on any instance.

## 5. Deploy / payment bypass (frontend)

`deploy-dialog.tsx` takes a new `isStaff` prop:

- Staff in `PAID_MODE`: keep the Plan step (server-size choice), but `handleSubmit` skips `createPendingCheckout` and instead POSTs `/api/instances` with the selected `planType`. No checkout redirect; the instance is created directly and the user is routed to `/dashboard/{id}`.
- Non-staff: unchanged.

## 6. Frontend indicators

- `DashboardContent` receives `isStaff` (resolved in `page.tsx` via `getSessionContext`) and instances carrying an optional `ownerEmail`.
- Header: a `STAFF` badge beside the email when `isStaff` (shadcn `Badge`).
- Instance card (`instance-card.tsx`): show `owner: <email>` when `inst.userId !== user.id`.
- **Instance detail page (`src/app/[locale]/dashboard/[id]/page.tsx`)** — currently owner-scoped at `page.tsx:29` (`eq(instance.userId, session.user.id)`), `notFound()` otherwise. It server-fetches the full instance (`modelApiKey`, `botToken`, `sshPrivateKey`) and renders `InstanceDetail` (the surface for view-detail, reveal-secrets, and the SSH tab). Switch to `getSessionContext` + `canAccessInstance` so staff can open any user's instance; without this the "view any VPS detail" / "reveal secrets" parity is unmet.
- New i18n strings added to **both** `messages/en.json` and `messages/es.json` for the badge label and owner tag (a missing key throws at render — neither locale may be skipped).

UI work follows the project's required skills: `frontend-design`, `interface-design`, `shadcn`.

## 7. Security

- All role decisions are made server-side. The client `isStaff` flag is cosmetic; hiding a button never substitutes for the server check.
- `STAFF_EMAILS` is server-only — it must not leak to the bundle.
- **Trust boundary, by design:** staff full parity means staff can read other users' secrets (model API keys, bot tokens, SSH private keys) and delete other users' VPS. This is the chosen behavior; it concentrates trust in the staff allowlist. Keep the allowlist small.
- `assertProvisioningCapacity` continues to gate staff deploys — staff cannot exceed Hetzner capacity limits.

## 8. Testing

- Unit: `isStaffEmail` parsing; sync promote and demote paths; `canAccessInstance` (owner, staff-on-other, non-staff-on-other).
- API authorization: staff vs. user accessing another user's instance (GET/PATCH/DELETE, incl. the write-clause keyed on `id`); POST subscription bypass + `planType` validation for staff; capacity still enforced for staff.
- SSH/detail authorization: `canAccessInstance` gate on the `server.ts` SSH `init` handler and the `[id]/page.tsx` detail fetch (staff opens another user's instance; non-staff is denied).
- Gate: `npm test && npm run lint`.

## Files touched

- `src/lib/schema.ts` (+ Drizzle migration)
- `src/lib/auth-context.ts` (new)
- `src/lib/polar.ts` (`PLAN_SERVER_TYPE` reuse; possibly an exported helper)
- `src/app/api/instances/route.ts`
- `src/app/api/instances/[id]/route.ts` (+ `status`, `reconfigure`, `whatsapp-numbers`, `pairing` sub-routes)
- `server.ts` (Socket.IO SSH `init` handler — owner scope → `canAccessInstance`)
- `src/app/[locale]/dashboard/page.tsx`
- `src/app/[locale]/dashboard/[id]/page.tsx` (detail page — owner scope → `canAccessInstance`)
- `src/components/dashboard/dashboard-content.tsx`
- `src/components/dashboard/instance-card.tsx`
- `src/components/dashboard/deploy-dialog.tsx`
- `messages/en.json`, `messages/es.json`
- `.env.example`

## Out of scope (YAGNI)

- Admin-only route / separate admin view (unified dashboard chosen instead).
- Better Auth admin plugin, impersonation, ban.
- In-app promotion UI (role assignment is env-driven).
- Per-instance audit log of staff actions.
- Visual accent on non-owned cards and "staff/free" instance tag (considered, declined).
