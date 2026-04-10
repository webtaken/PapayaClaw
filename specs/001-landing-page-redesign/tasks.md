# Tasks: Landing Page Redesign

**Input**: Design documents from `/specs/001-landing-page-redesign/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: No test tasks included — not explicitly requested in the specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Add required shadcn component and prepare project for implementation

- [ ] T001 Add shadcn Tabs component via `npx shadcn@latest add tabs` (creates `src/components/ui/tabs.tsx`)
- [ ] T002 [P] Create directory `src/components/how-it-works-previews/` for preview sub-components

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Remove unused components and update translation files — MUST complete before user story work begins

**WARNING**: No user story work can begin until this phase is complete

- [ ] T003 Remove Configurator import and `<Configurator />` from `src/app/[locale]/page.tsx`
- [ ] T004 [P] Remove Comparison import and `<Comparison />` from `src/app/[locale]/page.tsx`
- [ ] T005 [P] Remove UseCases import and `<UseCases />` from `src/app/[locale]/page.tsx`
- [ ] T006 Delete file `src/components/configurator.tsx`
- [ ] T007 [P] Delete file `src/components/comparison.tsx`
- [ ] T008 [P] Delete file `src/components/use-cases.tsx`
- [ ] T009 Remove `Configurator`, `Comparison`, and `UseCases` translation namespaces from `messages/en.json`
- [ ] T010 [P] Remove `Configurator`, `Comparison`, and `UseCases` translation namespaces from `messages/es.json`
- [ ] T011 Add `Enterprise` namespace with keys (`title`, `description`, `cta`, `ctaAriaLabel`) to `messages/en.json`
- [ ] T012 [P] Add `Enterprise` namespace with keys (`title`, `description`, `cta`, `ctaAriaLabel`) to `messages/es.json`
- [ ] T013 Update `HowItWorks` namespace in `messages/en.json`: replace 3-step keys with 4-step keys (`step01Title`, `step01Description`, `step02Title`, `step02Description`, `step03Title`, `step03Description`, `step04Title`, `step04Description`), update `title` and add `subtitle`
- [ ] T014 [P] Update `HowItWorks` namespace in `messages/es.json`: same structure as T013 with Spanish translations
- [ ] T015 Update `Hero` namespace in `messages/en.json`: remove `badge` key, simplify title/description keys as needed
- [ ] T016 [P] Update `Hero` namespace in `messages/es.json`: same changes as T015 with Spanish translations

**Checkpoint**: All removed components gone, translation files restructured — user story implementation can begin

---

## Phase 3: User Story 1 — First-time Visitor Understands the Product (Priority: P1) MVP

**Goal**: Redesign the Hero section with clean, minimal typography. No badge, no uppercase, no text-stroke/drop-shadow. Primary CTA scrolls to #how-it-works, secondary to #pricing.

**Independent Test**: Load landing page, verify Hero shows clean headline + description + two CTAs above the fold.

### Implementation for User Story 1

- [ ] T017 [US1] Rewrite `src/components/hero.tsx`: remove badge div, replace h1 styling with clean typography (`text-4xl sm:text-5xl md:text-6xl font-bold text-foreground` — no uppercase, no `-webkit-text-stroke`, no `drop-shadow`). Remove `badge` translation call. Keep background effects (cyber-grid, gradient-mesh). Use `getTranslations("Hero")` for server component.
- [ ] T018 [US1] Update `src/components/hero-ctas.tsx`: change primary CTA scroll target from `#configurator` to `#how-it-works`. Verify secondary CTA targets `#pricing`. Add `scroll-margin-top: 80px` to target sections via Tailwind class `scroll-mt-20`.

**Checkpoint**: Hero section fully functional — clean design, working CTAs, above the fold content visible

---

## Phase 4: User Story 2 — Visitor Learns How It Works (Priority: P2)

**Goal**: Build the interactive 4-step stepper with preview panels using shadcn Tabs (ARIA tablist pattern). Vertical step list on left, preview panel on right. Each step shows a realistic decorative UI preview.

**Independent Test**: Scroll to How It Works section, verify 4 steps displayed with stepper interaction. Click each step to see its preview. Test keyboard navigation (Tab, Arrow keys, Enter/Space).

### Implementation for User Story 2

- [ ] T019 [P] [US2] Create `src/components/how-it-works-previews/preview-login.tsx`: decorative Card showing Google sign-in button mockup, "Create your account in seconds" text, "No credit card required" badge. All elements `tabIndex={-1}` and `pointer-events-none`. Container `aria-hidden="true"`. Use shadcn Card, Button, Badge components. Use CSS variables for colors (no hardcoded values).
- [ ] T020 [P] [US2] Create `src/components/how-it-works-previews/preview-configure.tsx`: decorative Card showing channel selection grid (Telegram highlighted with checkmark, Discord, WhatsApp with "soon" badge), bot token Input with placeholder value, model dropdown showing "Claude Sonnet". Inspired by `deploy-dialog.tsx` layout. Use shadcn Card, Input, Label, Badge. Container `aria-hidden="true"`.
- [ ] T021 [P] [US2] Create `src/components/how-it-works-previews/preview-deploy.tsx`: decorative Card showing provisioning progress steps (Creating server, Configuring DNS, Installing agent, Starting services) with progress indicators — active step has animated pulse, completed steps have checkmarks. Inspired by `instance-detail.tsx` provisioning view. Use shadcn Card, Badge. Container `aria-hidden="true"`.
- [ ] T022 [P] [US2] Create `src/components/how-it-works-previews/preview-marketplace.tsx`: decorative Card showing a grid of agent template tags/badges (Customer Support, Code Reviewer, Travel Planner, etc.) with app connection icons. Placeholder design for future implementation. Use shadcn Card, Badge. Container `aria-hidden="true"`.
- [ ] T023 [US2] Create `src/components/how-it-works-stepper.tsx`: client component (`"use client"`) using shadcn Tabs with `orientation="vertical"` and `defaultValue="step-01"`. Left column: TabsList with 4 TabsTrigger items (icon, step number, title, description). Right column: 4 TabsContent panels rendering the corresponding preview component. Two-column layout on desktop (`grid grid-cols-1 md:grid-cols-[1fr_2fr]`), stacked on mobile. Active step visually highlighted via Tabs' built-in `data-[state=active]` styling. Each step has a visible focus indicator (`focus-visible:ring-2 ring-ring`). Each TabsContent uses `aria-labelledby` referencing its trigger. Props: `steps: StepData[]` (receives translated step data from server parent). Use `useTranslations("HowItWorks")` if needed for any additional client-side text.
- [ ] T024 [US2] Rewrite `src/components/how-it-works.tsx`: server component (async) that renders the section wrapper with `id="how-it-works"` and `scroll-mt-20` class. Clean heading typography (consistent with Hero — no uppercase, no text-stroke, no drop-shadow). Fetches translations via `getTranslations("HowItWorks")`. Builds `StepData[]` array with translated titles/descriptions and Lucide icons (UserPlus, Settings, Rocket, Users). Passes steps data to `<HowItWorksStepper steps={steps} />` client component.

**Checkpoint**: How It Works section fully functional — 4 interactive steps, preview panels swap on click, keyboard accessible, responsive

---

## Phase 5: User Story 3 — Visitor Sees Pricing and Converts (Priority: P2)

**Goal**: Pricing section retained as-is but section must have `id="pricing"` and `scroll-mt-20` for CTA scroll targeting.

**Independent Test**: Scroll to Pricing section or click Hero secondary CTA. Verify section scrolls into view with header offset.

### Implementation for User Story 3

- [ ] T025 [US3] Verify `src/components/pricing.tsx` has `id="pricing"` on the section element. Add `scroll-mt-20` class for header offset on smooth scroll. No other changes to Pricing component.

**Checkpoint**: Pricing section accessible via Hero CTA scroll, retained as-is

---

## Phase 6: User Story 4 — Visitor Browses on Mobile (Priority: P2)

**Goal**: All sections render correctly on mobile viewports (320px–768px). Steps and previews stack vertically. Touch targets minimum 44x44px.

**Independent Test**: Resize browser to 375px and scroll through all sections. Verify no horizontal overflow, readable text, tappable buttons.

### Implementation for User Story 4

- [ ] T026 [US4] Review and verify responsive layout of `src/components/hero.tsx`: text scales down cleanly on mobile, CTAs are full-width or appropriately sized, no horizontal overflow.
- [ ] T027 [US4] Review and verify responsive layout of `src/components/how-it-works-stepper.tsx`: grid switches from two-column to single-column on mobile (`grid-cols-1 md:grid-cols-[1fr_2fr]`). TabsList stacks vertically. Preview panels appear below step list. Touch targets on TabsTrigger items are at least 44x44px.
- [ ] T028 [US4] Review and verify responsive layout of `src/components/enterprise.tsx` (created in US5 phase): text readable, CTA tappable, dark background renders correctly at mobile widths.

**Checkpoint**: Full landing page renders correctly at 375px width — no overflow, readable, tappable

---

## Phase 7: User Story 5 — Enterprise Section (Priority: P3)

**Goal**: Create the Enterprise section with dark background, bold headline, description, and Cal.com booking CTA. Dark mode uses differentiated surface. Accessible CTA with aria-label and new-tab indicator.

**Independent Test**: Scroll past Pricing section. Verify dark Enterprise section with headline, description, and CTA that opens Cal.com in new tab. Toggle dark mode — section maintains visual distinction.

### Implementation for User Story 5

- [ ] T029 [US5] Create `src/components/enterprise.tsx`: server component (async). Dark background section (`bg-zinc-950 text-zinc-50` in light mode; `dark:bg-zinc-800/50` or `dark:bg-gradient-to-br dark:from-zinc-800/60 dark:to-zinc-900/80` in dark mode for differentiation). Bold headline using `getTranslations("Enterprise")` for `t("title")`. Description paragraph for `t("description")` highlighting enterprise services (team of agents, custom integrations, dedicated support). CTA button as `<a href="https://cal.com/saul-rojas-zijrrm/30min?overlayCalendar=true" target="_blank" rel="noopener noreferrer">` styled with shadcn Button (variant `default` or custom). Include Lucide `ExternalLink` icon. Add `aria-label={t("ctaAriaLabel")}` for screen reader context. Center-aligned content with `max-w-4xl mx-auto` and generous padding.
- [ ] T030 [US5] Add `<Enterprise />` import and component to `src/app/[locale]/page.tsx` between `<Pricing />` and `<Footer />`. Final section order: Header, Hero, HowItWorks, Pricing, Enterprise, Footer.

**Checkpoint**: Enterprise section fully functional — dark background, CTA opens Cal.com, accessible, dark mode differentiated

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and validation across all sections

- [ ] T031 [P] Review and update JSON-LD structured data in `src/app/[locale]/page.tsx`: remove any FAQ entries referencing Configurator, Comparison, or UseCases. Verify WebSite, Organization, and SoftwareApplication schemas are still accurate.
- [ ] T032 [P] Verify all CSS uses CSS variables (`bg-background`, `text-foreground`, `bg-primary`, etc.) — no hardcoded color values except Enterprise dark surface. Check contrast in both light and dark modes for all sections.
- [ ] T033 Verify the landing page builds successfully with `npm run build` and passes ESLint with `npm run lint`.
- [ ] T034 Run quickstart.md validation: walk through all verification steps and confirm each passes.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 (Hero) and US5 (Enterprise) can proceed in parallel
  - US2 (How It Works) can proceed in parallel with US1 and US5
  - US3 (Pricing) can proceed in parallel (trivial change)
  - US4 (Mobile responsive) depends on US1, US2, US5 being complete (reviews their output)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational — no dependencies on other stories. All 4 preview components (T019–T022) can be built in parallel.
- **User Story 3 (P2)**: Can start after Foundational — trivial change, no dependencies
- **User Story 4 (P2)**: Depends on US1, US2, US5 — reviews their responsive output
- **User Story 5 (P3)**: Can start after Foundational — no dependencies on other stories

### Within Each User Story

- Models/data before services
- Preview components before stepper (US2)
- Server component before client component integration (US2)
- Core implementation before responsive review (US4)

### Parallel Opportunities

- All Setup tasks (T001, T002) can run in parallel
- All component deletions (T006, T007, T008) can run in parallel
- All translation file updates (en + es pairs) can run in parallel
- All 4 preview components (T019–T022) can run in parallel
- US1, US2, US3, US5 can all proceed in parallel after Foundational phase

---

## Parallel Example: User Story 2

```bash
# Launch all preview components together (different files, no dependencies):
Task: T019 "Create preview-login.tsx"
Task: T020 "Create preview-configure.tsx"
Task: T021 "Create preview-deploy.tsx"
Task: T022 "Create preview-marketplace.tsx"

# Then sequentially:
Task: T023 "Create how-it-works-stepper.tsx" (depends on T019-T022)
Task: T024 "Rewrite how-it-works.tsx" (depends on T023)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (Hero redesign)
4. **STOP and VALIDATE**: Test Hero section independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 (Hero) → Test independently → MVP!
3. Add User Story 2 (How It Works) + User Story 5 (Enterprise) in parallel → Test independently
4. Add User Story 3 (Pricing scroll target) → Test independently
5. Add User Story 4 (Mobile responsive review) → Test all viewports
6. Polish phase → Final validation

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Hero) + User Story 3 (Pricing)
   - Developer B: User Story 2 (How It Works) — largest scope
   - Developer C: User Story 5 (Enterprise)
3. After US1, US2, US5 complete:
   - Any developer: User Story 4 (Mobile responsive review)
4. Final: Polish phase

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- The How It Works stepper (US2) is the largest scope — 6 tasks including 4 parallel preview components
- Use `frontend-design`, `interface-design`, and `shadcn` skills when implementing UI components
- Follow `vercel-react-best-practices` skill for Next.js performance patterns
