# Implementation Plan: Landing Page Redesign

**Branch**: `001-landing-page-redesign` | **Date**: 2026-04-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-landing-page-redesign/spec.md`

## Summary

Redesign the PapayaClaw landing page from 6 sections to 4: a simplified Hero (clean typography, no badge), an enhanced How It Works stepper (4 steps with interactive preview panels using ARIA tablist), a retained Pricing section, and a new Enterprise section (dark background, Cal.com CTA). Remove Configurator, Comparison, and UseCases components. All UI built with shadcn/ui components, Tailwind CSS variables for theming (no hardcoded colors), and full i18n support (en/es).

## Technical Context

**Language/Version**: TypeScript 5 (strict mode)
**Primary Dependencies**: Next.js 16, React 19, shadcn/ui (new-york), Tailwind CSS 4, next-intl 4.8, Lucide React
**Storage**: N/A (no database changes in this feature)
**Testing**: ESLint (next/core-web-vitals + typescript), Lighthouse accessibility audit
**Target Platform**: Web (SSR via Next.js App Router, responsive 320px–2560px)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Above-the-fold content in <2s, Lighthouse accessibility >=90
**Constraints**: No hardcoded colors — use CSS variables exclusively (except Enterprise dark section which may use specific dark values via CSS variables). Contrast must work in both light and dark modes.
**Scale/Scope**: Single landing page, 4 sections, ~8 component files modified/created

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Next.js App Router First | ✅ PASS | Server Components default; `"use client"` only on How It Works stepper (interactive tabs). Page layout remains async server component. |
| II. Type Safety | ✅ PASS | All props typed with interfaces. No `any` types. |
| III. Component-Driven UI (shadcn/ui) | ✅ PASS | Using Card, Button, Badge, Tabs (to be added), Input, Label from shadcn. `cn()` for class merging. CVA for variants. Lucide icons only. CSS variables for theming. |
| IV. Internationalization Always | ✅ PASS | All strings via next-intl. Server components: `getTranslations()`. Client components (stepper): `useTranslations()`. Both en.json and es.json updated. |
| V. Drizzle ORM | ⬜ N/A | No database changes in this feature. |
| VI. Authentication | ⬜ N/A | No auth changes. Pricing CTAs use existing auth flow. |
| VII. Design Quality Standards | ✅ PASS | Must invoke frontend-design, interface-design, shadcn skills during implementation. Dark mode via CSS variables. CSS-first animations. |
| VIII. File & Code Conventions | ✅ PASS | kebab-case files, PascalCase components, named exports, standard import order. |

**Gate result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-landing-page-redesign/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   ├── requirements.md  # Initial spec quality check
│   └── full-spectrum.md # Full-spectrum requirements quality check
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   └── [locale]/
│       └── page.tsx                          # MODIFY: Update section order, remove imports
├── components/
│   ├── hero.tsx                              # MODIFY: Simplify typography, remove badge
│   ├── hero-ctas.tsx                         # MODIFY: Update scroll targets (#how-it-works, #pricing)
│   ├── how-it-works.tsx                      # REWRITE: Interactive stepper with preview panels
│   ├── how-it-works-stepper.tsx              # CREATE: Client component for tablist interaction
│   ├── how-it-works-previews/
│   │   ├── preview-login.tsx                 # CREATE: Step 01 login page preview
│   │   ├── preview-configure.tsx             # CREATE: Step 02 channel/provider form preview
│   │   ├── preview-deploy.tsx                # CREATE: Step 03 deploying loader preview
│   │   └── preview-marketplace.tsx           # CREATE: Step 04 template marketplace preview
│   ├── enterprise.tsx                        # CREATE: Enterprise section component
│   ├── configurator.tsx                      # DELETE: Removed from landing page
│   ├── comparison.tsx                        # DELETE: Removed from landing page
│   ├── use-cases.tsx                         # DELETE: Removed from landing page
│   └── ui/
│       └── tabs.tsx                          # ADD: via `npx shadcn@latest add tabs`
messages/
├── en.json                                   # MODIFY: Add Enterprise, update HowItWorks, remove Configurator/Comparison/UseCases keys
└── es.json                                   # MODIFY: Same changes as en.json
```

**Structure Decision**: Next.js App Router monolith. All components in `src/components/`. Preview sub-components grouped in a `how-it-works-previews/` directory to keep the stepper previews organized. No new pages or API routes needed.

## Component Architecture

### Hero (modify existing)

- **Type**: Server Component (async)
- **Changes**: Remove badge div, remove uppercase/text-stroke/drop-shadow from h1, simplify to clean `text-4xl sm:text-5xl md:text-6xl font-bold text-foreground` styling. Keep background effects (cyber-grid, gradient-mesh) but tone down if needed.
- **Dependencies**: `hero-ctas.tsx` (client component)

### HeroCTAs (modify existing)

- **Type**: Client Component (`"use client"`)
- **Changes**: Primary CTA scrolls to `#how-it-works` (was `#configurator`). Secondary CTA scrolls to `#pricing` (unchanged).

### HowItWorks (rewrite)

- **Type**: Server Component wrapper + Client Component stepper
- **Pattern**: `how-it-works.tsx` (server) renders the section heading and delegates to `how-it-works-stepper.tsx` (client) which manages tab state.
- **shadcn components used**: Tabs, Card, Button, Badge, Input, Label
- **Accessibility**: ARIA tablist/tab/tabpanel pattern via shadcn Tabs component (built on Radix UI Tabs, which provides ARIA out of the box). Keyboard: Tab, Arrow keys, Enter/Space.
- **Layout**: Two-column on desktop (step list left ~1/3, preview right ~2/3). Stacked on mobile.

### Preview Components (create new)

All 4 are **presentational** components (no state, no interactivity):
- `preview-login.tsx`: Card with Google sign-in button mockup, "No credit card" text
- `preview-configure.tsx`: Card with channel selector (Telegram highlighted), bot token input, model dropdown showing Claude
- `preview-deploy.tsx`: Card with provisioning progress steps and loader animation
- `preview-marketplace.tsx`: Card with template tags/cards grid (placeholder)

All use shadcn Card, Input, Label, Badge, Button for consistent styling. All decorative content marked `aria-hidden="true"`.

### Enterprise (create new)

- **Type**: Server Component (async)
- **Styling**: Dark background using dedicated CSS variables or Tailwind dark surface classes. In light mode: `bg-zinc-950 text-zinc-50` (or custom CSS variable). In dark mode: differentiated via subtle gradient or lighter shade `bg-zinc-900` to maintain distinction.
- **Note on hardcoded colors**: The Enterprise section is a special case where dark background colors may be applied directly (e.g., `bg-zinc-950`) because the section must be dark regardless of theme. The text and accent colors still use CSS variables (`text-primary`, `text-foreground`-equivalent light text).
- **CTA**: `<a>` with `target="_blank"` and `rel="noopener noreferrer"`, styled as shadcn Button. Includes external link icon (Lucide `ExternalLink`) and contextual `aria-label`.

## Styling Strategy

- **No hardcoded colors** in general components — use CSS variables (`bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`, etc.)
- **Enterprise exception**: Dark surface colors (`bg-zinc-950`/`bg-zinc-900`) are acceptable because the section must be dark in both modes. Accent/text colors still use variables.
- **Dark mode contrast**: Test all sections with `.dark` class. Enterprise uses differentiated surface in dark mode.
- **Typography**: Replace current heavy styles with clean Tailwind utilities. No `uppercase`, no `-webkit-text-stroke`, no `drop-shadow` on text.
- **Animations**: CSS transitions for tab switching (`transition-opacity`, `transition-transform`). CSS-only hover effects.

## Complexity Tracking

No constitution violations — no complexity justifications needed.
