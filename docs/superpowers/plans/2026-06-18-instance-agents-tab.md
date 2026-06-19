# Instance Agents Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder "Agents" tab with a read-only list of OpenClaw agents running on the instance's VPS, fetched via a new SSH-backed API route.

**Architecture:** New `listAgents` SSH wrapper in `src/lib/ssh.ts` runs `openclaw agents list --bindings --json` and maps output to a typed `OpenClawAgent[]` via a pure, unit-tested `parseAgents` function. A thin GET route at `/api/instances/[id]/agents` reuses the established auth/ownership/SSH pattern. `AgentsTab` becomes a SWR-backed card list with provisioning/loading/error/empty states.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5 (strict), SWR, next-intl 4.8, `ssh2`, Drizzle ORM, Vitest, Tailwind CSS 4, shadcn/ui, Lucide.

**Spec:** `docs/superpowers/specs/2026-06-18-instance-agents-tab-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/ssh.ts` | Modify | Add `OpenClawAgent` type, pure `parseAgents` mapper, and `listAgents` SSH wrapper. |
| `src/lib/ssh.test.ts` | Create | Unit tests for `parseAgents`. |
| `src/app/api/instances/[id]/agents/route.ts` | Create | GET handler — auth, ownership, calls `listAgents`, returns JSON. |
| `src/components/dashboard/tabs/agents-tab.tsx` | Rewrite | SWR fetch + card list + all states. New props `instanceId`, `isProvisioning`. |
| `src/components/dashboard/instance-detail.tsx` | Modify | Pass new props to `<AgentsTab />`. |
| `messages/en.json` | Modify | Replace `InstanceDetail.agents` block with new keys. |
| `messages/es.json` | Modify | Spanish translations for same keys. |

---

## Task 1: Add `OpenClawAgent` type + `parseAgents` mapper (TDD)

Pure, testable mapping from raw `openclaw agents list` output to the UI contract. Lives in `src/lib/ssh.ts` alongside the other typed OpenClaw helpers (`getInstanceChannels`, etc.). `parseAgents` is the unit-tested core; `listAgents` (Task 2) and the route (Task 3) are thin glue over it.

**Files:**
- Modify: `src/lib/ssh.ts` (add type + function near the other exported helpers, e.g. after `getWhatsAppAllowedNumbers`)
- Test: `src/lib/ssh.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/ssh.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseAgents } from "./ssh";

describe("parseAgents", () => {
  it("maps a fully-populated agent", () => {
    const raw = [
      {
        id: "main",
        identityName: "Hertz",
        identityEmoji: "⚡",
        model: "zai/glm-5-turbo",
        isDefault: true,
        bindings: 1,
        bindingDetails: ["telegram accountId=default"],
        routes: ["default (no explicit rules)"],
        workspace: "/root/.openclaw/workspace",
        agentDir: "/root/.openclaw/agents/main/agent",
        identitySource: "identity",
      },
    ];

    expect(parseAgents(raw)).toEqual([
      {
        id: "main",
        identityName: "Hertz",
        identityEmoji: "⚡",
        model: "zai/glm-5-turbo",
        isDefault: true,
        bindingDetails: ["telegram accountId=default"],
      },
    ]);
  });

  it("omits optional fields when absent (undefined, not included)", () => {
    const raw = [{ id: "anon" }];
    const [agent] = parseAgents(raw);
    expect(agent).toEqual({
      id: "anon",
      identityName: undefined,
      identityEmoji: undefined,
      model: undefined,
      isDefault: false,
      bindingDetails: [],
    });
    // keys are still present so React can read agent.identityName ?? agent.id
    expect("identityName" in agent).toBe(true);
  });

  it("coerces non-string identity/model values away", () => {
    const raw = [{ id: "x", identityName: 0, identityEmoji: null, model: "" }];
    const [agent] = parseAgents(raw);
    expect(agent.identityName).toBeUndefined();
    expect(agent.identityEmoji).toBeUndefined();
    expect(agent.model).toBeUndefined();
  });

  it("defaults isDefault to false when missing", () => {
    const [, second] = parseAgents([
      { id: "a", isDefault: true },
      { id: "b" },
    ]);
    expect(second.isDefault).toBe(false);
  });

  it("coerces bindingDetails entries to strings, or [] when absent/non-array", () => {
    const [a, b, c] = parseAgents([
      { id: "a", bindingDetails: ["telegram accountId=default", 7] },
      { id: "b", bindingDetails: "nope" },
      { id: "c" },
    ]);
    expect(a.bindingDetails).toEqual(["telegram accountId=default", "7"]);
    expect(b.bindingDetails).toEqual([]);
    expect(c.bindingDetails).toEqual([]);
  });

  it("preserves order across multiple agents", () => {
    const raw = [{ id: "main" }, { id: "sofia" }, { id: "support" }];
    expect(parseAgents(raw).map((a) => a.id)).toEqual([
      "main",
      "sofia",
      "support",
    ]);
  });

  it("returns [] for non-array input (defensive)", () => {
    expect(parseAgents(undefined)).toEqual([]);
    expect(parseAgents({})).toEqual([]);
    expect(parseAgents("not an array")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ssh.test.ts`
Expected: FAIL — `parseAgents is not a function` (not yet exported from `./ssh`).

- [ ] **Step 3: Write minimal implementation**

Add to `src/lib/ssh.ts` (insert after the `getWhatsAppAllowedNumbers` function, before `setWhatsAppAllowedNumbers`, or grouped with the other exported helpers — keep it adjacent to where `listAgents` will go in Task 2):

```ts
/**
 * One OpenClaw agent as exposed to the UI. Optional fields are `undefined`
 * when OpenClaw did not report them; consumers fall back to `id`.
 */
export interface OpenClawAgent {
  id: string;
  identityName?: string;
  identityEmoji?: string;
  model?: string;
  isDefault: boolean;
  bindingDetails: string[];
}

/**
 * Maps raw `openclaw agents list --bindings --json` output to the UI contract,
 * stripping unused fields and coercing optionals. Pure + unit-tested.
 * Expects an array (validated upstream); defensively returns [] otherwise.
 */
export function parseAgents(raw: unknown): OpenClawAgent[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry: any) => ({
    id: String(entry?.id ?? ""),
    identityName:
      typeof entry?.identityName === "string" && entry.identityName
        ? entry.identityName
        : undefined,
    identityEmoji:
      typeof entry?.identityEmoji === "string" && entry.identityEmoji
        ? entry.identityEmoji
        : undefined,
    model:
      typeof entry?.model === "string" && entry.model ? entry.model : undefined,
    isDefault: Boolean(entry?.isDefault),
    bindingDetails: Array.isArray(entry?.bindingDetails)
      ? entry.bindingDetails.map(String)
      : [],
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ssh.test.ts`
Expected: PASS — all 7 `parseAgents` cases green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ssh.ts src/lib/ssh.test.ts
git commit -m "$(cat <<'EOF'
feat(ssh): add OpenClawAgent type + parseAgents mapper

Pure, unit-tested mapping from raw `openclaw agents list --bindings --json`
output to the UI contract. Strips unused fields, coerces optionals to
undefined, defaults isDefault/bindingDetails. listAgents wrapper + route
follow in subsequent commits.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add `listAgents` SSH wrapper

Thin async wrapper over `executeCommand` + `parseAgents`. Returns a discriminated result so the route can distinguish a real failure (→ 502) from an empty agent list (→ 200). Mirrors the result-object style of `setWhatsAppAllowedNumbers` / `approvePairingRequest` in the same file.

**Files:**
- Modify: `src/lib/ssh.ts` (add immediately after `parseAgents`)

- [ ] **Step 1: Add the wrapper**

Append to `src/lib/ssh.ts` right after `parseAgents`:

```ts
/**
 * Lists OpenClaw agents on a remote instance by running
 * `openclaw agents list --bindings --json`.
 *
 * Returns `{ agents }` on success (possibly empty), or `{ error }` when the
 * command fails, the output is not a JSON array, or the connection errors.
 */
export async function listAgents(
  host: string,
  privateKey: string,
): Promise<{ agents?: OpenClawAgent[]; error?: string }> {
  try {
    const { stdout, stderr, code } = await executeCommand(
      host,
      privateKey,
      'export PATH="/root/.local/bin:/usr/bin:$PATH" && openclaw agents list --bindings --json',
    );

    if (code !== 0) {
      return {
        error:
          stderr.trim() || stdout.trim() || "Failed to list agents",
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout.trim());
    } catch {
      return { error: "Unexpected output from openclaw" };
    }

    if (!Array.isArray(parsed)) {
      return { error: "Unexpected output from openclaw" };
    }

    return { agents: parseAgents(parsed) };
  } catch {
    return { error: "Failed to connect to instance" };
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (Confirms `OpenClawAgent`, `parseAgents`, and `executeCommand` are all wired correctly.)

- [ ] **Step 3: Re-run the test suite (regression)**

Run: `npx vitest run`
Expected: PASS — `parseAgents` tests still green; nothing else broke.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ssh.ts
git commit -m "$(cat <<'EOF'
feat(ssh): add listAgents wrapper for openclaw agents list

Runs `openclaw agents list --bindings --json` over SSH and returns a
discriminated { agents } | { error } so the route can distinguish a real
failure (502) from an empty list (200).

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create the API route

New GET route. Mirrors the exact auth/ownership/SSH pattern of `src/app/api/instances/[id]/whatsapp-numbers/route.ts`.

**Files:**
- Create: `src/app/api/instances/[id]/agents/route.ts`

- [ ] **Step 1: Create the route handler**

Create `src/app/api/instances/[id]/agents/route.ts`:

```ts
import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { listAgents } from "@/lib/ssh";
import { getSessionContext, canAccessInstance } from "@/lib/auth-context";

/**
 * GET /api/instances/[id]/agents
 *
 * Lists OpenClaw agents deployed on the instance's VPS by running
 * `openclaw agents list --bindings --json` over SSH.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getSessionContext(await headers());

  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [inst] = await db
    .select()
    .from(instance)
    .where(eq(instance.id, id));

  if (!inst || !canAccessInstance(ctx, inst)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!inst.providerServerIp || !inst.sshPrivateKey) {
    return NextResponse.json(
      { error: "Instance not ready for SSH" },
      { status: 400 },
    );
  }

  const result = await listAgents(inst.providerServerIp, inst.sshPrivateKey);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ agents: result.agents ?? [] });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors in the new file.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/instances/[id]/agents/route.ts"
git commit -m "$(cat <<'EOF'
feat(api): add GET /api/instances/[id]/agents route

Lists OpenClaw agents on the instance VPS via the listAgents SSH wrapper.
Reuses the established auth/ownership/readiness pattern; surfaces SSH or
command failures as 502 with an empty-vs-error distinction.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Update i18n keys (en + es)

Replace the obsolete `comingSoon`/`description` keys with the new state/label keys used by the rewritten tab. Remove unused keys (YAGNI). Two locale files: `messages/en.json` and `messages/es.json`.

**Files:**
- Modify: `messages/en.json` (the `InstanceDetail.agents` object)
- Modify: `messages/es.json` (the `InstanceDetail.agents` object)

- [ ] **Step 1: Replace the English block**

In `messages/en.json`, find the `InstanceDetail.agents` object:

```json
"agents": {
  "title": "Custom Agents",
  "comingSoon": "Not yet available",
  "description": "Define custom agent behaviors and personas for this instance. This section is under active development and will be available in a future release."
},
```

Replace it (keeping the same indentation and trailing comma) with:

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
},
```

- [ ] **Step 2: Replace the Spanish block**

In `messages/es.json`, find the `InstanceDetail.agents` object:

```json
"agents": {
  "title": "Agentes Personalizados",
  "comingSoon": "Aún no disponible",
  "description": "Define comportamientos y personalidades de agente personalizados para esta instancia. Esta sección está en desarrollo activo y estará disponible en una versión futura."
},
```

Replace it with:

```json
"agents": {
  "title": "Agentes",
  "count": "{count, plural, one {# agente} other {# agentes}}",
  "refresh": "Actualizar",
  "refreshAria": "Actualizar lista de agentes",
  "provisioningTitle": "Configurando agentes",
  "provisioningDescription": "Tu instancia aún se está aprovisionando. Los agentes aparecerán aquí cuando esté lista.",
  "loadingAria": "Cargando agentes",
  "errorTitle": "No se pudieron cargar los agentes",
  "errorDescription": "No se pudo llegar a tu instancia.",
  "retry": "Reintentar",
  "emptyTitle": "No se encontraron agentes",
  "emptyDescription": "Esta instancia no tiene agentes configurados.",
  "defaultBadge": "Predeterminado",
  "model": "Modelo",
  "bindings": "Enlaces"
},
```

- [ ] **Step 3: Validate both JSON files parse**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/es.json','utf8')); console.log('OK')"
```
Expected: prints `OK` (no JSON syntax errors).

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "$(cat <<'EOF'
i18n: replace placeholder agents strings with tab state keys (en+es)

Drops obsolete comingSoon/description; adds title/count/refresh and
provisioning/loading/error/empty/label keys for the rewritten Agents tab.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Rewrite the AgentsTab component + update call site

Replace the static placeholder with a SWR-backed card list. New props `instanceId` + `isProvisioning`. Five states: provisioning gate, loading skeletons, error + retry, empty + refresh, success (cards). Card shows avatar tile (emoji, fallback 🤖), identity name (fallback id), id (mono muted), model (mono), default badge (violet), and binding chips.

**Files:**
- Rewrite: `src/components/dashboard/tabs/agents-tab.tsx`
- Modify: `src/components/dashboard/instance-detail.tsx` (the `<TabsContent value="agents">` block)

- [ ] **Step 1: Rewrite `agents-tab.tsx`**

Replace the entire contents of `src/components/dashboard/tabs/agents-tab.tsx` with:

```tsx
"use client";

import { AlertCircle, Bot, Inbox, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import useSWR from "swr";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OpenClawAgent } from "@/lib/ssh";

interface AgentsResponse {
  agents?: OpenClawAgent[];
  error?: string;
}

/**
 * Renders a bindingDetail entry as "{type}: {detail}" when it looks like
 * "<channel> <kv...>", otherwise returns the raw string.
 */
function formatBinding(detail: string): string {
  const trimmed = detail.trim();
  if (!trimmed) return trimmed;
  const space = trimmed.indexOf(" ");
  if (space === -1) return trimmed;
  return `${trimmed.slice(0, space)}: ${trimmed.slice(space + 1)}`;
}

function RefreshButton({
  loading,
  onClick,
  label,
  ariaLabel,
}: {
  loading: boolean;
  onClick: () => void;
  label: string;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
    >
      <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
      {label}
    </button>
  );
}

function CenteredMessage({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card shadow-2xl px-8 py-16 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-xl border border-border bg-muted/60">
        {icon}
      </div>
      <h2 className="mb-2 text-base font-semibold text-foreground/80 font-mono uppercase tracking-wider">
        {title}
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

function AgentCard({ agent }: { agent: OpenClawAgent }) {
  const t = useTranslations("InstanceDetail");
  const name = agent.identityName ?? agent.id;

  return (
    <div className="rounded-xl border border-border bg-card shadow-2xl p-4">
      <div className="flex items-start gap-3">
        {/* Avatar tile */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50 text-xl">
          <span aria-hidden>{agent.identityEmoji || "🤖"}</span>
        </div>

        {/* Identity + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-foreground">
              {name}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {agent.id}
            </span>
            {agent.isDefault ? (
              <Badge
                variant="outline"
                className="border-violet-500/30 bg-violet-500/10 px-2 py-0 text-xs font-mono uppercase tracking-widest text-violet-400"
              >
                {t("agents.defaultBadge")}
              </Badge>
            ) : null}
          </div>
          {agent.model ? (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="font-mono text-xs text-muted-foreground">
                {t("agents.model")}:
              </span>
              <span className="font-mono text-xs text-foreground/80">
                {agent.model}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Binding chips */}
      {agent.bindingDetails.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
          {agent.bindingDetails.map((detail, i) => (
            <span
              key={`${detail}-${i}`}
              className="rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-xs text-muted-foreground"
            >
              {formatBinding(detail)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AgentsTab({
  instanceId,
  isProvisioning,
}: {
  instanceId: string;
  isProvisioning: boolean;
}) {
  const t = useTranslations("InstanceDetail");

  const { data, error, isLoading, mutate } = useSWR<AgentsResponse>(
    ["agents", instanceId],
    () =>
      fetch(`/api/instances/${instanceId}/agents`).then((res) => res.json()),
  );

  if (isProvisioning) {
    return (
      <CenteredMessage
        icon={<Bot className="h-8 w-8 text-muted-foreground/60" />}
        title={t("agents.provisioningTitle")}
        description={t("agents.provisioningDescription")}
      />
    );
  }

  const fetchError = error || data?.error;
  const agents = data?.agents ?? [];

  if (isLoading && !data) {
    return (
      <div aria-busy="true" aria-label={t("agents.loadingAria")} className="flex flex-col gap-3">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border border-border bg-card shadow-2xl"
          />
        ))}
      </div>
    );
  }

  if (fetchError) {
    return (
      <CenteredMessage
        icon={<AlertCircle className="h-8 w-8 text-red-500/70" />}
        title={t("agents.errorTitle")}
        description={t("agents.errorDescription")}
        action={
          <RefreshButton
            loading={isLoading}
            onClick={() => mutate()}
            label={t("agents.retry")}
            ariaLabel={t("agents.retry")}
          />
        }
      />
    );
  }

  if (agents.length === 0) {
    return (
      <CenteredMessage
        icon={<Inbox className="h-8 w-8 text-muted-foreground/60" />}
        title={t("agents.emptyTitle")}
        description={t("agents.emptyDescription")}
        action={
          <RefreshButton
            loading={isLoading}
            onClick={() => mutate()}
            label={t("agents.refresh")}
            ariaLabel={t("agents.refreshAria")}
          />
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground/80 font-mono uppercase tracking-wider">
            {t("agents.title")}
          </h2>
          <span className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
            {t("agents.count", { count: agents.length })}
          </span>
        </div>
        <RefreshButton
          loading={isLoading}
          onClick={() => mutate()}
          label={t("agents.refresh")}
          ariaLabel={t("agents.refreshAria")}
        />
      </div>

      {/* Card list */}
      <div className="flex flex-col gap-3">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update the call site**

In `src/components/dashboard/instance-detail.tsx`, find:

```tsx
        <TabsContent value="agents" className="mt-6">
          <AgentsTab />
        </TabsContent>
```

Replace with:

```tsx
        <TabsContent value="agents" className="mt-6">
          <AgentsTab
            instanceId={instance.id}
            isProvisioning={!!isProvisioning}
          />
        </TabsContent>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. Confirms `OpenClawAgent` type-only import resolves in the client component, props match, and the call site passes the right shape.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/tabs/agents-tab.tsx src/components/dashboard/instance-detail.tsx
git commit -m "$(cat <<'EOF'
feat(ui): rewrite Agents tab with live agent list

Replaces the placeholder with a SWR-backed card list of OpenClaw agents
fetched from /api/instances/[id]/agents. Shows identity emoji/name, id,
model, default badge, and binding chips, with provisioning/loading/error/
empty states and manual refresh.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Final verification

Confirm the whole feature hangs together and the project's gates pass.

**Files:** none (verification only).

- [ ] **Step 1: Run the test suite**

Run: `npm test`
Expected: PASS — `parseAgents` tests green, `auth-context` tests green, no failures.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual smoke test (dev server)**

Run: `npm run dev`
Then in the browser, for an instance that is fully provisioned and has agents:
- Open Dashboard → instance → **Agents** tab.
- Expect: title row "Agents" + count badge, a **Refresh** button, and one card per agent showing emoji avatar, identity name (or id), `id` in mono, violet **Default** badge on the default agent, model in mono, and binding chips (e.g. `telegram: accountId=default`).
- Click **Refresh** → spinner spins, list re-fetches.

For an instance still provisioning:
- Open the **Agents** tab → expect the "Setting up agents" centered state and **no network request** to `/api/instances/[id}/agents` (check DevTools Network).

Edge cases to spot-check if you can stage them:
- Instance with zero agents → "No agents found" empty state + Refresh.
- Instance whose SSH is unreachable / `openclaw` missing → "Couldn't load agents" error state + Retry.

- [ ] **Step 5: Stop the dev server**

`Ctrl-C` the `npm run dev` process.

- [ ] **Step 6: Final commit if any verification surfaced fixes**

If steps 1–3 required edits, stage and commit them. Otherwise nothing to commit — the feature is complete.

```bash
git status   # confirm clean working tree
```
Expected: nothing staged, feature fully committed across Tasks 1–5.

---

## Self-Review Notes

- **Spec coverage:** Every spec section maps to a task — API route (Task 3), `OpenClawAgent` type + `parseAgents` (Task 1), `listAgents` wrapper (Task 2), component + props + states + cards + binding parsing (Task 5), i18n en+es with the exact key set (Task 4), verification incl. `npm test && npm run lint` (Task 6). Non-gools (mutations, polling, routes/workspace/agentDir display) are absent.
- **Type consistency:** `OpenClawAgent` is defined once (Task 1, `ssh.ts`), produced by `parseAgents` (Task 1) and `listAgents` (Task 2), returned by the route (Task 3), and `import type`-ed by the component (Task 5) — same field names (`id`, `identityName`, `identityEmoji`, `model`, `isDefault`, `bindingDetails`) everywhere.
- **Deviation from spec (intentional, called out):** Spec said "export the type from the route file." Plan puts it in `src/lib/ssh.ts` next to `listAgents` instead, because the route imports from `ssh.ts` and a client component importing a *type* from there is safe (`import type` is erased — `ssh2` never reaches the client bundle). This avoids a circular route↔component dependency and is more DRY. Behavior is identical.
- **TDD scope:** The only unit-testable pure logic is `parseAgents` (the codebase tests pure functions in `node` env via `src/**/*.test.ts`; no jsdom/RTL setup exists for component or route-handler testing). `parseAgents` gets full coverage; `listAgents`, the route, and the component are verified by typecheck + lint + manual smoke test, matching how the rest of this codebase is tested.
