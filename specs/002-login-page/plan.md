# Implementation Plan: Login Page

**Branch**: `002-login-page` | **Date**: 2026-04-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-login-page/spec.md`

## Summary

Add a dedicated `/login` page with Google OAuth via Better Auth, using shadcn/ui components and theme colors (no hardcoded colors). Replace the header "Contact" link with a "Login" link for unauthenticated users. All strings internationalized for `en` and `es`.

## Technical Context

**Language/Version**: TypeScript 5 (strict mode)
**Primary Dependencies**: Next.js 16, React 19, Better Auth 1.4.18, shadcn/ui (new-york), Tailwind CSS 4, next-intl 4.8, Lucide React
**Storage**: PostgreSQL via Drizzle ORM (no schema changes needed — existing Better Auth tables)
**Testing**: Manual verification (existing project has no test framework configured for UI)
**Target Platform**: Web (desktop primary, responsive)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Login page LCP < 1s (minimal content, no data fetching)
**Constraints**: Must use theme CSS variables only — no hardcoded colors. Must use shadcn components.
**Scale/Scope**: 2 files modified (header, i18n messages), 2 new files (login page + layout)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Next.js App Router First | PASS | Login page uses App Router `src/app/[locale]/login/page.tsx`. Server component for auth redirect, client component for sign-in button. |
| II. Type Safety | PASS | No `any` types. Props typed with interfaces. |
| III. Component-Driven UI with shadcn/ui | PASS | Login page built with `Card`, `Button` from shadcn/ui. Google icon from existing `src/components/icons/google.tsx`. Styling via Tailwind CSS variables only (no hardcoded colors). |
| IV. Internationalization Always | PASS | All strings via next-intl. New keys added to `en.json` and `es.json` under `LoginPage` and `Header.login` namespaces. |
| V. Drizzle ORM for Data Access | N/A | No database operations — Better Auth handles session/user storage. |
| VI. Authentication and Authorization | PASS | Uses Better Auth Google OAuth. Server-side session check via `auth.api.getSession()` in login layout. Client-side sign-in via `authClient.signIn.social({ provider: "google" })`. |
| VII. Design Quality Standards | PASS | Must invoke `frontend-design`, `interface-design`, `shadcn` skills during implementation. Theme CSS variables for dark/light mode. |
| VIII. File and Code Conventions | PASS | kebab-case files (`login-form.tsx`), PascalCase components, correct import order. |

**Gate result**: ALL PASS — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/002-login-page/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/[locale]/login/
│   ├── layout.tsx       # Server component: auth check → redirect to /dashboard if logged in
│   └── page.tsx         # Server component: renders LoginForm
├── components/
│   ├── login-form.tsx   # Client component: "Sign in with Google" button + branding
│   ├── icons/
│   │   └── google.tsx   # Existing Google icon (reuse)
│   └── header.tsx       # Modified: "Contact" → "Login" link
├── lib/
│   ├── auth.ts          # Existing (no changes)
│   └── auth-client.ts   # Existing (no changes)
messages/
├── en.json              # Modified: add LoginPage + Header.login keys
└── es.json              # Modified: add LoginPage + Header.login keys
```

**Structure Decision**: Next.js App Router with `[locale]/login/` route. Login form extracted as a client component (`login-form.tsx`) since it needs `authClient.signIn.social()` (browser API). Layout handles server-side auth redirect.

## Complexity Tracking

> No constitution violations — table not needed.
