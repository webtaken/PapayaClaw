# Instance Agents Tab — Design

**Date:** 2026-06-18
**Topic:** Finish the "Agents" tab in instance detail — list OpenClaw agents running on the VPS.

## Goal

Replace the placeholder "coming soon" Agents tab with a read-only interface that lists every OpenClaw agent deployed on the instance's VPS, surfaced by running `openclaw agents list --bindings --json` over SSH.

## Non-Goals (YAGNI)

- No agent mutations (no create / delete / set-default / edit identity).
- No per-agent detail/expand view.
- No live polling.
- No display of `routes`, `workspace`, `agentDir`, `bindings` count, or `identitySource`.

## Context

The instance detail page (`src/components/dashboard/instance-detail.tsx`) already renders five tabs; the **agents** tab currently shows a static placeholder. The codebase already has a proven pattern for running commands on a VPS and returning JSON through a Next.js API route (used by `status`, `pairing`, `whatsapp-numbers`, `reconfigure`). This feature reuses that pattern end-to-end — no new infrastructure.

**Source command** (run on the VPS as `root`):
```bash
openclaw agents list --bindings --json
```
Example output:
```json
[
  {
    "id": "main",
    "identityName": "Hertz",
    "identityEmoji": "⚡",
    "identitySource": "identity",
    "model": "zai/glm-5-turbo",
    "bindings": 1,
    "isDefault": true,
    "bindingDetails": ["telegram accountId=default"],
    "routes": ["default (no explicit rules)"]
  }
]
```

## Architecture & Data Flow

```
AgentsTab (SWR, fetch-once + manual refresh)
  → GET /api/instances/[id]/agents
  → executeCommand(SSH)            // src/lib/ssh.ts
  → openclaw agents list --bindings --json
  → JSON.parse(stdout)             // validate array
  → { agents: OpenClawAgent[] }    // stripped to contract fields
```

Reused primitives (no changes needed):
- `executeCommand(host, privateKey, command)` — `src/lib/ssh.ts`, `ssh2`-based, `root@host:22`.
- `getSessionContext(headers())` + `canAccessInstance(ctx, inst)` — `src/lib/auth-context.ts` (staff bypass via `STAFF_EMAILS`).
- `db` / `instance` schema — `src/lib/db.ts`, `src/lib/schema.ts`.

## API Route

**New file:** `src/app/api/instances/[id]/agents/route.ts`

`GET` handler follows the exact pattern of `/api/instances/[id]/status`:

1. `const ctx = await getSessionContext(await headers())` → `401` if null.
2. `const { id } = await params` (Next.js 16 async params).
3. `const [inst] = await db.select().from(instance).where(eq(instance.id, id))`.
4. `if (!inst || !canAccessInstance(ctx, inst))` → `404 { error: "Not found" }`.
5. Readiness guard: `if (!inst.providerServerIp || !inst.sshPrivateKey)` → `400 { error: "Instance not ready" }`.
6. Execute:
   ```ts
   const { stdout, stderr, code } = await executeCommand(
     inst.providerServerIp,
     inst.sshPrivateKey,
     'export PATH="/root/.local/bin:/usr/bin:$PATH" && openclaw agents list --bindings --json',
   );
   ```
7. `if (code !== 0)` → `listAgents` returns `{ error: stderr.trim() || stdout.trim() || "Failed to list agents" }`; the route forwards it as `502 { error }`. (Single-field `error` surfaced from the remote command's own output — matches the convention used by sibling routes `pairing` and `whatsapp-numbers`. Only the instance owner sees it; the SSH private key / host are never part of it.)
8. Parse + validate: `const parsed = JSON.parse(stdout.trim())` (nested try/catch → `{ error: "Unexpected output from openclaw" }`); `if (!Array.isArray(parsed))` → `{ error: "Unexpected output from openclaw" }` (route → 502).
9. Map to contract (strip unused fields, coerce optionals). Implemented as a pure, unit-tested `parseAgents` in `src/lib/ssh.ts` (see plan). The optional string fields use `typeof x === "string" && x ? x : undefined` — a stricter form than naive truthiness, so a truthy non-string (e.g. `123`) is dropped to `undefined` rather than silently stringified; this is unreachable against OpenClaw's string contract but more defensive:
   ```ts
   const agents: OpenClawAgent[] = parseAgents(parsed);
   // parseAgents maps each entry to:
   //   id: String(entry?.id ?? ""),
   //   identityName: typeof entry?.identityName === "string" && entry.identityName ? entry.identityName : undefined,
   //   identityEmoji: (same),
   //   model: (same),
   //   isDefault: Boolean(entry?.isDefault),
   //   bindingDetails: Array.isArray(entry?.bindingDetails) ? entry.bindingDetails.map(String) : [],
   ```
10. Return `200 { agents }`.
11. `catch` → `502 { error: "Failed to connect" }`.

**Shared type** — defined in `src/lib/ssh.ts` (next to `parseAgents`/`listAgents`), imported (type-only) by the route and the component:
```ts
export interface OpenClawAgent {
  id: string;
  identityName?: string;
  identityEmoji?: string;
  model?: string;
  isDefault: boolean;
  bindingDetails: string[];
}
```

## Component

**File:** `src/components/dashboard/tabs/agents-tab.tsx` (rewrite; remove placeholder).

**Props** (currently none — add):
```ts
export function AgentsTab({
  instanceId,
  isProvisioning,
}: {
  instanceId: string;
  isProvisioning: boolean;
}) { ... }
```

**Call site** — `instance-detail.tsx`, the `<TabsContent value="agents">` block:
```tsx
<AgentsTab instanceId={instance.id} isProvisioning={!!isProvisioning} />
```

**Fetch:** SWR.
```ts
const { data, error, isLoading, mutate } = useSWR(
  ["agents", instanceId],
  () => fetch(`/api/instances/${instanceId}/agents`).then((r) => r.json()),
);
```
No `refreshInterval`. Manual refresh = `mutate()` behind a Refresh button.

**Layout:**
```
[ Title: "Agents" (mono uppercase) + count badge .......... [↻ Refresh] ]
[ agent card 1 ]
[ agent card 2 ]
```

**Card** — `rounded-xl border border-border bg-card shadow-2xl p-4`:
- Avatar tile: `identityEmoji` in a bordered tile; fallback 🤖 when missing.
- Primary name: `identityName ?? id`.
- `id`: mono, muted (`text-muted-foreground font-mono text-xs`).
- Default badge: when `isDefault` — violet chip matching existing `statusConfig.initializing` style (`border-violet-500/30 bg-violet-500/10 text-violet-400`), text `t("agents.defaultBadge")`.
- Model: `model` in mono.
- Binding chips row: each `bindingDetails` entry rendered as `border border-border bg-muted/40 px-2 py-0.5 text-xs font-mono` chip.

**Binding chip parsing:** split entry on whitespace. First token = channel type (e.g. `telegram`); the remainder = detail (e.g. `accountId=default`). Render as `{type}: {detail}`. If the string has no spaces or is otherwise ambiguous, render it raw.

**States:**

| State | Condition | UI |
|---|---|---|
| Provisioning | `isProvisioning === true` | Centered tile; `provisioningTitle` + `provisioningDescription`. (Reuses current placeholder's centered card aesthetic.) |
| Loading | `isLoading && !data` | Two skeleton cards (`animate-pulse bg-muted`) inside card containers. |
| Error | `error || data?.error` | Centered tile; `errorTitle` + `errorDescription` + [Retry] button → `mutate()`. |
| Empty | `data?.agents?.length === 0` | Centered tile; `emptyTitle` + `emptyDescription` + [Refresh] → `mutate()`. |
| Success | `data?.agents?.length > 0` | Title row (with count) + Refresh + card list. |

All placeholder content (decorative role chips, "coming soon" badge) removed.

## i18n

Update `InstanceDetail.agents` namespace in **both** `messages/en.json` and `messages/es.json` (only two locale files present). Remove obsolete `comingSoon` / `description`. New keys:

```json
"agents": {
  "title": "Agents",
  "count": "{count, plural, one {# agent} other {# agents}}",
  "refresh": "Refresh",
  "refreshAria": "Refresh agents list",
  "provisioningTitle": "Setting up agents",
  "provisioningDescription": "Your instance is still being provisioned. Agents will appear here once it's ready.",
  "loadingAria": "Loading agents",
  "errorTitle": "Couldn't load agents",
  "errorDescription": "Failed to reach your instance.",
  "retry": "Retry",
  "emptyTitle": "No agents found",
  "emptyDescription": "This instance has no agents configured.",
  "defaultBadge": "Default",
  "model": "Model",
  "bindings": "Bindings"
}
```
Spanish translations provided during implementation for `es.json`.

## Skill Compliance

Project memory requires `frontend-design` + `interface-design` + `shadcn` skills for all UI work. This layout intentionally mirrors the existing tab card aesthetic (already shadcn-based: `Badge`, card container styles, mono/uppercase typography) so it is consistent by construction. Those skills are applied during implementation per the plan; brainstorming's terminal state is `writing-plans`.

## Testing / Verification

- Manual: open an instance with agents → cards render with emoji, name, id, model, default badge, binding chips.
- Empty: point at an instance/state with no agents → empty state.
- Provisioning gate: an instance still deploying → provisioning state, no fetch attempted.
- Error: instance unreachable / `openclaw` missing → error state with Retry.
- `npm test && npm run lint` passes.
