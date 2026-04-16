# Implementation Plan: Instance Detail Tabbed Interface

**Branch**: `003-instance-tabs` | **Date**: 2026-04-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-instance-tabs/spec.md`

## Summary

Reorganize `src/app/[locale]/dashboard/[id]/page.tsx` (which renders `InstanceDetail`) from a long, stacked single-page layout into a five-tab interface using the existing `@/components/ui/tabs` primitive. Tabs: **General** (identifying metadata, core telemetry, gateway launcher, AI model/provider), **Channels** (Telegram + WhatsApp sub-views), **SSH** (Root Terminal), **Integrations** (placeholder), **Agents** (placeholder).

The page header (back link, instance name, status badge, ID, createdAt) stays outside the tab shell. Live state (status polling, pairing requests, allowed WhatsApp numbers) continues to run in the parent component so switching tabs does not reset it. A cross-tab attention indicator on the Channels trigger surfaces actionable events (e.g., pending pairing requests) regardless of the active tab. No API/DB/auth changes; purely a UI restructure. All new user-facing strings localized via `next-intl` for `en` and `es`.

## Technical Context

**Language/Version**: TypeScript 5 (strict mode)
**Primary Dependencies**: Next.js 16 (App Router, React Compiler), React 19, shadcn/ui `Tabs` (Radix under the hood), Tailwind CSS 4, next-intl 4.8, Lucide React, SWR (existing status polling), Sonner (toasts)
**Storage**: PostgreSQL via Drizzle ORM — no schema changes (UI-only feature)
**Testing**: Manual verification against existing `npm run lint` and `npm run build`; no test framework is configured for UI in this repo
**Target Platform**: Web (desktop primary; responsive down to ~640px for narrow laptops)
**Project Type**: Next.js web application (`src/app/[locale]/…` routing; server `page.tsx` + client child component)
**Performance Goals**: Tab switch visible within 100 ms for already-rendered content (SC-007); no additional network polling introduced beyond existing SWR interval; React Compiler auto-memoizes where appropriate
**Constraints**:
- Strictly CSS-variable-based theming (cyber-tropical palette already defined); no hardcoded colors
- `"use client"` only where needed; top-level page route remains a server component
- No functionality loss: every control currently present must remain reachable (SC-004)
- Follow `frontend-design`, `interface-design`, `shadcn`, and `vercel-react-best-practices` skills (per user input and Constitution §VII)
- All user-visible text through next-intl (existing `InstanceDetail` namespace extended)
**Scale/Scope**: 1 client component rewritten (`instance-detail.tsx` split into a shell + 5 tab panels), 2 i18n files updated, 0 new routes, 0 API changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Next.js App Router First | PASS | Route `src/app/[locale]/dashboard/[id]/page.tsx` remains a server component performing session + instance fetch; only the client shell (`InstanceDetail`) and its extracted tab panels carry `"use client"`. No API routes added. |
| II. Type Safety (NON-NEGOTIABLE) | PASS | All new components typed with interfaces for props; union types for tab keys (`"general" \| "channels" \| "ssh" \| "integrations" \| "agents"`). Zero `any`, zero `@ts-ignore`. SWR fetchers reuse existing typed response shapes. |
| III. Component-Driven UI with shadcn/ui | PASS | Builds on existing `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `@/components/ui/tabs`. Continues to reuse `Badge`, `Button`, `Input`. Icons from Lucide React only. `cn()` for class merging. Uses `frontend-design`, `interface-design`, `shadcn` skills during implementation (also explicitly requested by user input). |
| IV. Internationalization Always | PASS | All new strings (tab labels, placeholder messaging, "provisioning required" empty-states, attention-indicator aria labels) added under the existing `InstanceDetail` namespace in `messages/en.json` and `messages/es.json`. |
| V. Drizzle ORM for Data Access | N/A | No database operations touched. |
| VI. Authentication and Authorization | PASS | Auth/session handling remains in the server `page.tsx` unchanged. No new endpoints are introduced. |
| VII. Design Quality Standards | PASS | Cyber-tropical aesthetic preserved. Dark-mode via CSS variables. Follows `frontend-design`, `interface-design`, `shadcn`, and `vercel-react-best-practices` skills during implementation (per Constitution §VII and user input). CSS-first animations; no new Motion dependency needed. |
| VIII. File and Code Conventions | PASS | New files kebab-case (e.g., `tabs/general-tab.tsx`, `tabs/channels-tab.tsx`). Components PascalCase with named exports. Import order preserved: Next/React → third-party → internal components → internal utils/types. Continues to use SWR for polling; no new state library. |

**Gate result (pre-design)**: ALL PASS — proceed to Phase 0.

### Re-evaluation after Phase 1 design

| Principle | Post-design status | Notes |
|-----------|--------------------|-------|
| I. Next.js App Router First | PASS | Design keeps `src/app/[locale]/dashboard/[id]/page.tsx` as a server component; no new routes or API handlers (confirmed in `contracts/component-contracts.md` §9). |
| II. Type Safety | PASS | Explicit `TabKey` union + `GeneralTabProps`/`ChannelsTabProps`/`SshTabProps` interfaces in `contracts/component-contracts.md`. No `any`. |
| III. Component-Driven UI with shadcn/ui | PASS | Design reuses existing `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`; no new primitives introduced; Lucide-only icons; `cn()` for class merging. |
| IV. Internationalization Always | PASS | Full i18n key tree specified in `data-model.md` and enforced in `contracts/component-contracts.md` §8 (both `en.json` and `es.json` must have identical shape). |
| V. Drizzle ORM | N/A | Design confirms no schema/DB changes. |
| VI. Authentication and Authorization | PASS | No auth surface changes; server route unchanged. |
| VII. Design Quality Standards | PASS | Skill invocation checkpoints documented in `research.md` §10 and `quickstart.md` §6; CSS-variable theming preserved; dark mode retained. |
| VIII. File and Code Conventions | PASS | New files follow kebab-case naming (`tabs/general-tab.tsx`, etc.); named exports; no new state library; SWR unchanged. |

**Gate result (post-design)**: ALL PASS — no `Complexity Tracking` entries required.

## Project Structure

### Documentation (this feature)

```text
specs/003-instance-tabs/
├── plan.md              # This file
├── research.md          # Phase 0 output (/speckit.plan)
├── data-model.md        # Phase 1 output (/speckit.plan)
├── quickstart.md        # Phase 1 output (/speckit.plan)
├── contracts/           # Phase 1 output (/speckit.plan)
│   └── component-contracts.md
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── app/[locale]/dashboard/[id]/
│   └── page.tsx                    # Unchanged: server component (session + fetch); renders <InstanceDetail />
├── components/
│   ├── dashboard/
│   │   ├── instance-detail.tsx     # REWRITTEN: becomes the tabbed shell; keeps shared state (SWR, channel set, pairing, allowed numbers); delegates body rendering to tab panels
│   │   ├── model-provider-module.tsx  # Unchanged: rendered inside General tab
│   │   ├── ssh-terminal.tsx        # Unchanged: rendered inside SSH tab (dynamically imported)
│   │   └── tabs/                   # NEW: one file per tab panel
│   │       ├── general-tab.tsx     # Telemetry databand + gateway launcher + provisioning sequence + ModelProviderModule
│   │       ├── channels-tab.tsx    # Telegram + WhatsApp sub-views (existing in-card sub-tab logic extracted)
│   │       ├── ssh-tab.tsx         # Root Terminal idle/connected states
│   │       ├── integrations-tab.tsx  # Placeholder info card ("not yet implemented")
│   │       └── agents-tab.tsx        # Placeholder info card ("not yet implemented")
│   └── ui/
│       └── tabs.tsx                # Unchanged: existing shadcn Tabs primitive
├── lib/
│   └── ai-config-ui.ts             # Unchanged: formatters + icons reused
└── messages/
    ├── en.json                     # MODIFIED: extend InstanceDetail namespace (tab labels + placeholders + empty states)
    └── es.json                     # MODIFIED: mirror all new keys in Spanish
```

**Structure Decision**: Single-project Next.js App Router layout (matches the existing repo). The server route at `src/app/[locale]/dashboard/[id]/page.tsx` does not change — it still performs auth + instance fetch and renders the client shell. The client shell `InstanceDetail` is refactored: shared state (SWR status polling, pairing requests, allowed-number management, channel set derivation) stays in the shell so that tab switches never unmount it; each tab panel is a small client component that receives props. This keeps "no functionality loss" guaranteed (SC-004) and guarantees tab switching is instantaneous since no remount resets state (FR-012, SC-007). Placeholder tabs (Integrations, Agents) are tiny pure-presentational components.

## Complexity Tracking

> No constitution violations — table not required.
