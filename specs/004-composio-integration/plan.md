# Implementation Plan: Composio Integration Layer

**Branch**: `004-composio-integration` | **Date**: 2026-04-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-composio-integration/spec.md`

## Summary

Ship a curated, 8-service third-party integration layer for PapayaClaw so that users can OAuth-connect Gmail, Google Calendar, Google Drive, Google Sheets, Notion, Linear, Slack, and GitHub once per account and, per deployed OpenClaw bot (instance), toggle which of those services the bot may use. Composio is the upstream tool provider (credential custody, token refresh, tool execution). PapayaClaw is the gatekeeper: it proxies every bot-initiated tool invocation, enforces the per-instance service toggle and connection health, and writes an audit record that feeds a per-instance "last 50 invocations" activity panel in the integrations tab.

Technical approach: thin wrapper around the official `@composio/core` TypeScript SDK. Three new Drizzle tables (`composio_connection`, `instance_integration`, `integration_invocation`). Six user-facing App Router endpoints under `/api/integrations/**` and `/api/instances/[id]/integrations/**`, plus two bot-facing endpoints under `/api/instances/[id]/tools/**` (authenticated by the existing `instance.callbackSecret`). UI rewrites `src/components/dashboard/tabs/integrations-tab.tsx` and adds four sub-components + three missing brand icon files.

## Technical Context

**Language/Version**: TypeScript 5 strict mode, Node.js (server runtime via `tsx server.ts`)
**Primary Dependencies**: Next.js 16 (App Router, React Compiler), React 19, `@composio/core` (new), Better Auth 1.4.18, Drizzle ORM 0.45.1 + PostgreSQL (`pg` 8.18), Zod 4, next-intl 4.8, shadcn/ui (new-york, Radix under the hood), Tailwind CSS 4, Lucide React (platform icons), SWR 2.4 (client fetching), Sonner (toasts)
**Storage**: PostgreSQL via Drizzle ORM. Three new tables declared in `src/lib/schema.ts`. Migrations applied with `npx drizzle-kit push`. No raw third-party tokens stored — credential custody lives at Composio.
**Testing**: `npm test && npm run lint` (project's declared test+lint gate per CLAUDE.md). No test framework is committed in `package.json`; contract tests for new endpoints are structured so they can be introduced with any Node.js runner when the project adds one. Until then, verification is type-checking (`tsc --noEmit` via `next build`) + ESLint + manual quickstart.
**Target Platform**: Linux server deployment (Railway, Hetzner VPS for bot runtimes), modern browsers for dashboard UI.
**Project Type**: Web application (Next.js App Router monorepo in a single `src/` tree).
**Performance Goals**: Per-instance activity panel renders last 50 invocations in < 500 ms (SWR cache + indexed query). Runtime tool invocation proxy adds < 200 ms p95 over the upstream Composio latency. Catalog and connection list responses < 300 ms p95.
**Constraints**: Must respect Constitution (App Router, Type Safety, shadcn/ui, i18n, Drizzle, Better Auth sessions, Design Quality, File Conventions). No raw SQL. No `any`. No hardcoded user strings — every new label passes through next-intl `en` + `es`. OAuth callback URL is a subpath of `papayaclaw.com` (HTTPS only). Sensitive fields never logged.
**Scale/Scope**: Expected v1 scale — up to a few thousand connected accounts total across active users; single-digit tool invocations per second per instance during normal conversation; 8-service curated catalog.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Next.js App Router First | **Pass** | All new routes are `route.ts` App Router handlers under `src/app/api/**`. Server Components used for data-bearing UI where interactivity isn't required. |
| II. Type Safety (NON-NEGOTIABLE) | **Pass** | All new endpoints Zod-validate requests and responses. Drizzle gives type-safe schema access. Composio SDK is typed. No `any`, no `@ts-ignore`. |
| III. Component-Driven UI with shadcn/ui | **Pass with justified exception** | New UI built from shadcn primitives (`Card`, `Button`, `Badge`, `Dialog`, `Switch`, `Tabs`). Platform icons from Lucide React. **Exception**: brand icons for the 8 services come from `src/components/icons/` (pattern already established by 003-instance-tabs feature); Lucide has no brand glyphs. Justified in Complexity Tracking. |
| IV. Internationalization Always | **Pass** | All new user strings go through next-intl with translations added to `messages/en.json` and `messages/es.json` in the same PR. Navigation uses `@/i18n/navigation`. |
| V. Drizzle ORM for Data Access | **Pass** | Three new tables added to `src/lib/schema.ts` following the existing pattern (`text` ids, `.references()` FKs, `createdAt`/`updatedAt` with `defaultNow()` + `$onUpdate`). No raw SQL. |
| VI. Authentication and Authorization | **Pass** | Every user-facing API route validates Better Auth session via `auth.api.getSession({ headers: await headers() })` and returns 401 on absence. Bot-facing runtime endpoints authenticate with the instance's existing `callbackSecret` (Bearer header), the same mechanism used by other instance callbacks. |
| VII. Design Quality Standards | **Pass** | Implementation follows `frontend-design`, `interface-design`, and `shadcn` skills (called out explicitly per user memory `feedback_ui_skills.md`). Dark-mode-aware via CSS variables. Motion used only where CSS insufficient. |
| VIII. File and Code Conventions | **Pass** | All new files kebab-case. Components PascalCase, named exports. SWR for client fetches. Sonner for toasts. No new state library. |

**Tech stack additions**: `@composio/core` (tool provider SDK). Added to the Technology Stack Constraints table implicitly for v1; any further Composio provider sub-packages (e.g., `@composio/anthropic`) are only installed if the bot runtime needs them — bot runtime integration is out of scope for this feature's server-side proxy model (see Research R2).

Gate: **PASS**. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/004-composio-integration/
├── plan.md                 # This file
├── research.md             # Phase 0 output
├── data-model.md           # Phase 1 output
├── quickstart.md           # Phase 1 output
├── contracts/              # Phase 1 output
│   ├── README.md
│   ├── rest-api.md
│   └── schemas.ts
├── checklists/
│   └── requirements.md     # Created during /speckit.specify
└── tasks.md                # Phase 2 output (created by /speckit.tasks, not here)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/
│   │   ├── integrations/
│   │   │   ├── catalog/route.ts              # GET curated 8-service catalog
│   │   │   ├── connect/route.ts              # POST initiate OAuth
│   │   │   ├── callback/route.ts             # GET OAuth return handler
│   │   │   ├── connections/route.ts          # GET list user's connections
│   │   │   └── connections/[id]/route.ts     # DELETE disconnect, PATCH reconnect
│   │   └── instances/
│   │       └── [id]/
│   │           ├── integrations/route.ts              # GET toggles for instance
│   │           ├── integrations/[toolkit]/route.ts    # PATCH toggle + account selection
│   │           ├── integration-activity/route.ts      # GET last 50 invocations
│   │           └── tools/                             # Bot-facing (callbackSecret auth)
│   │               ├── manifest/route.ts              # GET allowed tools for this instance
│   │               └── invoke/route.ts                # POST execute action, audit, return result
│   └── [locale]/…                                     # existing locale routing (unchanged)
├── components/
│   ├── dashboard/
│   │   ├── tabs/
│   │   │   └── integrations-tab.tsx          # REWRITE (replace placeholder)
│   │   └── integrations/
│   │       ├── service-catalog-grid.tsx      # 8 cards, connect button each
│   │       ├── connection-list.tsx           # connected accounts, health, disconnect
│   │       ├── instance-toggles.tsx          # per-instance service on/off + account pick
│   │       ├── activity-panel.tsx            # last 50 invocations table
│   │       └── reconnect-dialog.tsx          # shared reconnect flow dialog
│   └── icons/
│       ├── google-sheets.tsx                 # NEW brand icon
│       ├── linear.tsx                        # NEW brand icon
│       └── github.tsx                        # NEW brand icon
└── lib/
    ├── schema.ts                             # EXTEND with 3 new tables
    ├── composio.ts                           # Composio client singleton + helpers
    └── integrations/
        ├── catalog.ts                        # 8-service static catalog definition
        ├── connection-service.ts             # connect / callback / disconnect / reconnect
        ├── instance-binding-service.ts       # toggle / select-account / list
        ├── invoke-service.ts                 # gatekeep + execute + audit
        └── errors.ts                         # typed domain errors
messages/
├── en.json                                   # EXTEND with Integrations namespace
└── es.json                                   # EXTEND with Integrations namespace
```

**Structure Decision**: Single Next.js App Router project (existing layout). The feature is additive — no new top-level directories beyond the `integrations/` sub-trees under `components/dashboard/` and `lib/`. All three data tables live in the existing `src/lib/schema.ts`. The bot-facing runtime endpoints sit under `src/app/api/instances/[id]/tools/**` so they inherit the same `instance.callbackSecret` authentication pattern the project already uses for other bot-side callbacks (`reconfigure/route.ts`, `status/route.ts`, `pairing/route.ts`).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Brand icon files in `src/components/icons/` (Constitution III says Lucide-only) | Gmail/Notion/Slack/etc. need recognisable brand glyphs in the catalog; Lucide does not ship brand logos | (a) Using Lucide's generic `Plug` for every service erases brand recognition and measurably hurts scan-ability of the catalog. (b) A new icon-library dependency adds surface area and duplicates what's already a local pattern (`src/components/icons/` was established by prior features for the same reason). |
| Runtime tool invocations proxied through PapayaClaw (bot does not call Composio directly) | Spec FR-014 requires platform-enforced authorisation on every call and FR-017 requires audit; both are unachievable if the bot holds direct Composio session credentials | (a) Giving the bot its own Composio session would move the authorisation boundary to the bot runtime and make audit dependent on the bot's honesty — unacceptable per the security posture in FR-020/FR-022. (b) Exposing Composio MCP server directly to the bot would be lower-latency but leaks the same trust boundary. Proxy adds < 200 ms p95 for a single extra hop, which the spec's non-functional budget absorbs. |
