# Templates — Design (v1: default SOUL.md)

**Date:** 2026-06-27
**Topic:** Introduce reusable instance "templates." v1 ships one configurable knob — a default `SOUL.md` (agent personality) — plus the first template, **Fórmula 100K**.

## Goal

Let a user deploy an OpenClaw instance pre-loaded with a curated personality. A **template** bundles default OpenClaw configuration; v1 carries only a `SOUL.md`. Each template has a public page explaining what it contains and a "Deploy this template" call to action. The first template, Fórmula 100K, turns the agent into an Instagram-growth coach for Spanish-speaking entrepreneurs (based on the [skool.com/formula-100k](https://www.skool.com/formula-100k/about) community and the `formula100k` skills already in this repo).

## Non-Goals (YAGNI)

- No admin CRUD UI for templates — the Fórmula 100K row is seeded; admin screens are a later phase (table is built to support them).
- No subagents, skills, MCPs, or wikis configuration. v1 is `SOUL.md` only. The schema is built to extend, not extended now.
- No English template content — Fórmula 100K body content is Spanish. (UI chrome is still en+es.)
- No multi-template polish (filtering, search, categories) or analytics.
- Templates do **not** override model/channel/plan — those stay user-chosen in the deploy wizard. A template is additive (it sets `SOUL.md`).

## Context

**Provisioning today:** `DeployDialog` wizard → `POST /api/instances` (or Polar checkout → `pendingInstanceConfig` → webhook) → `provisionInstance()` → `generateCloudInit()` builds a cloud-init YAML that runs `openclaw onboard` and `jq`-patches `/root/.openclaw/openclaw.json` (model, channel, UI, session). No `SOUL.md` is set anywhere today.

**Live reconfig today:** `POST /api/instances/[id]/reconfigure` runs SSH commands on the booted VPS to switch model/provider and restart the gateway. This is the proven pattern the re-apply route mirrors.

**SOUL.md:** a plain Markdown file OpenClaw injects into every session as the agent's personality. For the default agent it lives at the default-agent SOUL path (`~/.openclaw/agents/default/SOUL.md`, or the workspace `SOUL.md`; workspace is configurable via `agents.defaults.workspace`). cloud-init already creates `/root/.openclaw/workspace`. Writing it is a one-file operation in the setup script. **Exact path is verified during implementation, not assumed.**

## Decisions (locked during brainstorming)

1. **Entry point:** public `/templates` gallery + `/templates/[slug]` detail page; "Deploy this template" opens the existing `DeployDialog` with the template baked in.
2. **Storage:** a DB `template` table. Seed Fórmula 100K now; admin CRUD is a later phase.
3. **Apply timing:** bake `SOUL.md` at deploy time **and** support re-apply to a live instance.
4. **Content:** SOUL.md + page copy drafted in Spanish (this work), user refines before ship.
5. **Apply mechanism (Approach A):** one shared shell-snippet builder writes `SOUL.md`, invoked by both cloud-init (deploy) and the SSH re-apply route — so deploy and re-apply can never drift on path/format.

## Data model

New `template` table (`src/lib/schema.ts`):

| column | type | notes |
|---|---|---|
| `id` | text PK (uuid `$defaultFn`) | |
| `slug` | text unique | `formula-100k` — URL key |
| `name` | text | `Fórmula 100K` |
| `tagline` | text | one-line card subtitle |
| `summary` | text | longer intro on the detail page |
| `emoji` | text nullable | card/hero glyph |
| `soulMd` | text | the personality file (only config field in v1) |
| `status` | text default `'draft'` | `'draft'` \| `'published'`; gallery shows `published` |
| `sortOrder` | integer default `0` | gallery ordering |
| `createdAt` / `updatedAt` | timestamp | mirror existing tables |

`instance` table: add `templateId text references template.id` (nullable) — records which template an instance was deployed/re-applied with (display, future re-apply, future analytics).

**Migration:** drizzle-kit generates the migration. **Seed:** `scripts/seed-templates.ts` upserts the Fórmula 100K row idempotently on `slug` (runnable repeatedly; safe in shared-prod per project env notes).

Future config (subagents, skills, MCPs, wikis) becomes additional columns or child tables — out of scope here.

## SOUL.md apply mechanism (Approach A)

New module `src/lib/openclaw-soul.ts`:

- `SOUL_PATH` — the resolved default-agent SOUL path constant.
- `buildSoulWriteCommand(soulMd: string): string` — returns a shell snippet that base64-decodes the content and writes it to `SOUL_PATH` (`mkdir -p` the parent first). Base64 avoids quoting/heredoc hazards, matching the existing `botToken`/`customModels` idiom in `cloud-init.ts`.

**Deploy (cloud-init):** add `soulMd?: string` to `OpenClawConfig`. When present, the setup script runs `buildSoulWriteCommand` output **after `openclaw onboard`** (which creates the agent dir) and **before the gateway comes up**, so the first session already has the persona. When absent, no SOUL write is emitted (current behavior unchanged).

**Re-apply (SSH):** the route runs the same `buildSoulWriteCommand` output, then `pkill -f "openclaw gateway"` (systemd `Restart=always` brings it back). Identical path/format because it is literally the same builder.

## Deploy flow

1. `/templates/[slug]` CTA → navigate to `/dashboard?template=<slug>`.
2. `dashboard-content` reads the param and opens `DeployDialog` with `templateId` set.
3. `DeployDialog` shows a read-only banner (e.g. "Desplegando con la plantilla Fórmula 100K"); steps stay name·model·channel·plan; `templateId` is added to the submit payload.
4. `POST /api/instances` accepts `templateId`, validates it exists and is `published`, and passes it to `provisionInstance`.
5. `provisionInstance` loads `template.soulMd`, sets `instance.templateId`, and passes `soulMd` into `generateCloudInit`.
6. **Checkout path:** `templateId` is included in the encrypted `pendingInstanceConfig` payload (`create-pending-checkout.ts`) and read back when the Polar webhook provisions. Both deploy paths carry the template — no drift.

## Re-apply to a live instance

- `POST /api/instances/[id]/apply-template` `{ templateId }`: `getSessionContext` + `canAccessInstance`; load + validate template; SSH `buildSoulWriteCommand(template.soulMd)` then `pkill -f "openclaw gateway"`; on success update `instance.templateId`. Structure and error handling mirror `reconfigure/route.ts`.
- **UI:** a "Plantilla" module in the instance detail `general-tab`, showing the current template and a picker over published templates with an Apply button. Mirrors the existing `model-provider-module` pattern.

## Public pages (`[locale]` routed)

- `/templates` — gallery of cards (emoji · name · tagline) for `published` templates, server-fetched from DB.
- `/templates/[slug]` — detail page: hero (name · tagline · summary), a "Qué incluye" section (v1 describes the persona; future sections for subagents/skills/MCPs/wikis are reserved), and the "Deploy this template" CTA. `notFound()` for unknown/unpublished slugs.
- UI chrome strings (titles, buttons, badges) via next-intl `en` + `es`. Template body content comes from the DB (Spanish for Fórmula 100K).
- Pages are built with the **frontend-design / interface-design / shadcn** skills, per the project UI rule.

## Internationalization

- next-intl message keys added to `messages/en.json` + `messages/es.json` for the gallery/detail chrome and the deploy banner.
- Template content (`name`, `tagline`, `summary`, `soulMd`) is data, stored once in the DB in Spanish. Per-locale template content is out of scope (future: per-locale columns if ever needed).

## Testing

**Unit (vitest, existing runner):**
- `buildSoulWriteCommand` — emits the correct path and round-trips content through base64.
- `generateCloudInit` — includes the SOUL write when `soulMd` is set; omits it (byte-identical to today) when unset.
- `POST /api/instances` — `templateId` validation (unknown / draft → rejected; valid published → accepted).

**Manual:**
- Deploy Fórmula 100K → SSH in, confirm `SOUL.md` exists at the resolved path with the expected content, and the agent answers in persona.
- On a live instance, apply Fórmula 100K via the general-tab module → confirm file written, gateway restarted, `instance.templateId` updated.

## Files touched (indicative)

- `src/lib/schema.ts` — `template` table, `instance.templateId`.
- `drizzle/` — generated migration.
- `scripts/seed-templates.ts` — Fórmula 100K seed (new).
- `src/lib/openclaw-soul.ts` — `SOUL_PATH` + `buildSoulWriteCommand` (new).
- `src/lib/cloud-init.ts` — `soulMd` in `OpenClawConfig`, SOUL write step.
- `src/lib/provision-instance.ts` — load template, set `templateId`, pass `soulMd`.
- `src/app/actions/create-pending-checkout.ts` + `src/app/api/webhook/polar/route.ts` — carry `templateId` through checkout.
- `src/app/api/instances/route.ts` — accept/validate `templateId`.
- `src/app/api/instances/[id]/apply-template/route.ts` — re-apply route (new).
- `src/lib/templates.ts` (or `src/lib/queries`) — DB read helpers for templates.
- `src/app/[locale]/templates/page.tsx` + `src/app/[locale]/templates/[slug]/page.tsx` — public pages (new).
- `src/components/dashboard/deploy-dialog.tsx` + `dashboard-content.tsx` — template banner + param handling.
- `src/components/dashboard/tabs/general-tab.tsx` (+ a `template-module`) — re-apply UI.
- `messages/en.json`, `messages/es.json` — chrome strings.
- SOUL.md + page copy for Fórmula 100K (Spanish, drafted here, user refines).
