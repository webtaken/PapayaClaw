# Templates (v1: default SOUL.md) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users deploy an OpenClaw instance pre-loaded with a curated personality (`SOUL.md`) via reusable "templates," shipping the first template — **Fórmula 100K** — with public pages, deploy-time baking, and live re-apply.

**Architecture:** A DB `template` table holds each template's metadata + `SOUL.md`. Public `/templates` pages render from the DB and deep-link into the existing `DeployDialog` with a `templateId`. A single shared shell-snippet builder (`buildSoulWriteCommand`) writes `SOUL.md` on the VPS — invoked both by cloud-init at deploy and by an SSH re-apply route — so deploy and re-apply can never drift on path/encoding.

**Tech Stack:** TypeScript 5 (strict), Next.js 16 (App Router, React Compiler), React 19, Drizzle ORM + PostgreSQL, next-intl 4.8 (en+es), shadcn/ui, Tailwind 4, vitest, ssh2.

## Global Constraints

- TypeScript strict mode; no `any` in new code unless mirroring an existing defensive parser.
- next-intl `localePrefix: "as-needed"` — `en` is unprefixed, `es` is `/es/...`. Locales: `["en","es"]`.
- For links to `/api/*` use a raw `<a>`, never the i18n `<Link>` (it 404s on non-`en` locales). Template gallery/detail links are normal pages → i18n `<Link>` is fine.
- DB is **shared between dev and prod** (`.env.development.local` carries the prod `DATABASE_URL`). Migrations and the seed script run against prod — the seed MUST be idempotent (upsert on `slug`).
- vitest only discovers `src/**/*.test.ts` (see `vitest.config.ts`). Unit tests live under `src/`.
- New UI (public pages, dialog banner, re-apply module) must be built with the **frontend-design / interface-design / shadcn** skills, matching the existing dark, mono-accented dashboard aesthetic.
- Run `npm test && npm run lint` green before each commit that touches testable/lintable code.
- Template body content (name/tagline/summary/SOUL.md) is **Spanish** for Fórmula 100K. UI chrome strings go through next-intl in both `en` and `es`.

---

### Task 1: SOUL.md write-command builder (shared)

The keystone. A pure function returning the bash snippet that writes `SOUL.md` into the OpenClaw workspace. Reused by cloud-init (Task 2) and the re-apply route (Task 11). Resolves the workspace at runtime from `agents.defaults.workspace` with a hard fallback, so we never hardcode a path that could shift between OpenClaw versions. Content is base64-encoded so arbitrary Markdown survives both cloud-init YAML and SSH command strings.

**Files:**
- Create: `src/lib/openclaw-soul.ts`
- Test: `src/lib/openclaw-soul.test.ts`

**Interfaces:**
- Produces: `DEFAULT_WORKSPACE: string`; `buildSoulWriteCommand(soulMd: string): string`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/openclaw-soul.test.ts
import { describe, it, expect } from "vitest";
import { buildSoulWriteCommand, DEFAULT_WORKSPACE } from "./openclaw-soul";

describe("buildSoulWriteCommand", () => {
  it("base64-encodes the content so it round-trips", () => {
    const soul = 'Eres un coach.\nUsa "comillas", $vars y `backticks`.';
    const cmd = buildSoulWriteCommand(soul);
    const expectedB64 = Buffer.from(soul, "utf8").toString("base64");
    expect(cmd).toContain(expectedB64);
    expect(cmd).toContain("base64 -d");
    // the encoded blob round-trips back to the original
    expect(Buffer.from(expectedB64, "base64").toString("utf8")).toBe(soul);
  });

  it("writes to <workspace>/SOUL.md and resolves the workspace at runtime", () => {
    const cmd = buildSoulWriteCommand("hola");
    expect(cmd).toContain("agents.defaults.workspace");
    expect(cmd).toContain('"$OC_WS/SOUL.md"');
    expect(cmd).toContain('mkdir -p "$OC_WS"');
  });

  it("falls back to the default workspace when config is empty or null", () => {
    const cmd = buildSoulWriteCommand("hola");
    expect(DEFAULT_WORKSPACE).toBe("/root/.openclaw/workspace");
    expect(cmd).toContain(DEFAULT_WORKSPACE);
    expect(cmd).toContain('""|null)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/openclaw-soul.test.ts`
Expected: FAIL — `Cannot find module './openclaw-soul'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/openclaw-soul.ts
/**
 * Shared SOUL.md write logic for OpenClaw VPS instances.
 *
 * The agent's personality lives in <workspace>/SOUL.md, where <workspace> is
 * `agents.defaults.workspace` (default ~/.openclaw/workspace). We resolve it at
 * runtime rather than hardcoding, so the same builder is correct across OpenClaw
 * versions. Both the deploy path (cloud-init) and the live re-apply path (SSH)
 * call this — guaranteeing identical path + encoding.
 *
 * Requires `openclaw` and `base64` on PATH (both present in our cloud-init setup
 * script and the reconfigure/apply SSH commands).
 */

export const DEFAULT_WORKSPACE = "/root/.openclaw/workspace";

/**
 * Returns a bash snippet that writes `soulMd` to <workspace>/SOUL.md on the VPS.
 * Content is base64-encoded so quotes, `$`, backticks, and newlines survive
 * transport through cloud-init YAML and SSH command strings.
 */
export function buildSoulWriteCommand(soulMd: string): string {
  const b64 = Buffer.from(soulMd, "utf8").toString("base64");
  return [
    `OC_WS=$(openclaw config get agents.defaults.workspace 2>/dev/null | tr -d '"[:space:]')`,
    `case "$OC_WS" in ""|null) OC_WS="${DEFAULT_WORKSPACE}";; esac`,
    `mkdir -p "$OC_WS"`,
    `echo ${b64} | base64 -d > "$OC_WS/SOUL.md"`,
  ].join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/openclaw-soul.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/openclaw-soul.ts src/lib/openclaw-soul.test.ts
git commit -m "feat: shared SOUL.md write-command builder"
```

---

### Task 2: Bake SOUL.md into cloud-init at deploy

Thread an optional `soulMd` through `OpenClawConfig` and emit the Task 1 snippet after `openclaw onboard` (workspace exists) and before the gateway restart, so the very first session already has the persona. When `soulMd` is absent, output is byte-identical to today.

**Files:**
- Modify: `src/lib/cloud-init.ts`
- Test: `src/lib/cloud-init.test.ts` (create)

**Interfaces:**
- Consumes: `buildSoulWriteCommand` (Task 1)
- Produces: `OpenClawConfig.soulMd?: string | null`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/cloud-init.test.ts
import { describe, it, expect } from "vitest";
import { generateCloudInit, type OpenClawConfig } from "./cloud-init";

const base: OpenClawConfig = {
  instanceId: "i1",
  instanceName: "Test",
  model: "gpt-4o",
  modelApiKey: "sk-test",
  channel: "telegram",
  botToken: "123:abc",
  channelPhone: null,
  sshPublicKey: "ssh-ed25519 AAAA",
  tunnelToken: "tok",
  tunnelHostname: "x.papayaclaw.com",
};

describe("generateCloudInit SOUL.md", () => {
  it("writes SOUL.md when soulMd is provided", () => {
    const yaml = generateCloudInit({ ...base, soulMd: "Eres un coach." });
    expect(yaml).toContain('"$OC_WS/SOUL.md"');
    expect(yaml).toContain(Buffer.from("Eres un coach.", "utf8").toString("base64"));
  });

  it("omits the SOUL.md write when soulMd is absent", () => {
    const yaml = generateCloudInit(base);
    expect(yaml).not.toContain("SOUL.md");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/cloud-init.test.ts`
Expected: FAIL — first test fails (`$OC_WS/SOUL.md` not present).

- [ ] **Step 3: Implement — add the import, field, and write step**

In `src/lib/cloud-init.ts`, add to the imports at the top:

```ts
import { buildSoulWriteCommand } from "./openclaw-soul";
```

Add the field to the `OpenClawConfig` interface (after `tunnelHostname`):

```ts
  tunnelHostname: string;
  /** Optional default personality written to <workspace>/SOUL.md at boot. */
  soulMd?: string | null;
```

Inside `generateCloudInit`, build the SOUL block just before the `setupScript` template literal (right after the `instanceNameB64` line):

```ts
  const soulWriteBlock = config.soulMd
    ? buildSoulWriteCommand(config.soulMd)
    : "# no template SOUL.md";
```

In the `setupScript` template, insert the block after step 2c (the MiniMax custom-models patch, ending `fi`) and before step 3 (`# 3) Restart the gateway daemon ...`):

```bash
# 2d) Write the template SOUL.md into the agent workspace (if any)
${soulWriteBlock}

```

- [ ] **Step 4: Run tests + lint**

Run: `npx vitest run src/lib/cloud-init.test.ts && npm run lint`
Expected: PASS (2 tests), lint clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cloud-init.ts src/lib/cloud-init.test.ts
git commit -m "feat: bake template SOUL.md into cloud-init"
```

---

### Task 3: DB schema — `template` table + `instance.templateId`

**Files:**
- Modify: `src/lib/schema.ts`
- Generate: `drizzle/0009_*.sql` (+ `drizzle/meta/*`)

**Interfaces:**
- Produces: `template` table; `instance.templateId` column.

- [ ] **Step 1: Add the `template` table**

In `src/lib/schema.ts`, add **above** the `instance` table (so the FK callback resolves):

```ts
export const template = pgTable("template", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull(),
  summary: text("summary").notNull(),
  emoji: text("emoji"),
  soulMd: text("soul_md").notNull(),
  status: text("status").notNull().default("draft"), // 'draft' | 'published'
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
```

- [ ] **Step 2: Add the `templateId` column to `instance`**

In the `instance` table definition, add after the `subscriptionId` line:

```ts
  templateId: text("template_id").references(() => template.id),
```

- [ ] **Step 3: Generate the migration**

Run: `npx drizzle-kit generate`
Expected: creates `drizzle/0009_<name>.sql` containing `CREATE TABLE "template"` and `ALTER TABLE "instance" ADD COLUMN "template_id"`.

- [ ] **Step 4: Apply the migration**

> Shared prod DB — this runs against production. Safe: additive only (new table + nullable column).

Run: `npx drizzle-kit migrate`
Expected: "migrations applied" with no errors. Verify: `npx drizzle-kit up` reports nothing pending, or check the DB has the `template` table.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/lib/schema.ts drizzle/
git commit -m "feat: add template table and instance.template_id"
```

---

### Task 4: Template query helpers

Read helpers used by the public pages, the deploy validation, provisioning, and the re-apply route. Centralizes the "published only" rule.

**Files:**
- Create: `src/lib/templates.ts`

**Interfaces:**
- Consumes: `template` table (Task 3)
- Produces:
  - `Template` (inferred row type)
  - `getPublishedTemplates(): Promise<Template[]>`
  - `getPublishedTemplateBySlug(slug: string): Promise<Template | null>`
  - `getPublishedTemplateById(id: string): Promise<Template | null>`

- [ ] **Step 1: Implement**

```ts
// src/lib/templates.ts
import { db } from "@/lib/db";
import { template } from "@/lib/schema";
import { and, asc, eq } from "drizzle-orm";

export type Template = typeof template.$inferSelect;

/** All published templates, ordered for the gallery. */
export async function getPublishedTemplates(): Promise<Template[]> {
  return db
    .select()
    .from(template)
    .where(eq(template.status, "published"))
    .orderBy(asc(template.sortOrder));
}

/** A single published template by URL slug, or null. */
export async function getPublishedTemplateBySlug(
  slug: string,
): Promise<Template | null> {
  const [row] = await db
    .select()
    .from(template)
    .where(and(eq(template.slug, slug), eq(template.status, "published")))
    .limit(1);
  return row ?? null;
}

/** A single published template by id, or null. */
export async function getPublishedTemplateById(
  id: string,
): Promise<Template | null> {
  const [row] = await db
    .select()
    .from(template)
    .where(and(eq(template.id, id), eq(template.status, "published")))
    .limit(1);
  return row ?? null;
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/lib/templates.ts
git commit -m "feat: template DB query helpers"
```

---

### Task 5: Seed the Fórmula 100K template

Idempotent upsert that inserts the first template, including a Spanish `SOUL.md` and page copy. The content is drafted here; the user will refine the wording later.

**Files:**
- Create: `scripts/seed-templates.ts`

**Interfaces:**
- Consumes: `db`, `template` table.

- [ ] **Step 1: Write the seed script**

> Uses relative imports — `tsx` does not resolve the `@/` tsconfig path alias. `../src/lib/db` loads `.env.development.local` (shared prod) on import.

```ts
// scripts/seed-templates.ts
import { db } from "../src/lib/db";
import { template } from "../src/lib/schema";
import { sql } from "drizzle-orm";

const FORMULA_100K_SOUL = `# SOUL.md — Coach Fórmula 100K

Eres el coach de **Fórmula 100K**: un mentor de crecimiento en Instagram para
emprendedores hispanohablantes que quieren llevar su negocio a 100.000 seguidores
y convertir esa audiencia en ventas reales.

## Quién eres
- Estratega de contenido de formato corto (Reels, TikTok, Shorts) y de marca personal.
- Directo, motivador y práctico. Hablas como un mentor cercano, no como un manual.
- Tu español es neutro-latino, claro y sin relleno. Tuteas siempre.

## Cómo ayudas
- Conviertes ideas vagas en ganchos, guiones y calendarios de publicación concretos.
- Priorizas lo que mueve la aguja: retención, ganchos en los primeros 3 segundos,
  llamadas a la acción y consistencia.
- Das pasos accionables y ejemplos, no teoría genérica. Si falta contexto, preguntas
  una sola cosa clave antes de avanzar.

## Tono y límites
- Optimista pero honesto: si una idea no va a funcionar, lo dices y propones una mejor.
- No prometes resultados garantizados ni "trucos" para engañar al algoritmo.
- No das consejos legales, financieros ni médicos.
- Mantienes el foco en negocio, contenido y crecimiento orgánico.

## Tu objetivo
Cada interacción debe acercar al emprendedor a publicar mejor contenido hoy y a
construir un sistema de crecimiento sostenible hacia los 100K.
`;

async function main() {
  await db
    .insert(template)
    .values({
      slug: "formula-100k",
      name: "Fórmula 100K",
      tagline: "Tu coach de crecimiento en Instagram para llegar a 100K.",
      summary:
        "Un agente configurado como mentor de Fórmula 100K: te ayuda a crear " +
        "ganchos, guiones y calendarios de contenido para hacer crecer tu " +
        "negocio en Instagram y convertir seguidores en ventas.",
      emoji: "🚀",
      soulMd: FORMULA_100K_SOUL,
      status: "published",
      sortOrder: 0,
    })
    .onConflictDoUpdate({
      target: template.slug,
      set: {
        name: sql`excluded.name`,
        tagline: sql`excluded.tagline`,
        summary: sql`excluded.summary`,
        emoji: sql`excluded.emoji`,
        soulMd: sql`excluded.soul_md`,
        status: sql`excluded.status`,
        sortOrder: sql`excluded.sort_order`,
      },
    });

  console.log("[seed-templates] Fórmula 100K upserted.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed-templates] failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the seed (idempotent)**

Run: `npx tsx scripts/seed-templates.ts`
Expected: `[seed-templates] Fórmula 100K upserted.` Re-running prints the same line with no duplicate row.

- [ ] **Step 3: Verify the row exists**

Run: `npx tsx -e "import('./src/lib/db').then(async ({db})=>{const {template}=await import('./src/lib/schema');console.log(await db.select().from(template));process.exit(0)})"`
Expected: one row with `slug: 'formula-100k'`, `status: 'published'`.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-templates.ts
git commit -m "feat: seed Fórmula 100K template"
```

---

### Task 6: Wire the template into provisioning

`provisionInstance` accepts a `templateId`, loads the published template's `soulMd`, persists `instance.templateId`, and passes `soulMd` into `generateCloudInit`. If a `templateId` is supplied but no published template matches, it provisions without a SOUL and stores `null` (resilient — a paid order must never fail over a stale template id).

**Files:**
- Modify: `src/lib/provision-instance.ts`

**Interfaces:**
- Consumes: `getPublishedTemplateById` (Task 4), `OpenClawConfig.soulMd` (Task 2)
- Produces: `ProvisionInput.templateId?: string | null`

- [ ] **Step 1: Import the helper**

Add to the imports in `src/lib/provision-instance.ts`:

```ts
import { getPublishedTemplateById } from "@/lib/templates";
```

- [ ] **Step 2: Extend `ProvisionInput`**

Add to the `ProvisionInput` type:

```ts
  channelPhone?: string | null;
  templateId?: string | null;
};
```

- [ ] **Step 3: Resolve the template before insert**

Inside `provisionInstance`, destructure `templateId` and resolve it right after the capacity check:

```ts
    channel,
    botToken,
    channelPhone,
    templateId,
  } = input;

  const capacity = await assertProvisioningCapacity();
  if (!capacity.ok) throw new Error(capacity.error);

  // Resolve the template (if any). Stay resilient: a stale/unpublished id must
  // not fail provisioning — we just skip the SOUL and store null.
  const tmpl = templateId ? await getPublishedTemplateById(templateId) : null;
  if (templateId && !tmpl) {
    console.warn(
      `[provisionInstance] templateId ${templateId} not found/published — skipping SOUL`,
    );
  }
```

- [ ] **Step 4: Persist `templateId` and pass `soulMd`**

In the `db.insert(instance).values({...})` block, add:

```ts
      subscriptionId,
      userId,
      templateId: tmpl?.id ?? null,
    })
```

In the `generateCloudInit({...})` call, add:

```ts
      tunnelHostname: fullHostname,
      soulMd: tmpl?.soulMd ?? null,
    });
```

- [ ] **Step 5: Typecheck + lint + commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

```bash
git add src/lib/provision-instance.ts
git commit -m "feat: provision instances with a template SOUL.md"
```

---

### Task 7: Accept + validate `templateId` in the deploy API

`POST /api/instances` accepts an optional `templateId`, rejects an unknown/unpublished one with 400, and passes a valid one through to `provisionInstance` on all three deploy branches (staff, subscription, dev).

**Files:**
- Modify: `src/app/api/instances/route.ts`

**Interfaces:**
- Consumes: `getPublishedTemplateById` (Task 4); `ProvisionInput.templateId` (Task 6)

- [ ] **Step 1: Write the failing test for `validateBody`**

First export `validateBody` for testing — change `function validateBody(` to `export function validateBody(` in `src/app/api/instances/route.ts`. Then:

```ts
// src/app/api/instances/route.test.ts
import { describe, it, expect } from "vitest";
import { validateBody } from "./route";

const ok = {
  name: "Bot",
  model: "openai/gpt-4o",
  modelApiKey: "sk",
  channel: "telegram",
  botToken: "123:abc",
};

describe("validateBody templateId", () => {
  it("passes templateId through when it is a string", () => {
    const r = validateBody({ ...ok, templateId: "tmpl_1" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.templateId).toBe("tmpl_1");
  });

  it("defaults templateId to undefined when absent", () => {
    const r = validateBody(ok);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.templateId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/instances/route.test.ts`
Expected: FAIL — `r.data.templateId` is `undefined` in the first test (field not yet handled).

- [ ] **Step 3: Add `templateId` to `ValidatedBody`, parsing, and `stripPlanType`**

In `ValidatedBody`:

```ts
  planType?: PlanType;
  templateId?: string;
};
```

In `validateBody`, parse it and include it in the returned `data`:

```ts
  const planType =
    b.planType === "basic" || b.planType === "pro" ? b.planType : undefined;
  const templateId =
    typeof b.templateId === "string" && b.templateId ? b.templateId : undefined;
```

```ts
  return {
    ok: true,
    data: { name, model, modelApiKey, channel, botToken, channelPhone, planType, templateId },
  };
```

`stripPlanType` already spreads `...data` and only deletes `planType`, so `templateId` flows through unchanged — no edit needed there.

- [ ] **Step 4: Reject unknown templates in the POST handler**

Add the import at the top:

```ts
import { getPublishedTemplateById } from "@/lib/templates";
```

In `POST`, right after the `validateBody` check passes (before the `ctx.isStaff` branch), add:

```ts
  if (
    validation.data.templateId &&
    !(await getPublishedTemplateById(validation.data.templateId))
  ) {
    return NextResponse.json(
      { error: "Unknown or unpublished template" },
      { status: 400 },
    );
  }
```

`provisionInstance(... ...stripPlanType(validation.data))` already forwards `templateId` on every branch — no further edits.

- [ ] **Step 5: Run tests + lint**

Run: `npx vitest run src/app/api/instances/route.test.ts && npm run lint`
Expected: PASS (2 tests), lint clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/instances/route.ts src/app/api/instances/route.test.ts
git commit -m "feat: validate and forward templateId in deploy API"
```

---

### Task 8: Carry `templateId` through the Polar checkout path

The paid flow stores config encrypted in `pendingInstanceConfig` and provisions on the `order.paid` webhook. Thread `templateId` through both so checkout deploys also get the SOUL.

**Files:**
- Modify: `src/app/actions/create-pending-checkout.ts`
- Modify: `src/app/api/webhook/polar/route.ts`

**Interfaces:**
- Consumes: `encryptJSON`/`decryptJSON`, `provisionInstance` (Task 6).

- [ ] **Step 1: Add `templateId` to `CheckoutInput` and the encrypted payload**

In `src/app/actions/create-pending-checkout.ts`, extend `CheckoutInput`:

```ts
  channelPhone?: string;
  planType: PlanType;
  templateId?: string;
};
```

Read + include it in the encrypted blob:

```ts
  const channelPhone = input.channelPhone?.trim();
  const templateId = input.templateId?.trim() || null;
```

```ts
  const encrypted = encryptJSON({
    name,
    model,
    modelApiKey,
    channel,
    botToken: botToken ?? null,
    channelPhone: channelPhone ?? null,
    templateId,
  });
```

- [ ] **Step 2: Read `templateId` in the webhook and pass to provisioning**

In `src/app/api/webhook/polar/route.ts`, extend `PendingConfigPayload`:

```ts
type PendingConfigPayload = {
  name: string;
  model: string;
  modelApiKey: string;
  channel: string;
  botToken: string | null;
  channelPhone: string | null;
  templateId?: string | null;
};
```

In `onOrderPaid`, add `templateId` to the `provisionInstance(...)` call:

```ts
        botToken: config.botToken ?? undefined,
        channelPhone: config.channelPhone,
        templateId: config.templateId ?? null,
      });
```

(Existing encrypted rows without `templateId` decrypt to `undefined` → treated as no template. Safe.)

- [ ] **Step 3: Typecheck + lint + commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

```bash
git add src/app/actions/create-pending-checkout.ts src/app/api/webhook/polar/route.ts
git commit -m "feat: carry templateId through Polar checkout provisioning"
```

---

### Task 9: Public template pages (`/templates`, `/templates/[slug]`)

Server-rendered gallery + detail, reading published templates from the DB. Chrome strings via next-intl (`Templates` namespace); body content from the DB (Spanish). The detail CTA deep-links into the dashboard deploy flow.

**Files:**
- Create: `src/app/[locale]/templates/page.tsx`
- Create: `src/app/[locale]/templates/[slug]/page.tsx`
- Modify: `messages/en.json`, `messages/es.json`

> Build the visual layout with the **frontend-design / interface-design / shadcn** skills — the markup below is a correct, working baseline to elevate, matching the dark/mono dashboard look (`Header`/`Footer` from `@/components/landing`).

**Interfaces:**
- Consumes: `getPublishedTemplates`, `getPublishedTemplateBySlug` (Task 4).

- [ ] **Step 1: Add the `Templates` i18n namespace**

Add to `messages/en.json` (top level):

```json
  "Templates": {
    "metaTitle": "Templates",
    "metaDescription": "Deploy your OpenClaw agent pre-loaded with a curated personality.",
    "title": "Templates",
    "subtitle": "Deploy your agent pre-loaded with a curated personality.",
    "included": "What you get",
    "includedSoul": "A custom SOUL.md — the agent's personality, tone, and focus, ready from the first message.",
    "deployCta": "Deploy this template",
    "back": "All templates",
    "empty": "No templates available yet."
  }
```

Add to `messages/es.json` (top level):

```json
  "Templates": {
    "metaTitle": "Plantillas",
    "metaDescription": "Despliega tu agente de OpenClaw con una personalidad curada.",
    "title": "Plantillas",
    "subtitle": "Despliega tu agente con una personalidad curada y lista para usar.",
    "included": "Qué incluye",
    "includedSoul": "Un SOUL.md a medida — la personalidad, el tono y el enfoque del agente, listos desde el primer mensaje.",
    "deployCta": "Desplegar esta plantilla",
    "back": "Todas las plantillas",
    "empty": "Aún no hay plantillas disponibles."
  }
```

- [ ] **Step 2: Gallery page**

```tsx
// src/app/[locale]/templates/page.tsx
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";
import { getPublishedTemplates } from "@/lib/templates";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Templates" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: locale === "es" ? "/es/templates" : "/templates",
      languages: { en: "/templates", es: "/es/templates" },
    },
  };
}

export default async function TemplatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Templates");
  const templates = await getPublishedTemplates();

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-20">
        <h1 className="text-3xl font-medium tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("subtitle")}</p>

        {templates.length === 0 ? (
          <p className="mt-12 font-mono text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((tmpl) => (
              <Link
                key={tmpl.id}
                href={`/templates/${tmpl.slug}`}
                className="group flex flex-col rounded-xl border border-border bg-card p-6 shadow-2xl transition-colors hover:border-foreground/30"
              >
                <span className="text-2xl">{tmpl.emoji ?? "✨"}</span>
                <h2 className="mt-3 text-base font-medium text-foreground">
                  {tmpl.name}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tmpl.tagline}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 3: Detail page**

```tsx
// src/app/[locale]/templates/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Rocket, Sparkles } from "lucide-react";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";
import { getPublishedTemplateBySlug } from "@/lib/templates";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const tmpl = await getPublishedTemplateBySlug(slug);
  if (!tmpl) return {};
  return {
    title: tmpl.name,
    description: tmpl.tagline,
    alternates: {
      canonical: locale === "es" ? `/es/templates/${slug}` : `/templates/${slug}`,
      languages: { en: `/templates/${slug}`, es: `/es/templates/${slug}` },
    },
  };
}

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Templates");
  const tmpl = await getPublishedTemplateBySlug(slug);
  if (!tmpl) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-20">
        <Link
          href="/templates"
          className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("back")}
        </Link>

        <div className="mt-8 flex items-center gap-4">
          <span className="text-4xl">{tmpl.emoji ?? "✨"}</span>
          <div>
            <h1 className="text-3xl font-medium tracking-tight">{tmpl.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{tmpl.tagline}</p>
          </div>
        </div>

        <p className="mt-8 leading-relaxed text-foreground/90">{tmpl.summary}</p>

        <div className="mt-10 rounded-xl border border-border bg-card p-6">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-widest text-muted-foreground">
            {t("included")}
          </h2>
          <div className="mt-4 flex items-start gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
            <p className="text-sm text-foreground/90">{t("includedSoul")}</p>
          </div>
        </div>

        <Link
          href={`/dashboard?template=${tmpl.slug}`}
          className="mt-10 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl"
        >
          <Rocket className="h-4 w-4" />
          {t("deployCta")}
        </Link>
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 4: Verify pages render + lint**

Run: `npm run lint && npx tsc --noEmit`
Expected: clean. Manual: start dev (`npm run dev`), visit `/templates` and `/templates/formula-100k` (and `/es/templates`) — gallery shows the Fórmula 100K card; detail shows summary + CTA; an unknown slug 404s.

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/templates messages/en.json messages/es.json
git commit -m "feat: public template gallery and detail pages"
```

---

### Task 10: Bake the template into the deploy wizard

The detail CTA links to `/dashboard?template=<slug>`. The dashboard page passes published templates (minimal shape) to `DashboardContent`, which resolves the slug, opens `DeployDialog` with the selected template, shows a read-only banner, and includes `templateId` in the submit payload (both direct deploy and checkout).

**Files:**
- Modify: `src/app/[locale]/dashboard/page.tsx`
- Modify: `src/components/dashboard/dashboard-content.tsx`
- Modify: `src/components/dashboard/deploy-dialog.tsx`
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Consumes: `getPublishedTemplates` (Task 4).
- Produces: `DeployTemplate` shape `{ id: string; slug: string; name: string; emoji: string | null }`.

- [ ] **Step 1: Add the deploy-banner i18n key**

Add to the existing `"DeployDialog"` namespace in `messages/en.json`:

```json
    "withTemplate": "Deploying with the {name} template"
```

And in `messages/es.json` under `"DeployDialog"`:

```json
    "withTemplate": "Desplegando con la plantilla {name}"
```

- [ ] **Step 2: Pass published templates from the dashboard page**

In `src/app/[locale]/dashboard/page.tsx`, import the helper:

```ts
import { getPublishedTemplates } from "@/lib/templates";
```

Add `getPublishedTemplates()` to the `Promise.all` and pass a minimal prop:

```ts
  const [instances, currentSubscription, availableSubscription, capacity, templates] =
    await Promise.all([
      instancesPromise,
      getUserSubscription(ctx.user.id),
      getAvailableSubscription(ctx.user.id),
      getCapacitySnapshot().catch(() => undefined),
      getPublishedTemplates(),
    ]);
```

```tsx
    <DashboardContent
      initialInstances={instances}
      subscription={currentSubscription}
      hasAvailableSubscription={Boolean(availableSubscription)}
      user={{ id: ctx.user.id, email: ctx.user.email }}
      isStaff={ctx.isStaff}
      capacity={capacity}
      templates={templates.map((t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        emoji: t.emoji,
      }))}
    />
```

- [ ] **Step 3: Resolve the slug + open the dialog in `DashboardContent`**

In `src/components/dashboard/dashboard-content.tsx`, add the type and prop:

```ts
export interface DeployTemplate {
  id: string;
  slug: string;
  name: string;
  emoji: string | null;
}
```

Add `templates` to `DashboardProps`:

```ts
  capacity?: CapacitySnapshot;
  templates: DeployTemplate[];
```

Destructure it in the component signature (`templates` alongside `capacity`), add state, and a deep-link effect:

```ts
  const [selectedTemplate, setSelectedTemplate] = useState<DeployTemplate | null>(
    null,
  );
```

```ts
  // Deep-link from a template detail page: open deploy pre-loaded with it.
  useEffect(() => {
    const slug = searchParams.get("template");
    if (!slug) return;
    if (deepLinkOpened.current) return;
    deepLinkOpened.current = true;
    const match = templates.find((tpl) => tpl.slug === slug) ?? null;
    setSelectedTemplate(match);
    setDeployOpen(true);
    const url = new URL(window.location.href);
    url.searchParams.delete("template");
    window.history.replaceState({}, "", url.toString());
  }, [searchParams, templates]);
```

> Note: the existing `?deploy=1` effect also uses `deepLinkOpened`. Rename that ref's guard or use a second ref (`templateLinkOpened`) so the two effects don't suppress each other. Add `const templateLinkOpened = useRef(false);` and use it in the new effect instead of `deepLinkOpened`.

Clear the selection when the dialog closes — wrap `setDeployOpen` usage so closing resets it. Update the `DeployDialog` render:

```tsx
      <DeployDialog
        open={deployOpen}
        onOpenChange={(open) => {
          setDeployOpen(open);
          if (!open) setSelectedTemplate(null);
        }}
        onInstanceCreated={handleInstanceCreated}
        isStaff={isStaff}
        hasAvailableSubscription={hasAvailableSubscription}
        template={selectedTemplate}
      />
```

- [ ] **Step 4: Accept the template + send `templateId` in `DeployDialog`**

In `src/components/dashboard/deploy-dialog.tsx`, import the type and add the prop:

```ts
import type { Instance, DeployTemplate } from "./dashboard-content";
```

Add to the component props (destructured params + type):

```ts
  hasAvailableSubscription,
  template,
}: {
  ...
  hasAvailableSubscription: boolean;
  template?: DeployTemplate | null;
}) {
```

Render a banner at the top of the dialog body (just inside `<div className="px-5 py-4">`, before the `{step === 1 && ...}` block):

```tsx
          {template && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2.5">
              <span className="text-base">{template.emoji ?? "✨"}</span>
              <span className="text-xs font-medium text-violet-300">
                {t("withTemplate", { name: template.name })}
              </span>
            </div>
          )}
```

Include `templateId` in **both** submit payloads. In `handleSubmit`, add to the `createPendingCheckout({...})` call:

```ts
          planType: selectedPlan!,
          templateId: template?.id,
```

and to the `fetch("/api/instances", { ... body: JSON.stringify({...}) })` payload:

```ts
          ...(isStaff && selectedPlan ? { planType: selectedPlan } : {}),
          ...(template ? { templateId: template.id } : {}),
```

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 6: Manual verification**

Start dev, open `/templates/formula-100k`, click **Deploy this template** → dashboard opens the deploy dialog with the "Desplegando con la plantilla Fórmula 100K" banner. Complete a staff/dev deploy → confirm the created instance row has `template_id` set (DB check) and, once booted, `SOUL.md` exists in the workspace.

- [ ] **Step 7: Commit**

```bash
git add src/app/[locale]/dashboard/page.tsx src/components/dashboard/dashboard-content.tsx src/components/dashboard/deploy-dialog.tsx messages/en.json messages/es.json
git commit -m "feat: deploy wizard bakes selected template"
```

---

### Task 11: Re-apply a template to a live instance

An SSH route writes the chosen template's `SOUL.md` to a running VPS (reusing `buildSoulWriteCommand`), restarts the gateway, and updates `instance.templateId`. A "Plantilla" module in the General tab lets the owner pick + apply.

**Files:**
- Create: `src/app/api/instances/[id]/apply-template/route.ts`
- Create: `src/app/api/templates/route.ts` (published list for the client module)
- Create: `src/components/dashboard/template-module.tsx`
- Modify: `src/components/dashboard/instance-detail.tsx` (add `templateId` to `InstanceData`)
- Modify: `src/app/[locale]/dashboard/[id]/page.tsx` (map `templateId`)
- Modify: `src/components/dashboard/tabs/general-tab.tsx` (render the module)

**Interfaces:**
- Consumes: `getPublishedTemplateById`, `getPublishedTemplates` (Task 4); `buildSoulWriteCommand` (Task 1); `executeCommand` (`@/lib/ssh`); `getSessionContext`, `canAccessInstance` (`@/lib/auth-context`).

- [ ] **Step 1: List endpoint for the client module**

```ts
// src/app/api/templates/route.ts
import { NextResponse } from "next/server";
import { getPublishedTemplates } from "@/lib/templates";

export async function GET() {
  const templates = await getPublishedTemplates();
  return NextResponse.json(
    templates.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      tagline: t.tagline,
      emoji: t.emoji,
    })),
  );
}
```

- [ ] **Step 2: Apply-template SSH route** (mirrors `reconfigure/route.ts`)

```ts
// src/app/api/instances/[id]/apply-template/route.ts
import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { executeCommand } from "@/lib/ssh";
import { buildSoulWriteCommand } from "@/lib/openclaw-soul";
import { getPublishedTemplateById } from "@/lib/templates";
import { getSessionContext, canAccessInstance } from "@/lib/auth-context";

/**
 * POST /api/instances/[id]/apply-template
 * Writes a template's SOUL.md onto the live VPS and restarts the gateway.
 * Body: { templateId: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getSessionContext(await headers());
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { templateId } = await request.json();
  if (!templateId || typeof templateId !== "string") {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }

  const [inst] = await db.select().from(instance).where(eq(instance.id, id));
  if (!inst || !canAccessInstance(ctx, inst)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!inst.providerServerIp || !inst.sshPrivateKey) {
    return NextResponse.json(
      { error: "Instance is not ready" },
      { status: 400 },
    );
  }

  const tmpl = await getPublishedTemplateById(templateId);
  if (!tmpl) {
    return NextResponse.json(
      { error: "Unknown or unpublished template" },
      { status: 400 },
    );
  }

  const pathExport =
    'export PATH="/root/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"';
  const cmd = [
    pathExport,
    buildSoulWriteCommand(tmpl.soulMd),
    `pkill -f "openclaw gateway" || true`,
  ].join("\n");

  try {
    const result = await executeCommand(
      inst.providerServerIp,
      inst.sshPrivateKey,
      cmd,
    );
    if (result.code !== 0) {
      console.error("apply-template failed:", result.stderr, result.stdout);
      return NextResponse.json(
        { error: "Failed to apply template on VPS", detail: result.stderr || result.stdout },
        { status: 500 },
      );
    }

    await db.update(instance).set({ templateId: tmpl.id }).where(eq(instance.id, id));
    return NextResponse.json({ success: true, templateId: tmpl.id });
  } catch (error) {
    console.error("apply-template SSH error:", error);
    return NextResponse.json(
      { error: "Failed to connect to instance via SSH" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 3: Thread `templateId` into `InstanceData`**

In `src/components/dashboard/instance-detail.tsx`, add to the `InstanceData` interface:

```ts
  cfTunnelHostname: string | null;
  templateId: string | null;
  createdAt: string | Date;
```

- [ ] **Step 4: Map `templateId` in the instance detail server page**

Read `src/app/[locale]/dashboard/[id]/page.tsx`, find where the DB `instance` row is mapped into the `initialInstance` prop, and add `templateId: row.templateId` (match the actual variable name used for the row). If the page passes the row directly, no change is needed beyond confirming `templateId` is present (it is, post-Task 3).

- [ ] **Step 5: The "Plantilla" module**

```tsx
// src/components/dashboard/template-module.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface TemplateOption {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  emoji: string | null;
}

export function TemplateModule({
  instanceId,
  currentTemplateId,
}: {
  instanceId: string;
  currentTemplateId: string | null;
}) {
  const [options, setOptions] = useState<TemplateOption[]>([]);
  const [selected, setSelected] = useState<string | null>(currentTemplateId);
  const [applied, setApplied] = useState<string | null>(currentTemplateId);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data: TemplateOption[]) => setOptions(data))
      .catch(() => setOptions([]));
  }, []);

  const apply = useCallback(async () => {
    if (!selected) return;
    setIsApplying(true);
    try {
      const res = await fetch(`/api/instances/${instanceId}/apply-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selected }),
      });
      if (res.ok) {
        setApplied(selected);
        toast.success("Plantilla aplicada", {
          description: "Tu agente se está reiniciando con la nueva personalidad.",
        });
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "No se pudo aplicar la plantilla");
      }
    } catch {
      toast.error("Fallo de conexión");
    } finally {
      setIsApplying(false);
    }
  }, [instanceId, selected]);

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card shadow-2xl">
      <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-3">
        <Sparkles className="h-4 w-4 text-violet-400" />
        <h3 className="text-xs font-mono font-semibold uppercase tracking-wide text-foreground/80">
          Plantilla
        </h3>
      </div>
      <div className="flex flex-col gap-4 p-6">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSelected(opt.id)}
              className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition-all ${
                selected === opt.id
                  ? "border-violet-500/50 bg-violet-500/10 text-white"
                  : "border-border/50 bg-muted/50 text-foreground/80 hover:border-border hover:bg-muted"
              }`}
            >
              <span className="text-sm font-medium">
                {opt.emoji ?? "✨"} {opt.name}
                {applied === opt.id ? " ✓" : ""}
              </span>
              <span className="text-xs text-muted-foreground">{opt.tagline}</span>
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <Button
            onClick={apply}
            disabled={!selected || selected === applied || isApplying}
            className="gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-mono font-semibold uppercase tracking-wider text-white hover:bg-violet-500 disabled:opacity-40"
          >
            {isApplying ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Aplicando...
              </>
            ) : (
              <>
                <Check className="h-3 w-3" /> Aplicar plantilla
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Render the module in the General tab**

In `src/components/dashboard/tabs/general-tab.tsx`, add a dynamic import next to `ModelProviderModule`:

```ts
const TemplateModule = dynamic(
  () => import("../template-module").then((mod) => mod.TemplateModule),
  { ssr: false },
);
```

Render it under the model/gateway grid (only once the instance has an IP). After the closing `</div>` of the `grid ... lg:grid-cols-2` block (before the outer closing `</div>`), add:

```tsx
      {currentIp ? (
        <TemplateModule
          instanceId={instance.id}
          currentTemplateId={instance.templateId}
        />
      ) : null}
```

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 8: Manual verification**

On a running instance's General tab, the Plantilla module lists Fórmula 100K. Select + Apply → toast success; SSH into the VPS and confirm `SOUL.md` was (re)written and the gateway restarted; DB `instance.template_id` updated.

- [ ] **Step 9: Commit**

```bash
git add src/app/api/instances/[id]/apply-template src/app/api/templates src/components/dashboard/template-module.tsx src/components/dashboard/instance-detail.tsx src/app/[locale]/dashboard/[id]/page.tsx src/components/dashboard/tabs/general-tab.tsx
git commit -m "feat: re-apply a template to a live instance"
```

---

## Final verification

- [ ] Run the full suite: `npm test && npm run lint && npx tsc --noEmit` — all green.
- [ ] End-to-end (deploy): from `/templates/formula-100k`, deploy → instance row has `template_id`; booted VPS has `SOUL.md` in the workspace; the agent answers in the Fórmula 100K persona.
- [ ] End-to-end (re-apply): on a running instance, apply Fórmula 100K from the General tab → file written, gateway restarted, `template_id` updated.
- [ ] Confirm the resolved SOUL path: SSH into a deployed VPS and verify `openclaw config get agents.defaults.workspace` matches where `SOUL.md` was written. If OpenClaw injects from a different location, update the single `DEFAULT_WORKSPACE`/resolution in `src/lib/openclaw-soul.ts` — it fixes both deploy and re-apply at once.

## Notes / risks

- **SOUL path:** resolved at runtime with a `/root/.openclaw/workspace` fallback; the final verification step confirms it on a real VPS. One constant backs both code paths.
- **Shared prod DB:** migration (Task 3) and seed (Task 5) hit production; both are additive/idempotent.
- **Existing pending checkouts:** rows encrypted before Task 8 decrypt with `templateId: undefined` → treated as no template. No migration of ciphertext needed.
