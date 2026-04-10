# Tasks: Login Page

**Input**: Design documents from `/specs/002-login-page/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not requested — test tasks omitted.

**Organization**: Tasks grouped by user story for independent implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: No new project initialization needed — existing Next.js project. This phase covers shared i18n additions.

- [x] T001 [P] Add `LoginPage` namespace and `Header.login` key to `messages/en.json` with English translations: title ("Welcome to PapayaClaw"), subtitle ("Sign in to manage your AI agents"), signInWithGoogle ("Sign in with Google"), securePrivateFree ("Secure · Private · Free"), login ("Login")
- [x] T002 [P] Add `LoginPage` namespace and `Header.login` key to `messages/es.json` with Spanish translations: title ("Bienvenido a PapayaClaw"), subtitle ("Inicia sesión para gestionar tus agentes de IA"), signInWithGoogle ("Iniciar sesión con Google"), securePrivateFree ("Seguro · Privado · Gratis"), login ("Iniciar sesión")

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No foundational infrastructure changes needed. Auth (Better Auth), routing (next-intl), and UI (shadcn) are already configured.

**⚠️ CRITICAL**: Phase 1 (i18n keys) must be complete before user story implementation.

**Checkpoint**: i18n keys added — user story implementation can begin.

---

## Phase 3: User Story 1 — Sign in with Google from Login Page (Priority: P1) 🎯 MVP

**Goal**: Unauthenticated users can visit `/login`, click "Sign in with Google", and be redirected to `/dashboard` after successful OAuth.

**Independent Test**: Visit `/login` unauthenticated → see login page with branding and Google button → click button → complete OAuth → land on `/dashboard`. Visit `/login` authenticated → auto-redirect to `/dashboard`.

### Implementation for User Story 1

- [x] T003 [US1] Create server-side login layout at `src/app/[locale]/login/layout.tsx` — async server component that checks session via `auth.api.getSession({ headers: await headers() })` and calls `redirect("/dashboard")` if session exists, otherwise renders `{children}`. Import `auth` from `@/lib/auth`, `headers` from `next/headers`, `redirect` from `next/navigation`. Call `setRequestLocale(locale)` for i18n.
- [x] T004 [US1] Create login page at `src/app/[locale]/login/page.tsx` — server component that renders `<LoginForm />` client component. Import and call `setRequestLocale(locale)` with `params.locale`. Minimal server component wrapper.
- [x] T005 [US1] Create `LoginForm` client component at `src/components/login-form.tsx` — `"use client"` directive. Use shadcn `Card` (`CardHeader`, `CardContent`, `CardFooter`) and `Button` components. Display PapayaClaw logo via `next/image` (`/papayaclaw.png`, appropriate dimensions). Display title and subtitle from `useTranslations("LoginPage")`. Render "Sign in with Google" `Button` containing the `Google` icon from `src/components/icons/google.tsx` and translated label `t("signInWithGoogle")`. On click: call `authClient.signIn.social({ provider: "google", callbackURL: "/dashboard" })`. Display footer text `t("securePrivateFree")`. All colors via CSS variables only (`bg-card`, `text-foreground`, `bg-primary`, `text-muted-foreground`, etc.) — no hardcoded colors. Dark mode automatic via CSS variables. Center the card on the page with flex layout.

**Checkpoint**: Login page functional — unauthenticated users can sign in via Google, authenticated users auto-redirect.

---

## Phase 4: User Story 2 — Header Login Button (Priority: P1)

**Goal**: Replace "Contact" mailto link with "Login" link in the header for unauthenticated users.

**Independent Test**: Load any page unauthenticated → header shows "Login" button → click → navigates to `/login`. Load any page authenticated → header shows "Sign Out" button (unchanged).

### Implementation for User Story 2

- [x] T006 [US2] Modify `src/components/header.tsx` — in the unauthenticated branch of the session conditional (the `else` block), replace the `<Link href="mailto:support@papayaclaw.com">` with `<Link href="/login">`. Change the translation call from `t("contact")` to `t("login")`. Keep existing styling classes (`rounded-full bg-primary px-5 py-2 text-sm font-bold uppercase tracking-wide text-black transition-all hover:bg-white neo-shadow-sm hover:neo-shadow`).

**Checkpoint**: Header login button functional — navigates to `/login` for unauthenticated users, sign-out unchanged for authenticated users.

---

## Phase 5: User Story 3 — Login Page i18n Support (Priority: P1)

**Goal**: All login page and header button text renders correctly in both English and Spanish.

**Independent Test**: Switch to Spanish locale → visit `/login` → all text in Spanish. Check header "Login" button text in both locales.

### Implementation for User Story 3

*All i18n keys were added in Phase 1 (T001, T002). All components use `useTranslations()` calls (T005, T006). This story is satisfied by the implementation of US1 + US2 with Phase 1 translations.*

- [x] T007 [US3] Verify i18n integration — confirm that `login-form.tsx` uses `useTranslations("LoginPage")` for all displayed text and that `header.tsx` uses `t("login")` for the login button. No hardcoded strings in either component.

**Checkpoint**: All text renders in both English and Spanish.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all stories.

- [x] T008 Verify dark mode — confirm login page renders correctly in both light and dark themes using only CSS variables (no hardcoded colors anywhere in `login-form.tsx`)
- [x] T009 Run `npm run lint` and fix any linting errors in new/modified files
- [x] T010 Run quickstart.md validation — follow all 6 verification steps in `specs/002-login-page/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — T001 and T002 can run in parallel
- **Phase 2 (Foundational)**: N/A — no foundational tasks needed
- **Phase 3 (US1)**: Depends on Phase 1 (i18n keys must exist). T003 and T004 are sequential (layout before page). T005 depends on T004.
- **Phase 4 (US2)**: Depends on Phase 1 (i18n keys). Independent of US1 — can run in parallel.
- **Phase 5 (US3)**: Depends on US1 + US2 completion (verification task)
- **Phase 6 (Polish)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (Login Page)**: Depends only on Phase 1 i18n keys
- **US2 (Header Button)**: Depends only on Phase 1 i18n keys — independent of US1
- **US3 (i18n Verification)**: Depends on US1 + US2 being complete

### Parallel Opportunities

- T001 and T002 (i18n files) can run in parallel
- US1 (T003–T005) and US2 (T006) can run in parallel after Phase 1

---

## Parallel Example: Phase 1

```bash
# Launch both i18n tasks together:
Task: "Add LoginPage namespace to messages/en.json" (T001)
Task: "Add LoginPage namespace to messages/es.json" (T002)
```

## Parallel Example: US1 + US2

```bash
# After Phase 1, launch both stories:
Task: "Create login layout" (T003) → "Create login page" (T004) → "Create LoginForm" (T005)
Task: "Modify header" (T006)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: i18n keys (T001, T002)
2. Complete Phase 3: Login page (T003, T004, T005)
3. **STOP and VALIDATE**: Visit `/login`, sign in with Google, verify redirect
4. Deploy if ready — login page works even without header button change

### Incremental Delivery

1. Phase 1 (i18n) → Foundation ready
2. US1 (Login Page) → Test independently → MVP!
3. US2 (Header Button) → Test independently → Full feature
4. US3 (i18n Verification) → Confirm both locales
5. Polish → Lint, dark mode, quickstart validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All components must use CSS variables for colors — no hardcoded hex values
- Use existing `Google` icon from `src/components/icons/google.tsx`
- Use existing shadcn `Card` and `Button` components
- Follow `frontend-design`, `interface-design`, `shadcn` skills during implementation
- Commit after each task or logical group
