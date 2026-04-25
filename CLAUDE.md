# papayaclaw Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-22

## Active Technologies
- TypeScript 5 (strict mode) + Next.js 16, React 19, Better Auth 1.4.18, shadcn/ui (new-york), Tailwind CSS 4, next-intl 4.8, Lucide React (002-login-page)
- PostgreSQL via Drizzle ORM (no schema changes needed — existing Better Auth tables) (002-login-page)
- TypeScript 5 (strict mode) + Next.js 16 (App Router, React Compiler), React 19, shadcn/ui `Tabs` (Radix under the hood), Tailwind CSS 4, next-intl 4.8, Lucide React, SWR (existing status polling), Sonner (toasts) (003-instance-tabs)
- PostgreSQL via Drizzle ORM — no schema changes (UI-only feature) (003-instance-tabs)
- TypeScript 5 strict mode, Node.js (server runtime via `tsx server.ts`) + Next.js 16 (App Router, React Compiler), React 19, `@composio/core` (new), Better Auth 1.4.18, Drizzle ORM 0.45.1 + PostgreSQL (`pg` 8.18), Zod 4, next-intl 4.8, shadcn/ui (new-york, Radix under the hood), Tailwind CSS 4, Lucide React (platform icons), SWR 2.4 (client fetching), Sonner (toasts) (004-composio-integration)
- PostgreSQL via Drizzle ORM. Three new tables declared in `src/lib/schema.ts`. Migrations applied with `npx drizzle-kit push`. No raw third-party tokens stored — credential custody lives at Composio. (004-composio-integration)

- TypeScript 5 (strict mode) + Next.js 16, React 19, shadcn/ui (new-york), Tailwind CSS 4, next-intl 4.8, Lucide React (001-landing-page-redesign)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5 (strict mode): Follow standard conventions

## Recent Changes
- 004-composio-integration: Added TypeScript 5 strict mode, Node.js (server runtime via `tsx server.ts`) + Next.js 16 (App Router, React Compiler), React 19, `@composio/core` (new), Better Auth 1.4.18, Drizzle ORM 0.45.1 + PostgreSQL (`pg` 8.18), Zod 4, next-intl 4.8, shadcn/ui (new-york, Radix under the hood), Tailwind CSS 4, Lucide React (platform icons), SWR 2.4 (client fetching), Sonner (toasts)
- 004-composio-integration: Added TypeScript 5 strict mode, Node.js (server runtime via `tsx server.ts`) + Next.js 16 (App Router, React Compiler), React 19, `@composio/core` (new), Better Auth 1.4.18, Drizzle ORM 0.45.1 + PostgreSQL (`pg` 8.18), Zod 4, next-intl 4.8, shadcn/ui (new-york, Radix under the hood), Tailwind CSS 4, Lucide React (platform icons), SWR 2.4 (client fetching), Sonner (toasts)
- 003-instance-tabs: Added TypeScript 5 (strict mode) + Next.js 16 (App Router, React Compiler), React 19, shadcn/ui `Tabs` (Radix under the hood), Tailwind CSS 4, next-intl 4.8, Lucide React, SWR (existing status polling), Sonner (toasts)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
