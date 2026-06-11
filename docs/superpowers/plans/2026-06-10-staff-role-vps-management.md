# Staff Role + Privileged VPS Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `staff` role whose holders deploy VPS instances without paying and manage every user's instances (full owner parity), with `STAFF` badge + owner tags in the dashboard.

**Architecture:** A single server-side helper (`getSessionContext`) resolves staff status from a `STAFF_EMAILS` env allowlist (self-healing into a persisted `user.role` column) and a single rule (`canAccessInstance`) decides per-instance access. Every Next.js route/action and the Socket.IO SSH server swap their raw `auth.api.getSession` + owner-scoped query for these two functions. The client receives `isStaff` for display only; all enforcement is server-side.

**Tech Stack:** TypeScript 5 (strict), Next.js 16 (App Router), Better Auth 1.4.18, Drizzle ORM + PostgreSQL, Socket.IO (custom `server.ts`), next-intl, shadcn/ui, Vitest (added by this plan). Package manager: **pnpm** (`pnpm-lock.yaml` present).

---

## Important context for the implementer

- **No test runner exists yet.** `package.json` has no `test` script and no vitest/jest. Task 1 sets up Vitest. CLAUDE.md's `npm test` currently fails — after Task 1 the command is `pnpm test`.
- **Use pnpm, not npm**, for installs (the repo has `pnpm-lock.yaml`; mixing npm corrupts the lockfile).
- **Test boundary (not a silent cap):** pure decision logic — `isStaffEmail`, `resolveRole`, `canAccessInstance` — is fully unit-tested (Task 3). Route handlers, DB writes, Better Auth session reads, and React components are wiring around those tested seams; there is no test database or DOM harness in this repo, and standing one up is out of scope (YAGNI). Those tasks verify via `pnpm lint` + `pnpm exec tsc --noEmit` + manual run. This boundary is intentional and called out so coverage gaps are visible.
- **Server-type values (real):** `PLAN_SERVER_TYPE = { basic: "cx23", pro: "cx33" }` (`src/lib/polar.ts:24`). The pre-existing free path defaults to `"cx22"`.
- **`getSessionContext(headers: Headers)` takes headers explicitly** — Next callers pass `await headers()`, `server.ts` passes its hand-built `Headers`. This avoids importing `next/headers` into the module shared with the custom server.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/lib/schema.ts` | `user.role` column | Modify |
| `src/lib/auth.ts` | Expose `role` on session via `additionalFields` | Modify |
| `drizzle/00XX_*.sql` | Migration adding `role` column | Create (generated) |
| `src/lib/auth-context.ts` | `isStaffEmail`, `resolveRole`, `getSessionContext`, `canAccessInstance` | Create |
| `src/lib/auth-context.test.ts` | Unit tests for the above pure functions | Create |
| `vitest.config.ts` | Vitest config | Create |
| `src/app/api/instances/route.ts` | GET all-for-staff + owner email; POST staff deploy bypass | Modify |
| `src/app/api/instances/[id]/route.ts` | GET/PATCH/DELETE access gate + write-clause fix | Modify |
| `src/app/api/instances/[id]/status/route.ts` | Access gate | Modify |
| `src/app/api/instances/[id]/reconfigure/route.ts` | Access gate + write-clause fix | Modify |
| `src/app/api/instances/[id]/whatsapp-numbers/route.ts` | Access gate (GET + POST) | Modify |
| `src/app/api/instances/[id]/pairing/route.ts` | Access gate (GET + POST) | Modify |
| `server.ts` | SSH `init` handler access gate | Modify |
| `src/app/[locale]/dashboard/page.tsx` | Staff fetch-all + owner email + pass `isStaff` | Modify |
| `src/app/[locale]/dashboard/[id]/page.tsx` | Detail access gate | Modify |
| `src/components/dashboard/dashboard-content.tsx` | `Instance` type + `isStaff` prop + `STAFF` badge + thread `currentUserId` | Modify |
| `src/components/dashboard/instance-card.tsx` | Owner tag on non-owned cards | Modify |
| `src/components/dashboard/deploy-dialog.tsx` | `isStaff` prop; staff skips checkout | Modify |
| `messages/en.json`, `messages/es.json` | `staffBadge`, `owner` keys | Modify |
| `.env.example` | Document `STAFF_EMAILS` | Modify |

---

## Task 1: Set up Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/smoke.test.ts` (temporary, deleted in Step 6)

- [ ] **Step 1: Install Vitest**

Run:
```bash
pnpm add -D vitest
```

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Add the `test` script**

In `package.json`, change the `scripts` block from:
```json
  "scripts": {
    "dev": "tsx server.ts",
    "build": "next build",
    "postbuild": "tsx scripts/indexnow-submit.ts",
    "start": "NODE_ENV=production tsx server.ts",
    "lint": "eslint"
  },
```
to:
```json
  "scripts": {
    "dev": "tsx server.ts",
    "build": "next build",
    "postbuild": "tsx scripts/indexnow-submit.ts",
    "start": "NODE_ENV=production tsx server.ts",
    "lint": "eslint",
    "test": "vitest run"
  },
```

- [ ] **Step 4: Write a smoke test**

Create `src/lib/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("vitest smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run it**

Run: `pnpm test`
Expected: PASS — 1 passed.

- [ ] **Step 6: Delete the smoke test and commit**

```bash
rm src/lib/smoke.test.ts
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore: add vitest test runner"
```

---

## Task 2: Add `role` column + expose it on the session

**Files:**
- Modify: `src/lib/schema.ts:9-17`
- Modify: `src/lib/auth.ts`
- Create: `drizzle/00XX_*.sql` (generated)

- [ ] **Step 1: Add the column to the schema**

In `src/lib/schema.ts`, change the `user` table from:
```ts
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull(),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});
```
to:
```ts
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull(),
  image: text("image"),
  role: text("role").notNull().default("user"), // 'user' | 'staff'
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});
```

- [ ] **Step 2: Expose `role` on the Better Auth session**

In `src/lib/auth.ts`, change:
```ts
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
    },
  }),
  socialProviders: {
```
to:
```ts
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
    },
  }),
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
        input: false, // clients cannot set their own role
      },
    },
  },
  socialProviders: {
```

- [ ] **Step 3: Generate the migration**

Run:
```bash
pnpm drizzle-kit generate
```
Expected: a new file `drizzle/00XX_*.sql` is created containing `ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;`. Open it and confirm that line is present.

- [ ] **Step 4: Apply the migration**

Run (requires `DATABASE_URL` to be set — locally it loads from `.env.development.local`):
```bash
pnpm drizzle-kit migrate
```
Expected: migration applies cleanly. Existing rows get `role = 'user'`.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/schema.ts src/lib/auth.ts drizzle/
git commit -m "feat: add user.role column and expose it on the session"
```

---

## Task 3: Authorization helper (`auth-context.ts`) — TDD

**Files:**
- Create: `src/lib/auth-context.ts`
- Create: `src/lib/auth-context.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/auth-context.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isStaffEmail, resolveRole, canAccessInstance } from "./auth-context";

describe("isStaffEmail", () => {
  const original = process.env.STAFF_EMAILS;
  afterEach(() => {
    process.env.STAFF_EMAILS = original;
  });

  it("returns true for an email in the allowlist (case/space-insensitive)", () => {
    process.env.STAFF_EMAILS = "alice@x.com, Bob@X.com";
    expect(isStaffEmail("alice@x.com")).toBe(true);
    expect(isStaffEmail("  ALICE@x.com ")).toBe(true);
    expect(isStaffEmail("bob@x.com")).toBe(true);
  });

  it("returns false for an email not in the allowlist", () => {
    process.env.STAFF_EMAILS = "alice@x.com";
    expect(isStaffEmail("carol@x.com")).toBe(false);
  });

  it("returns false when the allowlist is empty or unset", () => {
    process.env.STAFF_EMAILS = "";
    expect(isStaffEmail("alice@x.com")).toBe(false);
    delete process.env.STAFF_EMAILS;
    expect(isStaffEmail("alice@x.com")).toBe(false);
  });
});

describe("resolveRole", () => {
  beforeEach(() => {
    process.env.STAFF_EMAILS = "alice@x.com";
  });

  it("returns 'staff' for an allowlisted email", () => {
    expect(resolveRole("alice@x.com")).toBe("staff");
  });

  it("returns 'user' for a non-allowlisted email", () => {
    expect(resolveRole("carol@x.com")).toBe("user");
  });
});

describe("canAccessInstance", () => {
  it("allows the owner", () => {
    const ctx = { user: { id: "u1" }, isStaff: false };
    expect(canAccessInstance(ctx, { userId: "u1" })).toBe(true);
  });

  it("denies a non-staff non-owner", () => {
    const ctx = { user: { id: "u1" }, isStaff: false };
    expect(canAccessInstance(ctx, { userId: "u2" })).toBe(false);
  });

  it("allows staff on any instance", () => {
    const ctx = { user: { id: "u1" }, isStaff: true };
    expect(canAccessInstance(ctx, { userId: "u2" })).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — cannot resolve `./auth-context` (module does not exist yet).

- [ ] **Step 3: Implement `auth-context.ts`**

Create `src/lib/auth-context.ts`:
```ts
import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "./db";
import { user as userTable } from "./schema";

export type Role = "user" | "staff";

export type AuthContext = {
  user: { id: string; email: string; role: Role };
  isStaff: boolean;
};

/** Parse the server-only STAFF_EMAILS allowlist and test an email against it. */
export function isStaffEmail(email: string): boolean {
  const list = (process.env.STAFF_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

/** The env allowlist is the source of truth for staff status. */
export function resolveRole(email: string): Role {
  return isStaffEmail(email) ? "staff" : "user";
}

/** The single ownership/staff access rule. */
export function canAccessInstance(
  ctx: { user: { id: string }; isStaff: boolean },
  inst: { userId: string },
): boolean {
  return ctx.isStaff || inst.userId === ctx.user.id;
}

/**
 * Resolve the authenticated user + staff status.
 * Self-healing: if the env allowlist disagrees with the persisted role,
 * update the column (only when it actually differs — no write on the
 * common path where role already matches).
 *
 * `headers` is passed explicitly so this works both in Next.js routes
 * (`await headers()`) and in the custom Socket.IO server (hand-built Headers).
 */
export async function getSessionContext(
  headers: Headers,
): Promise<AuthContext | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;

  const { id, email } = session.user;
  const currentRole = ((session.user as { role?: string }).role ?? "user") as Role;
  const desired = resolveRole(email);

  if (desired !== currentRole) {
    await db.update(userTable).set({ role: desired }).where(eq(userTable.id, id));
  }

  return {
    user: { id, email, role: desired },
    isStaff: desired === "staff",
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS — all `isStaffEmail`, `resolveRole`, `canAccessInstance` tests green.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth-context.ts src/lib/auth-context.test.ts
git commit -m "feat: add auth-context helper with staff role resolution and access rule"
```

---

## Task 4: `/api/instances` — staff sees all + owner email; staff deploy bypass

**Files:**
- Modify: `src/app/api/instances/route.ts`

- [ ] **Step 1: Replace imports and the GET handler**

In `src/app/api/instances/route.ts`, change the top imports from:
```ts
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  getAvailableSubscription,
  isPolarConfigured,
  PLAN_SERVER_TYPE,
} from "@/lib/polar";
import { provisionInstance } from "@/lib/provision-instance";
import { assertProvisioningCapacity } from "@/lib/hetzner-limits";
```
to:
```ts
import { db } from "@/lib/db";
import { instance, user } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  getAvailableSubscription,
  isPolarConfigured,
  PLAN_SERVER_TYPE,
} from "@/lib/polar";
import { provisionInstance } from "@/lib/provision-instance";
import { assertProvisioningCapacity } from "@/lib/hetzner-limits";
import { getSessionContext } from "@/lib/auth-context";
```

- [ ] **Step 2: Replace the GET handler body**

Change the whole `GET` function from:
```ts
export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const instances = await db
    .select()
    .from(instance)
    .where(eq(instance.userId, session.user.id))
    .orderBy(desc(instance.createdAt));

  return NextResponse.json(instances);
}
```
to:
```ts
export async function GET() {
  const ctx = await getSessionContext(await headers());

  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Staff see every instance with the owner's email attached; regular
  // users see only their own (ownerEmail omitted — it's always them).
  if (ctx.isStaff) {
    const rows = await db
      .select()
      .from(instance)
      .leftJoin(user, eq(instance.userId, user.id))
      .orderBy(desc(instance.createdAt));

    const instances = rows.map((r) => ({
      ...r.instance,
      ownerEmail: r.user?.email ?? null,
    }));
    return NextResponse.json(instances);
  }

  const instances = await db
    .select()
    .from(instance)
    .where(eq(instance.userId, ctx.user.id))
    .orderBy(desc(instance.createdAt));

  return NextResponse.json(instances);
}
```

- [ ] **Step 3: Replace the POST handler**

Change the whole `POST` function from:
```ts
export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const capacity = await assertProvisioningCapacity();
  if (!capacity.ok) {
    return NextResponse.json({ error: capacity.error }, { status: 403 });
  }

  // OSS / dev mode only: when Polar is configured the deploy flow goes
  // through the checkout server action, not this endpoint.
  if (isPolarConfigured()) {
    const subscription = await getAvailableSubscription(session.user.id);
    if (!subscription) {
      return NextResponse.json(
        {
          error:
            "No available subscription. Each subscription supports one instance. Purchase another subscription or delete an existing instance.",
        },
        { status: 403 },
      );
    }

    const body = await request.json();
    const validation = validateBody(body);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    try {
      const created = await provisionInstance({
        userId: session.user.id,
        subscriptionId: subscription.id,
        serverType: PLAN_SERVER_TYPE[subscription.planType] || "cx22",
        ...validation.data,
      });
      return NextResponse.json(created, { status: 201 });
    } catch {
      return NextResponse.json(
        { error: "Failed to provision server" },
        { status: 500 },
      );
    }
  }

  const body = await request.json();
  const validation = validateBody(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const created = await provisionInstance({
      userId: session.user.id,
      subscriptionId: null,
      serverType: "cx22",
      ...validation.data,
    });
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to provision server" },
      { status: 500 },
    );
  }
}
```
to:
```ts
export async function POST(request: Request) {
  const ctx = await getSessionContext(await headers());

  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const capacity = await assertProvisioningCapacity();
  if (!capacity.ok) {
    return NextResponse.json({ error: capacity.error }, { status: 403 });
  }

  const body = await request.json();
  const validation = validateBody(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Staff bypass payment: provision directly with no subscription, using the
  // server size implied by the chosen plan tier. Capacity still applies above.
  if (ctx.isStaff) {
    const serverType =
      (validation.data.planType && PLAN_SERVER_TYPE[validation.data.planType]) ||
      "cx23";
    try {
      const created = await provisionInstance({
        userId: ctx.user.id,
        subscriptionId: null,
        serverType,
        ...stripPlanType(validation.data),
      });
      return NextResponse.json(created, { status: 201 });
    } catch {
      return NextResponse.json(
        { error: "Failed to provision server" },
        { status: 500 },
      );
    }
  }

  // OSS / dev mode only: when Polar is configured the paying deploy flow goes
  // through the checkout server action, not this endpoint.
  if (isPolarConfigured()) {
    const subscription = await getAvailableSubscription(ctx.user.id);
    if (!subscription) {
      return NextResponse.json(
        {
          error:
            "No available subscription. Each subscription supports one instance. Purchase another subscription or delete an existing instance.",
        },
        { status: 403 },
      );
    }

    try {
      const created = await provisionInstance({
        userId: ctx.user.id,
        subscriptionId: subscription.id,
        serverType: PLAN_SERVER_TYPE[subscription.planType] || "cx22",
        ...stripPlanType(validation.data),
      });
      return NextResponse.json(created, { status: 201 });
    } catch {
      return NextResponse.json(
        { error: "Failed to provision server" },
        { status: 500 },
      );
    }
  }

  try {
    const created = await provisionInstance({
      userId: ctx.user.id,
      subscriptionId: null,
      serverType: "cx22",
      ...stripPlanType(validation.data),
    });
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to provision server" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Extend `validateBody` to accept optional `planType` and add `stripPlanType`**

Change the bottom of the file from:
```ts
type ValidatedBody = {
  name: string;
  model: string;
  modelApiKey: string | null;
  channel: string;
  botToken?: string;
  channelPhone?: string | null;
};

function validateBody(
  body: unknown,
): { ok: true; data: ValidatedBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid body" };
  }
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const model = typeof b.model === "string" ? b.model.trim() : "";
  const channel = typeof b.channel === "string" ? b.channel : "";
  const modelApiKey =
    typeof b.modelApiKey === "string" ? b.modelApiKey : null;
  const botToken = typeof b.botToken === "string" ? b.botToken : undefined;
  const channelPhone =
    typeof b.channelPhone === "string" ? b.channelPhone : undefined;

  if (!name || !model || !channel) {
    return { ok: false, error: "Missing required fields" };
  }
  if (channel === "telegram" && !botToken) {
    return { ok: false, error: "Telegram requires a bot token" };
  }
  if (channel === "whatsapp" && !channelPhone) {
    return { ok: false, error: "WhatsApp requires a phone number" };
  }
  return {
    ok: true,
    data: { name, model, modelApiKey, channel, botToken, channelPhone },
  };
}
```
to:
```ts
type PlanType = "basic" | "pro";

type ValidatedBody = {
  name: string;
  model: string;
  modelApiKey: string | null;
  channel: string;
  botToken?: string;
  channelPhone?: string | null;
  planType?: PlanType;
};

/** Drop the staff-only planType before passing to provisionInstance. */
function stripPlanType(data: ValidatedBody) {
  const { planType: _planType, ...rest } = data;
  return rest;
}

function validateBody(
  body: unknown,
): { ok: true; data: ValidatedBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid body" };
  }
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const model = typeof b.model === "string" ? b.model.trim() : "";
  const channel = typeof b.channel === "string" ? b.channel : "";
  const modelApiKey =
    typeof b.modelApiKey === "string" ? b.modelApiKey : null;
  const botToken = typeof b.botToken === "string" ? b.botToken : undefined;
  const channelPhone =
    typeof b.channelPhone === "string" ? b.channelPhone : undefined;
  const planType =
    b.planType === "basic" || b.planType === "pro" ? b.planType : undefined;

  if (!name || !model || !channel) {
    return { ok: false, error: "Missing required fields" };
  }
  if (channel === "telegram" && !botToken) {
    return { ok: false, error: "Telegram requires a bot token" };
  }
  if (channel === "whatsapp" && !channelPhone) {
    return { ok: false, error: "WhatsApp requires a phone number" };
  }
  return {
    ok: true,
    data: { name, model, modelApiKey, channel, botToken, channelPhone, planType },
  };
}
```

- [ ] **Step 5: Type-check and lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors. (If `provisionInstance` rejects an unknown `planType` key, that is why `stripPlanType` is used — confirm the spread passes only the expected fields.)

- [ ] **Step 6: Commit**

```bash
git add src/app/api/instances/route.ts
git commit -m "feat: staff see all instances and deploy without payment"
```

---

## Task 5: `/api/instances/[id]` — access gate + write-clause fix

**Files:**
- Modify: `src/app/api/instances/[id]/route.ts`

- [ ] **Step 1: Swap imports**

Change:
```ts
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { deleteServer, powerOn, powerOff, deleteSSHKey } from "@/lib/hetzner";
import { deleteTunnel, deleteDnsRecord } from "@/lib/cloudflare";
```
to:
```ts
import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { deleteServer, powerOn, powerOff, deleteSSHKey } from "@/lib/hetzner";
import { deleteTunnel, deleteDnsRecord } from "@/lib/cloudflare";
import { getSessionContext, canAccessInstance } from "@/lib/auth-context";
```
(`and` is removed because every owner-scoped `and(eq(id), eq(userId))` becomes `eq(id)` + an access check.)

- [ ] **Step 2: Rewrite GET**

Change:
```ts
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [inst] = await db
    .select()
    .from(instance)
    .where(and(eq(instance.id, id), eq(instance.userId, session.user.id)));

  if (!inst) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(inst);
}
```
to:
```ts
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getSessionContext(await headers());

  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [inst] = await db.select().from(instance).where(eq(instance.id, id));

  if (!inst || !canAccessInstance(ctx, inst)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(inst);
}
```

- [ ] **Step 3: Rewrite PATCH (note the write-clause)**

Change:
```ts
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { name, status, model, modelApiKey } = body;

  // Fetch the current instance to get the Hetzner server ID
  const [current] = await db
    .select()
    .from(instance)
    .where(and(eq(instance.id, id), eq(instance.userId, session.user.id)));

  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
```
to:
```ts
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getSessionContext(await headers());

  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { name, status, model, modelApiKey } = body;

  // Fetch the current instance to get the Hetzner server ID
  const [current] = await db
    .select()
    .from(instance)
    .where(eq(instance.id, id));

  if (!current || !canAccessInstance(ctx, current)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
```
Then change the update write-clause near the end of PATCH from:
```ts
  const [updated] = await db
    .update(instance)
    .set(updateData)
    .where(and(eq(instance.id, id), eq(instance.userId, session.user.id)))
    .returning();
```
to:
```ts
  const [updated] = await db
    .update(instance)
    .set(updateData)
    .where(eq(instance.id, id))
    .returning();
```

- [ ] **Step 4: Rewrite DELETE (note the write-clause)**

Change the DELETE auth + fetch from:
```ts
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Fetch instance to get the Hetzner server ID
  const [current] = await db
    .select()
    .from(instance)
    .where(and(eq(instance.id, id), eq(instance.userId, session.user.id)));

  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
```
to:
```ts
  const ctx = await getSessionContext(await headers());

  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Fetch instance to get the Hetzner server ID
  const [current] = await db
    .select()
    .from(instance)
    .where(eq(instance.id, id));

  if (!current || !canAccessInstance(ctx, current)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
```
Then change the delete write-clause near the end from:
```ts
  const [deleted] = await db
    .delete(instance)
    .where(and(eq(instance.id, id), eq(instance.userId, session.user.id)))
    .returning();
```
to:
```ts
  const [deleted] = await db
    .delete(instance)
    .where(eq(instance.id, id))
    .returning();
```

- [ ] **Step 5: Type-check and lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors, no unused `and`/`auth` imports.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/instances/[id]/route.ts
git commit -m "feat: staff full parity on instance detail route"
```

---

## Task 6: Sub-routes (`status`, `reconfigure`, `whatsapp-numbers`, `pairing`) — access gate

Each sub-route follows the **same mechanical change**: import `getSessionContext` + `canAccessInstance`, drop `auth`, replace each `auth.api.getSession`/owner-scoped fetch with the context + `canAccessInstance`, and change any `db.update`/`db.delete` write `.where(and(eq(id), eq(userId)))` to `.where(eq(id))`. `status` and `pairing`/`whatsapp-numbers` may keep `and` if used elsewhere; remove it if it becomes unused.

### 6a: `status/route.ts`

- [ ] **Step 1: Swap imports**

Change:
```ts
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
```
to:
```ts
import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getSessionContext, canAccessInstance } from "@/lib/auth-context";
```

- [ ] **Step 2: Gate the GET handler**

Change:
```ts
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [inst] = await db
    .select()
    .from(instance)
    .where(and(eq(instance.id, id), eq(instance.userId, session.user.id)));

  if (!inst) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
```
to:
```ts
  const ctx = await getSessionContext(await headers());

  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [inst] = await db.select().from(instance).where(eq(instance.id, id));

  if (!inst || !canAccessInstance(ctx, inst)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
```

> If this file later writes back the instance status with `db.update(...).where(and(eq(instance.id, ...), eq(instance.userId, ...)))`, change that write-clause to `.where(eq(instance.id, id))` too. (Read the rest of the file and apply the same rule to any owner-scoped write.)

### 6b: `reconfigure/route.ts` (has a write-clause at line ~170)

- [ ] **Step 3: Swap imports** — same import edit as 6a Step 1.

- [ ] **Step 4: Gate the fetch (~line 51)**

Change:
```ts
  const session = await auth.api.getSession({
```
…through the owner-scoped fetch…
```ts
    .where(and(eq(instance.id, id), eq(instance.userId, session.user.id)));

  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
```
to the context form:
```ts
  const ctx = await getSessionContext(await headers());

  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
```
…and the fetch to:
```ts
    .where(eq(instance.id, id));

  if (!current || !canAccessInstance(ctx, current)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
```
(Match the existing variable name — it may be `current` or `inst`. Replace `session.user.id` references accordingly with `ctx.user.id` if any remain for the `userId` of a NEW row; reconfigure operates on the existing instance, so there should be none.)

- [ ] **Step 5: Fix the write-clause (~line 170)**

Change:
```ts
      .where(and(eq(instance.id, id), eq(instance.userId, session.user.id)));
```
to:
```ts
      .where(eq(instance.id, id));
```

### 6c: `whatsapp-numbers/route.ts` (GET ~line 44, POST ~line 120)

- [ ] **Step 6: Swap imports** — same import edit as 6a Step 1.

- [ ] **Step 7: Gate the GET handler** — replace the `auth.api.getSession` + owner-scoped fetch (~line 22–44) with the context form, exactly as in 6a Step 2.

- [ ] **Step 8: Gate the POST handler** — replace the second `auth.api.getSession` (~line 98) + owner-scoped fetch (~line 120) with the same context form. If the POST writes back with an owner-scoped `.where(and(...))`, change it to `.where(eq(instance.id, id))`.

### 6d: `pairing/route.ts` (GET ~line 32, POST ~line 97)

- [ ] **Step 9: Swap imports** — same import edit as 6a Step 1.

- [ ] **Step 10: Gate the GET handler** (~line 19–32) and **the POST handler** (~line 75–97) with the context form. Change any owner-scoped write `.where(and(...))` to `.where(eq(instance.id, id))`.

### Verify 6

- [ ] **Step 11: Type-check and lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: no errors; confirm no `auth` or unused `and` imports remain in the four files (grep below).

```bash
grep -rn "auth.api.getSession\|instance.userId, session" src/app/api/instances/[id]/status/route.ts src/app/api/instances/[id]/reconfigure/route.ts src/app/api/instances/[id]/whatsapp-numbers/route.ts src/app/api/instances/[id]/pairing/route.ts
```
Expected: no matches.

- [ ] **Step 12: Commit**

```bash
git add src/app/api/instances/[id]/status/route.ts src/app/api/instances/[id]/reconfigure/route.ts src/app/api/instances/[id]/whatsapp-numbers/route.ts src/app/api/instances/[id]/pairing/route.ts
git commit -m "feat: staff full parity on instance sub-routes"
```

---

## Task 7: SSH server (`server.ts`) — access gate

**Files:**
- Modify: `server.ts`

- [ ] **Step 1: Swap imports**

Change:
```ts
import { db } from "./src/lib/db.js";
import { instance } from "./src/lib/schema.js";
import { auth } from "./src/lib/auth.js";
import { eq, and } from "drizzle-orm";
```
to:
```ts
import { db } from "./src/lib/db.js";
import { instance } from "./src/lib/schema.js";
import { getSessionContext, canAccessInstance } from "./src/lib/auth-context.js";
import { eq } from "drizzle-orm";
```

- [ ] **Step 2: Use `getSessionContext` in the auth middleware**

Change:
```ts
      const session = await auth.api.getSession({ headers });
      if (!session) return next(new Error("Unauthorized"));

      socket.data.user = session.user;
      next();
```
to:
```ts
      const ctx = await getSessionContext(headers);
      if (!ctx) return next(new Error("Unauthorized"));

      socket.data.ctx = ctx;
      next();
```

- [ ] **Step 3: Gate the `init` handler with `canAccessInstance`**

Change:
```ts
    socket.on("init", async ({ instanceId }: { instanceId: string }) => {
      try {
        const user = socket.data.user;
        const [inst] = await db
          .select()
          .from(instance)
          .where(
            and(eq(instance.id, instanceId), eq(instance.userId, user.id)),
          );

        if (!inst) {
          socket.emit("error", "Instance not found or unauthorized");
          socket.disconnect();
          return;
        }
```
to:
```ts
    socket.on("init", async ({ instanceId }: { instanceId: string }) => {
      try {
        const ctx = socket.data.ctx;
        const [inst] = await db
          .select()
          .from(instance)
          .where(eq(instance.id, instanceId));

        if (!inst || !canAccessInstance(ctx, inst)) {
          socket.emit("error", "Instance not found or unauthorized");
          socket.disconnect();
          return;
        }
```

- [ ] **Step 4: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors (`and` no longer imported, `auth` no longer imported).

- [ ] **Step 5: Manual smoke (optional but recommended)**

Run `pnpm dev`, open an instance you own → SSH tab → confirm the terminal still connects. (Staff-on-other-user verification happens in the final manual pass, Task 11.)

- [ ] **Step 6: Commit**

```bash
git add server.ts
git commit -m "feat: staff full parity for SSH terminal"
```

---

## Task 8: Dashboard list page — staff fetch-all + owner email + pass `isStaff`

**Files:**
- Modify: `src/app/[locale]/dashboard/page.tsx`

- [ ] **Step 1: Rewrite the page**

Change the whole file from:
```ts
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { getUserSubscription } from "@/lib/polar";
import { getCapacitySnapshot } from "@/lib/hetzner-limits";
import { setRequestLocale } from "next-intl/server";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/");
  }

  const [instances, currentSubscription, capacity] = await Promise.all([
    db
      .select()
      .from(instance)
      .where(eq(instance.userId, session.user.id))
      .orderBy(desc(instance.createdAt)),
    getUserSubscription(session.user.id),
    getCapacitySnapshot().catch(() => undefined),
  ]);

  return (
    <DashboardContent
      initialInstances={instances}
      subscription={currentSubscription}
      user={{ id: session.user.id, email: session.user.email }}
      capacity={capacity}
    />
  );
}
```
to:
```ts
import { db } from "@/lib/db";
import { instance, user } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { getUserSubscription } from "@/lib/polar";
import { getCapacitySnapshot } from "@/lib/hetzner-limits";
import { setRequestLocale } from "next-intl/server";
import { getSessionContext } from "@/lib/auth-context";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getSessionContext(await headers());

  if (!ctx) {
    redirect("/");
  }

  // Staff see every instance with the owner's email; users see only their own.
  const instancesPromise = ctx.isStaff
    ? db
        .select()
        .from(instance)
        .leftJoin(user, eq(instance.userId, user.id))
        .orderBy(desc(instance.createdAt))
        .then((rows) =>
          rows.map((r) => ({ ...r.instance, ownerEmail: r.user?.email ?? null })),
        )
    : db
        .select()
        .from(instance)
        .where(eq(instance.userId, ctx.user.id))
        .orderBy(desc(instance.createdAt));

  const [instances, currentSubscription, capacity] = await Promise.all([
    instancesPromise,
    getUserSubscription(ctx.user.id),
    getCapacitySnapshot().catch(() => undefined),
  ]);

  return (
    <DashboardContent
      initialInstances={instances}
      subscription={currentSubscription}
      user={{ id: ctx.user.id, email: ctx.user.email }}
      isStaff={ctx.isStaff}
      capacity={capacity}
    />
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: an error that `DashboardContent` has no `isStaff` prop and `initialInstances` shape mismatch on `ownerEmail`. That is expected — Task 10 fixes the component types. Do NOT commit yet; proceed to Task 9 and 10, then type-check together.

---

## Task 9: Instance detail page — access gate

**Files:**
- Modify: `src/app/[locale]/dashboard/[id]/page.tsx`

- [ ] **Step 1: Rewrite the page**

Change the whole file from:
```ts
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { InstanceDetail } from "@/components/dashboard/instance-detail";
import { setRequestLocale } from "next-intl/server";

export default async function InstancePage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  setRequestLocale(locale);

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/");
  }

  const [inst] = await db
    .select()
    .from(instance)
    .where(and(eq(instance.id, id), eq(instance.userId, session.user.id)));

  if (!inst) {
    notFound();
  }

  return (
    <InstanceDetail
      initialInstance={{
        ...inst,
        createdAt: inst.createdAt,
      }}
    />
  );
}
```
to:
```ts
import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { InstanceDetail } from "@/components/dashboard/instance-detail";
import { setRequestLocale } from "next-intl/server";
import { getSessionContext, canAccessInstance } from "@/lib/auth-context";

export default async function InstancePage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  setRequestLocale(locale);

  const ctx = await getSessionContext(await headers());

  if (!ctx) {
    redirect("/");
  }

  const [inst] = await db.select().from(instance).where(eq(instance.id, id));

  if (!inst || !canAccessInstance(ctx, inst)) {
    notFound();
  }

  return (
    <InstanceDetail
      initialInstance={{
        ...inst,
        createdAt: inst.createdAt,
      }}
    />
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: no NEW errors from this file (the Task 8 component errors still show until Task 10).

---

## Task 10: Frontend — `isStaff` badge, owner tags, staff deploy bypass, i18n

**Files:**
- Modify: `src/components/dashboard/dashboard-content.tsx`
- Modify: `src/components/dashboard/instance-card.tsx`
- Modify: `src/components/dashboard/deploy-dialog.tsx`
- Modify: `messages/en.json`, `messages/es.json`

- [ ] **Step 1: Extend the `Instance` type and `DashboardProps`, accept `isStaff`**

In `src/components/dashboard/dashboard-content.tsx`, change the `Instance` interface from:
```ts
export interface Instance {
  id: string;
  name: string;
  model: string;
  modelApiKey: string | null;
  channel: string;
  botToken: string;
  status: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}
```
to:
```ts
export interface Instance {
  id: string;
  name: string;
  model: string;
  modelApiKey: string | null;
  channel: string;
  botToken: string;
  status: string;
  userId: string;
  ownerEmail?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```
And change `DashboardProps` from:
```ts
interface DashboardProps {
  initialInstances: Instance[];
  subscription: Subscription | null;
  user: { id: string; email: string };
  capacity?: CapacitySnapshot;
}
```
to:
```ts
interface DashboardProps {
  initialInstances: Instance[];
  subscription: Subscription | null;
  user: { id: string; email: string };
  isStaff: boolean;
  capacity?: CapacitySnapshot;
}
```

- [ ] **Step 2: Destructure `isStaff` and pass it down**

Change the component signature from:
```ts
export function DashboardContent({
  initialInstances,
  subscription,
  user,
  capacity,
}: DashboardProps) {
```
to:
```ts
export function DashboardContent({
  initialInstances,
  subscription,
  user,
  isStaff,
  capacity,
}: DashboardProps) {
```

- [ ] **Step 3: Render the `STAFF` badge in the header**

In `dashboard-content.tsx`, find the header `<div className="flex items-center gap-3 mb-1">` block that renders the plan label badge and the `<CapacityBadge />`. Immediately after the `<CapacityBadge initial={capacity} />` line, add:
```tsx
            {isStaff && (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-xs font-mono font-semibold uppercase tracking-widest text-violet-400">
                {t("staffBadge")}
              </span>
            )}
```

- [ ] **Step 4: Pass `currentUserId` to each card**

Change the instance grid map from:
```tsx
          {instances.map((inst) => (
            <InstanceCard
              key={inst.id}
              instance={inst}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
```
to:
```tsx
          {instances.map((inst) => (
            <InstanceCard
              key={inst.id}
              instance={inst}
              currentUserId={user.id}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
```

- [ ] **Step 5: Pass `isStaff` to the DeployDialog**

Change:
```tsx
      <DeployDialog
        open={deployOpen}
        onOpenChange={setDeployOpen}
        onInstanceCreated={handleInstanceCreated}
      />
```
to:
```tsx
      <DeployDialog
        open={deployOpen}
        onOpenChange={setDeployOpen}
        onInstanceCreated={handleInstanceCreated}
        isStaff={isStaff}
      />
```

- [ ] **Step 6: Owner tag in `instance-card.tsx`**

Change the component signature from:
```tsx
export function InstanceCard({
  instance,
  onStatusChange,
  onDelete,
}: {
  instance: Instance;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
```
to:
```tsx
export function InstanceCard({
  instance,
  currentUserId,
  onStatusChange,
  onDelete,
}: {
  instance: Instance;
  currentUserId: string;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
```
Then, in the top row's name/date column, change:
```tsx
        <div className="flex flex-col min-w-0 pr-3">
          <h3 className="text-sm font-medium tracking-tight text-foreground mb-0.5 truncate">
            {instance.name}
          </h3>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest truncate">
            {new Date(instance.createdAt).toISOString().split("T")[0]}
          </p>
        </div>
```
to:
```tsx
        <div className="flex flex-col min-w-0 pr-3">
          <h3 className="text-sm font-medium tracking-tight text-foreground mb-0.5 truncate">
            {instance.name}
          </h3>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest truncate">
            {new Date(instance.createdAt).toISOString().split("T")[0]}
          </p>
          {instance.ownerEmail && instance.userId !== currentUserId && (
            <p className="mt-0.5 text-xs font-mono text-violet-400/80 truncate">
              {t("owner")}: {instance.ownerEmail}
            </p>
          )}
        </div>
```

- [ ] **Step 7: `isStaff` in `deploy-dialog.tsx` — accept the prop**

Change the props signature from:
```tsx
export function DeployDialog({
  open,
  onOpenChange,
  onInstanceCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstanceCreated: (instance: Instance) => void;
}) {
```
to:
```tsx
export function DeployDialog({
  open,
  onOpenChange,
  onInstanceCreated,
  isStaff,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstanceCreated: (instance: Instance) => void;
  isStaff: boolean;
}) {
```

- [ ] **Step 8: Staff path in `handleSubmit`**

In `deploy-dialog.tsx`, change the start of `handleSubmit` from:
```tsx
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (PAID_MODE) {
        const res = await createPendingCheckout({
```
to:
```tsx
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Staff deploy directly without payment, even in PAID_MODE.
      if (PAID_MODE && !isStaff) {
        const res = await createPendingCheckout({
```
Then change the direct-provision `fetch` body to include `planType` so staff get the right server size. Change:
```tsx
      const res = await fetch("/api/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          model: finalModelId,
          modelApiKey: activeApiKey,
          channel: selectedChannel,
          ...(selectedChannel === "telegram"
            ? { botToken: botToken.trim() }
            : {}),
          ...(selectedChannel === "whatsapp"
            ? { channelPhone: whatsappPhone.trim() }
            : {}),
        }),
      });
```
to:
```tsx
      const res = await fetch("/api/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          model: finalModelId,
          modelApiKey: activeApiKey,
          channel: selectedChannel,
          ...(selectedChannel === "telegram"
            ? { botToken: botToken.trim() }
            : {}),
          ...(selectedChannel === "whatsapp"
            ? { channelPhone: whatsappPhone.trim() }
            : {}),
          ...(isStaff && selectedPlan ? { planType: selectedPlan } : {}),
        }),
      });
```

> Note: in PAID_MODE the dialog has 4 steps (the Plan step sets `selectedPlan`), so a staff user picks the size there and it flows through as `planType`. The submit-button label still shows the checkout copy in PAID_MODE; change it to the deploy copy for staff in the next step.

- [ ] **Step 9: Staff submit-button label**

In the footer submit `<Button>`, change:
```tsx
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {PAID_MODE ? t("redirecting") : t("deploying")}
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4" />
                  {PAID_MODE ? t("continueToCheckout") : t("deployInstance")}
                </>
              )}
```
to:
```tsx
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {PAID_MODE && !isStaff ? t("redirecting") : t("deploying")}
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4" />
                  {PAID_MODE && !isStaff
                    ? t("continueToCheckout")
                    : t("deployInstance")}
                </>
              )}
```

- [ ] **Step 10: Add i18n keys (en + es)**

In `messages/en.json`, change the `Dashboard` block's last key from:
```json
    "checkoutSuccessTitle": "Payment received",
    "checkoutSuccessBody": "Your AI employee is being provisioned. This usually takes 1–2 minutes — the page will refresh automatically."
  },
```
to:
```json
    "checkoutSuccessTitle": "Payment received",
    "checkoutSuccessBody": "Your AI employee is being provisioned. This usually takes 1–2 minutes — the page will refresh automatically.",
    "staffBadge": "Staff"
  },
```
In `messages/en.json`, change the `InstanceCard` block's last key from:
```json
    "cancel": "Cancel",
    "confirmDelete": "Confirm Delete"
  },
```
to:
```json
    "cancel": "Cancel",
    "confirmDelete": "Confirm Delete",
    "owner": "Owner"
  },
```
In `messages/es.json`, change the `Dashboard` block's last key from:
```json
    "checkoutSuccessTitle": "Pago recibido",
    "checkoutSuccessBody": "Tu empleado IA se está aprovisionando. Esto suele tardar 1–2 minutos — la página se actualizará automáticamente."
  },
```
to:
```json
    "checkoutSuccessTitle": "Pago recibido",
    "checkoutSuccessBody": "Tu empleado IA se está aprovisionando. Esto suele tardar 1–2 minutos — la página se actualizará automáticamente.",
    "staffBadge": "Staff"
  },
```
In `messages/es.json`, change the `InstanceCard` block's last key from:
```json
    "cancel": "Cancelar",
    "confirmDelete": "Confirmar Eliminación"
  },
```
to:
```json
    "cancel": "Cancelar",
    "confirmDelete": "Confirmar Eliminación",
    "owner": "Propietario"
  },
```

- [ ] **Step 11: Type-check, lint, and run the test suite**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm test`
Expected: no type errors (Task 8 errors are now resolved), lint clean, tests pass.

- [ ] **Step 12: Commit**

```bash
git add src/components/dashboard/dashboard-content.tsx src/components/dashboard/instance-card.tsx src/components/dashboard/deploy-dialog.tsx src/app/[locale]/dashboard/page.tsx src/app/[locale]/dashboard/[id]/page.tsx messages/en.json messages/es.json
git commit -m "feat: staff badge, owner tags, and staff deploy bypass in the dashboard"
```

---

## Task 11: Document env + final verification

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Document `STAFF_EMAILS`**

Append to `.env.example`:
```bash
# Comma-separated allowlist of staff emails. Staff can deploy VPS instances
# without paying and manage any user's instances. Server-only — never expose
# with a NEXT_PUBLIC_ prefix.
STAFF_EMAILS=
```

- [ ] **Step 2: Full gate**

Run: `pnpm test && pnpm lint && pnpm exec tsc --noEmit`
Expected: all pass.

- [ ] **Step 3: Manual end-to-end pass**

1. Set `STAFF_EMAILS` in `.env.development.local` to your own login email. `pnpm dev`.
2. Dashboard header shows the `STAFF` badge.
3. Deploy flow: in PAID_MODE, pick a plan/size → submit deploys directly (no Polar redirect), lands on the new instance.
4. With a SECOND, non-staff account, create an instance. Back as staff, confirm that instance appears in your dashboard tagged `Owner: <their email>`, and you can open its detail, SSH tab, start/stop, reconfigure, and delete it.
5. Remove your email from `STAFF_EMAILS`, restart, reload dashboard → badge gone, only your own instances show, others' detail pages return 404. (Confirms self-healing demotion.)

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "docs: document STAFF_EMAILS env var"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- §1 Data model → Task 2 ✓
- §2 Role resolution (env allowlist, self-healing, server-only) → Task 3 (`isStaffEmail`, `resolveRole`, `getSessionContext` conditional write) + Task 11 (`.env.example`) ✓
- §3 Authorization layer (`getSessionContext`, `canAccessInstance`, header-injection) → Task 3 + used everywhere ✓
- §4 API changes (GET all-for-staff+owner, POST bypass+planType+capacity, [id] gate + write-clause, sub-routes, validateBody) → Tasks 4, 5, 6 ✓
- §5 Deploy/payment bypass (frontend) → Task 10 (deploy-dialog) ✓
- §6 Frontend indicators (STAFF badge, owner tag, detail page) → Tasks 8, 9, 10 ✓
- §7 Security (server-side only, server-only env, capacity applies) → enforced in Tasks 3/4; client `isStaff` display-only ✓
- §8 Testing (`isStaffEmail`, sync, `canAccessInstance`) → Task 3 (sync covered via `resolveRole` seam; boundary documented above) ✓
- SSH terminal (`server.ts`) → Task 7 ✓

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to". Sub-routes (Task 6) reference approximate line numbers because the four files share the identical mechanical edit shown verbatim in 6a; each step states the exact old→new transform.

**Type consistency:** `getSessionContext(headers: Headers)`, `canAccessInstance(ctx, inst)`, `AuthContext`, `ownerEmail?: string | null`, `isStaff: boolean`, `currentUserId: string`, `planType?: "basic" | "pro"` are used identically across all tasks.
