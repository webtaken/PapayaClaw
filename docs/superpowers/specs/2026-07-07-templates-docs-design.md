# Templates v2 — Docs-Style Guide Pages (Design)

**Date:** 2026-07-07
**Topic:** Pivot `/templates/**` from marketing landings + baked `SOUL.md` (v1, branch `feat/templates-v1`, never merged) to documentation-style guide pages. Each template is a step-by-step guide for configuring an OpenClaw instance manually. First template: **Fórmula 100K**.

## Goal

A template is a curated, well-defined configuration path a user follows on their own instance: what to put in `SOUL.md`, how to create subagents and connect them to the main agent, which skills to install, which MCPs to configure, enabling wikis, etc. Pages read like docs: sidebar of steps, long-form content with headings, copyable code, table of contents, prev/next navigation.

## Why the pivot

v1 baked `SOUL.md` into instances via cloud-init at deploy time (plus an SSH re-apply route). Baking config files is hard to maintain and does not scale to the real surface of a template (subagents, skills, MCPs, wikis). Docs scale: they are content, not provisioning code.

## Decisions (locked during brainstorming)

1. **All baking dies.** Templates are 100% docs. Removed concepts: `template` DB table, `instance.templateId`, `soulMd` in cloud-init, `apply-template` route, deploy-wizard template banner. The deploy CTA on a template page links to `/dashboard` with no template param.
2. **Base branch:** new branch `feat/templates-docs` from `origin/main`. `feat/templates-v1` is never merged; useful material (the Fórmula 100K `soulMd` seed content) is copied out (`git show feat/templates-v1:scripts/seed-templates.ts`), then the branch is deleted.
3. **Docs engine:** own MDX infra, generalized from the blog. Fumadocs rejected (own i18n system conflicts with next-intl `localePrefix: "as-needed"`; RootProvider + CSS preset = second design system under `/templates`). Nextra 4 rejected (whole-site framework, known i18n + App Router bug). Zero new dependencies.
4. **Structure:** multi-page per step. `/templates/[slug]` overview + `/templates/[slug]/[step]` per step.
5. **i18n content:** blog pattern. Each step folder holds `es.mdx` (+ optional `en.mdx`); visitor gets their locale's file, falls back to the other when missing. Chrome (sidebar labels, buttons) localized via next-intl. Fórmula 100K content is Spanish-only at launch.

## Non-Goals (YAGNI)

- No docs search (one template; revisit at scale).
- No admin UI, no DB-backed content, no CMS.
- No English translation of Fórmula 100K content at launch.
- No versioning of guides, no per-step analytics, no progress tracking.
- No sidebar section grouping in v2 — flat ordered step list (frontmatter leaves room to add grouping later).

## Content architecture

```
src/content/templates/
  formula-100k/
    index/es.mdx        # overview — frontmatter: { title, tagline, emoji, summary, draft? }
    soul-md/es.mdx      # step — frontmatter: { title, description, order: 1 }
    subagentes/es.mdx   # order: 2
    skills/es.mdx       # order: 3
    mcps/es.mdx         # order: 4
    wikis/es.mdx        # order: 5
```

- Step order comes from frontmatter `order` — folder names are clean URL slugs; reordering never breaks links.
- The gallery lists templates by reading each template's `index/` frontmatter. `draft: true` hides a template everywhere (replaces v1's DB `status`).
- Each template defines its own steps — structure is free-form per template.
- Frontmatter validated with Zod (blog pattern); invalid frontmatter fails the build.

## Routing (all under `[locale]`, static via `generateStaticParams`)

| Route | Content |
|---|---|
| `/templates` | Gallery of cards (emoji · name · tagline) — v1 concept kept, source moves from DB to frontmatter |
| `/templates/[slug]` | Overview: what you will build, requirements, ordered step list, CTA "Deploy your instance" → `/dashboard`, button "Start guide" → step 1 |
| `/templates/[slug]/[step]` | The doc page: sidebar + MDX content + TOC + prev/next |

Unknown slug/step, or `draft: true` → `notFound()`.

## Library: `src/lib/template-docs.ts`

Mirrors `src/lib/mdx.ts` (same locale-fallback resolution, same Zod-validated frontmatter approach):

- `getTemplates(locale)` — published templates' overview frontmatter, for the gallery.
- `getTemplateOverview(slug, locale)` — overview frontmatter + content + TOC.
- `getTemplateSteps(slug, locale)` — ordered step metadata (title, description, slug), for sidebar/prev-next.
- `getStep(slug, step, locale)` — one step's frontmatter + content + TOC.

`extractToc` moves out of `mdx.ts` into a shared module; blog imports it from there (no duplication).

## UI

Desktop doc layout, three columns:

```
┌──────────┬──────────────────────────┬─────────┐
│ Sidebar  │  Breadcrumb              │  TOC    │
│ (steps)  │  # Step title            │ (h2/h3) │
│          │  MDX content…            │         │
│ 1. SOUL  │  [copyable code]         │         │
│ 2. Sub…  │  ┌────────┐  ┌────────┐  │         │
│ 3. Skills│  │ ← Prev │  │ Next → │  │         │
└──────────┴──┴────────┴──┴────────┴──┴─────────┘
```

- **Sidebar:** template header (emoji + name, links to overview) + numbered step list, current step highlighted. Mobile: collapses to a disclosure above the content (same pattern as the blog's mobile TOC).
- **TOC (right):** reuse blog `TableOfContents` as-is (has desktop/mobile variants).
- **Copyable code:** reuse blog `CodeBlock` as-is.
- **MDX components:** `buildComponents` (~75 lines of element styles) extracted from the blog post page into shared `src/components/mdx/mdx-components.tsx`; blog and templates both import it. Targeted improvement, not gratuitous refactoring.
- **Prev/next:** new simple component — cards with adjacent step titles; on the last step, "next" becomes a closing CTA (deploy / back to overview).
- Site `Header`/`Footer` stay (same chrome as blog).
- Built with the **frontend-design / interface-design / shadcn** skills per project rule; brand-consistent (violet, new-york).

## i18n + SEO

- Chrome strings (sidebar labels, "Step X of Y", prev/next, CTAs) in `messages/{en,es}.json`; new `Templates` namespace (main has none — v1's lives only on the dead branch).
- Canonical/hreflang follow the site's `as-needed` pattern (`/templates/...` for en, `/es/templates/...` for es); hreflang only declares locales whose file actually exists.
- `sitemap.ts` adds overview + step URLs per existing locale.
- JSON-LD: `BreadcrumbList` + `TechArticle` per step (blog pattern). `HowTo` schema skipped — deprecated in Google results.

## v1 cleanup / prod DB

- New branch from main → v1 code never lands. Delete `feat/templates-v1` after extracting the seed content.
- **Shared prod DB caveat:** if `drizzle-kit push` ran from the v1 branch, prod already has the `template` table and `instance.template_id` column. The next push from a main-based schema will detect drift and propose DROPs. Plan: review what the push proposes and accept those drops deliberately — the table only contains the Fórmula 100K seed row, no user data. Push runs manually outside the sandbox, per the existing workflow.

## Fórmula 100K content (Spanish; drafted in this work, user refines)

| Step | Content |
|---|---|
| `index` (overview) | What you build: an Instagram-growth coach agent in the Fórmula 100K style. Requirements: deployed instance + linked WhatsApp. Deploy CTA. |
| 1. `soul-md` | Full copyable `SOUL.md` (from the v1 seed) + where to write it on the instance (default agent's SOUL path) |
| 2. `subagentes` | Create subagents (e.g. scriptwriter) and connect them to the main agent |
| 3. `skills` | Install the Fórmula 100K skills (guionización, hooks, IG content) |
| 4. `mcps` | MCPs relevant to the workflow |
| 5. `wikis` | Enable wikis |

The step list is content, not code — adjustable later without touching anything.

## Error handling

- Unknown slug/step or `draft: true` → `notFound()`.
- Step folder with no locale file at all → excluded from sidebar, routes, and sitemap.
- Invalid frontmatter → build-time error (Zod) — fail fast, never silent.

## Testing

- **Vitest:** `template-docs.ts` — locale fallback, `order` sorting, drafts hidden, empty step folders excluded.
- **Shared MDX extraction:** blog renders identically after the `mdx-components` move (visual check + build).
- `npm test && npm run lint` and `next build` (generates static routes for both locales).
- **Manual:** full navigation in en/es, mobile sidebar, code copy, prev/next.

## Files touched (indicative)

- `src/content/templates/formula-100k/**` — MDX content (new).
- `src/lib/template-docs.ts` (+ tests) — content lib (new).
- `src/lib/mdx.ts` — `extractToc` extracted to shared module.
- `src/components/mdx/mdx-components.tsx` — shared MDX element styles (extracted from blog post page).
- `src/components/templates/` — sidebar, prev/next, doc layout (new).
- `src/app/[locale]/templates/page.tsx` — gallery (new on this base; frontmatter-sourced).
- `src/app/[locale]/templates/[slug]/page.tsx` — overview (new).
- `src/app/[locale]/templates/[slug]/[step]/page.tsx` — step page (new).
- `src/app/[locale]/blog/[slug]/page.tsx` — imports shared MDX components.
- `messages/en.json`, `messages/es.json` — new `Templates` namespace.
- `src/app/sitemap.ts` — template + step URLs.
