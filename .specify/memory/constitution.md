<!--
  SYNC IMPACT REPORT
  ====================
  Version change: (new) -> 1.0.0
  Modified principles: N/A (initial constitution)
  Added sections:
    - 8 Core Principles (I through VIII)
    - Technology Stack Constraints
    - Development Workflow
    - Governance
  Removed sections: N/A
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ compatible (Constitution Check is dynamic)
    - .specify/templates/spec-template.md ✅ compatible (no principle-specific references)
    - .specify/templates/tasks-template.md ✅ compatible (no principle-specific references)
  Follow-up TODOs: None
-->

# PapayaClaw Constitution

## Core Principles

### I. Next.js App Router First

All pages and API routes MUST use Next.js App Router conventions.
Server Components are the default; the `"use client"` directive MUST
only appear when client interactivity is required (state, effects,
browser APIs). Async server components MUST be used for data fetching.
API routes follow the `route.ts` convention returning `NextResponse`.
The project uses a custom Node.js server (`server.ts`) wrapping
Next.js for Socket.IO/WebSocket support; all HTTP routing still
flows through Next.js.

**Rationale**: Server-first rendering maximizes performance and SEO.
The custom server exists solely for real-time WebSocket features and
MUST NOT be used to bypass Next.js routing.

### II. Type Safety (NON-NEGOTIABLE)

TypeScript strict mode is enabled and MUST remain enabled. No `any`
types. No `@ts-ignore`. Use interfaces for object shapes and props;
use type aliases for unions and intersections. All API request and
response bodies MUST be validated with Zod. Database queries go
through Drizzle ORM, which provides type-safe schema-to-query
guarantees. The path alias `@/*` maps to `./src/*`.

**Rationale**: Strict typing catches errors at compile time, reduces
runtime failures, and ensures safe refactoring across the codebase.

### III. Component-Driven UI with shadcn/ui

All UI MUST be built on shadcn/ui components (new-york style,
RSC-enabled). Use the `cn()` utility from `@/lib/utils` for class
merging. Styling MUST use Tailwind CSS 4 with CSS variables for
theming. Use Class Variance Authority (`cva`) for component variants.
Icons MUST come from Lucide React exclusively. When building new
interfaces or features, follow the `frontend-design`,
`interface-design`, and `shadcn` skills for high-quality, distinctive
UI. Generic AI aesthetics are forbidden. Custom fonts: Syne
(display), DM Sans (body). The project uses a cyber-tropical design
aesthetic with primary `#ff5722` (deep orange) and secondary
`#cddc39` (lime).

**Rationale**: A unified component library enforces visual consistency,
reduces duplication, and accelerates UI development.

### IV. Internationalization Always

Every user-facing string MUST go through next-intl. Server components
use `getTranslations()`; client components use `useTranslations()`.
Translation files live in `/messages/{locale}.json` (currently `en`,
`es`). Navigation MUST use `Link`, `redirect`, and `useRouter` from
`@/i18n/navigation` — never from `next/link` directly. Locale routing
uses the `"as-needed"` prefix strategy. All new features MUST include
translations for every supported locale before merge.

**Rationale**: The platform targets a multilingual audience from day
one. Hardcoded strings create technical debt that compounds with each
new locale added.

### V. Drizzle ORM for Data Access

All database operations MUST use Drizzle ORM with PostgreSQL. Schema
is defined in `/src/lib/schema.ts` using `pgTable()`. Use Drizzle
query builders (`select`, `insert`, `update`, `delete`) — no raw SQL.
Migrations are managed via `drizzle-kit push`. Foreign key
relationships MUST be explicitly declared with `.references()`. All
tables MUST have `createdAt` (`defaultNow`) and `updatedAt` (with
`$onUpdate`) timestamp columns.

**Rationale**: Type-safe ORM queries eliminate SQL injection risks and
ensure schema changes propagate through the type system.

### VI. Authentication and Authorization

Better Auth handles all authentication with Google OAuth as the social
provider. Session validation in API routes MUST use
`auth.api.getSession({ headers: await headers() })`. Every API route
that accesses user data MUST validate the session first and return
HTTP 401 if missing. The auth client for browser-side usage is at
`@/lib/auth-client.ts`. Custom auth logic MUST NOT be introduced.

**Rationale**: Centralizing auth in Better Auth prevents security
gaps from ad-hoc session handling and ensures consistent
authentication across all endpoints.

### VII. Design Quality Standards

When creating or modifying any frontend interface, the implementation
MUST follow:
- The `frontend-design` skill for distinctive aesthetics (no AI slop)
- The `interface-design` skill for product-aware UI (dashboards,
  admin panels, tools)
- The `shadcn` skill for component composition and styling rules
- The `vercel-react-best-practices` skill for React/Next.js
  performance patterns

Dark mode MUST be supported via CSS variables and the `.dark` class.
Animations MUST use a CSS-first approach; the Motion library is
acceptable when CSS alone is insufficient.

**Rationale**: Design quality directly impacts user trust and
adoption. Skill-driven guidelines prevent the accumulation of
inconsistent, low-quality UI patterns.

### VIII. File and Code Conventions

- Files MUST use kebab-case naming (e.g., `instance-card.tsx`,
  `deploy-dialog.tsx`)
- Components MUST use PascalCase
- Import order: (1) Next.js/React, (2) third-party libraries,
  (3) internal components, (4) internal utilities and types
- Named exports MUST be used for components and utilities
- Data fetching uses SWR for client-side caching
- Toast notifications use Sonner
- State management MUST use React hooks; no external state libraries

**Rationale**: Consistent conventions reduce cognitive load during
code review and enable automated linting enforcement.

## Technology Stack Constraints

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 16 + React 19 | React Compiler enabled |
| Database | PostgreSQL via Drizzle ORM | Strict schema typing |
| Auth | Better Auth + Google OAuth | Single provider for now |
| UI | shadcn/ui (new-york) + Tailwind CSS 4 + Lucide icons | CSS variables for theming |
| i18n | next-intl | Locale-prefixed routing |
| Payments | Polar.sh (`@polar-sh/nextjs`) | Subscription billing |
| Infrastructure | Hetzner Cloud (VPS), Cloudflare (DNS/tunnels) | Automated provisioning |
| Real-time | Socket.IO | SSH terminal via WebSocket |
| Validation | Zod | All API boundaries |
| Data fetching | SWR (client), async server components (server) | No redundant fetching |
| Content | MDX via next-mdx-remote | Blog system |
| Deployment | Railway | Custom server (`tsx server.ts`) |
| Package manager | npm | Lockfile committed |

Adding a new technology to this stack requires explicit justification
and constitution amendment.

## Development Workflow

- **Lint**: ESLint with `next/core-web-vitals` and `typescript` config.
  All code MUST pass lint before merge.
- **Database migrations**: Run `npx drizzle-kit push` before deploy.
  Schema changes MUST be reviewed for backward compatibility.
- **Dev server**: `npm run dev` (runs `tsx server.ts` for Socket.IO
  support). MUST NOT use `next dev` directly.
- **Build**: `npm run build` (includes post-build IndexNow
  submission for SEO).
- **PRs**: All pull requests MUST pass lint and build checks before
  merge.
- **Performance**: Follow the `vercel-react-best-practices` skill for
  React and Next.js performance patterns.

## Governance

This constitution supersedes all ad-hoc development practices for the
PapayaClaw project. All contributors and AI agents MUST comply.

**Amendment procedure**:
1. Propose the change with rationale in a pull request.
2. Update the constitution version following semantic versioning:
   - MAJOR: Principle removal or backward-incompatible redefinition.
   - MINOR: New principle or materially expanded guidance.
   - PATCH: Clarifications, wording, or non-semantic refinements.
3. Update dependent templates if principles change.
4. Merge requires explicit approval.

**Compliance review**:
- All code reviews MUST verify compliance with these principles.
- Use `CLAUDE.md` for runtime development guidance that supplements
  (but does not override) this constitution.

**Version**: 1.0.0 | **Ratified**: 2026-04-09 | **Last Amended**: 2026-04-09
