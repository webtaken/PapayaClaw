# Research: Login Page

**Feature**: 002-login-page | **Date**: 2026-04-09

## Research Tasks

### 1. Better Auth Google Sign-In Client API

**Decision**: Use `authClient.signIn.social({ provider: "google", callbackURL: "/dashboard" })` from `@/lib/auth-client`.

**Rationale**: Better Auth's `signIn.social()` accepts a `callbackURL` parameter that controls where the user is redirected after successful OAuth. This avoids needing a separate callback handler — Better Auth's built-in `/api/auth/callback/google` route handles the OAuth exchange and redirects to `callbackURL`.

**Alternatives considered**:
- Manual OAuth redirect via `window.location.href` to Better Auth's `/api/auth/signin/google` — rejected because `authClient.signIn.social()` is the official API and handles CSRF tokens.
- Server Action for sign-in — rejected because Better Auth's client SDK is designed for browser-side OAuth flow initiation.

### 2. Server-Side Auth Redirect on Login Page

**Decision**: Use a server-side `layout.tsx` that checks `auth.api.getSession()` and calls `redirect("/dashboard")` if session exists.

**Rationale**: Follows the exact pattern used in `src/app/[locale]/dashboard/layout.tsx`. Server-side redirect prevents the login page from flashing before redirect. Consistent with Constitution Principle I (server components as default).

**Alternatives considered**:
- Client-side redirect via `useEffect` + `authClient.useSession()` — rejected because it causes a flash of login content before redirect.
- Middleware-based redirect — rejected as overkill for a single route; layout pattern already established in the codebase.

### 3. Login Page Component Architecture

**Decision**: Split into server page (`page.tsx`) + client form component (`login-form.tsx`).

**Rationale**: The page itself needs no client interactivity — it can be a server component that renders the client form. The form needs `"use client"` because it calls `authClient.signIn.social()` (browser API). This follows Constitution Principle I (minimize `"use client"` scope).

**Alternatives considered**:
- Entire page as client component — rejected because only the sign-in button needs client interactivity.
- Server Action approach — rejected because Better Auth's OAuth flow is initiated client-side by design.

### 4. shadcn/ui Component Selection

**Decision**: Use `Card` (container) + `Button` (sign-in action) from existing shadcn/ui components.

**Rationale**: Both components are already installed in the project. `Card` provides the visual container with `CardHeader`, `CardContent`, `CardFooter` sub-components. `Button` handles the CTA. All styling via CSS variables — no hardcoded colors. The `Google` icon component from `src/components/icons/google.tsx` is used inside the button.

**Alternatives considered**:
- Custom div-based layout without shadcn Card — rejected for consistency with Constitution Principle III.
- Adding new shadcn components (e.g., `Form`) — rejected as unnecessary for a single-button form.

### 5. i18n Key Structure

**Decision**: Add a `LoginPage` namespace in `en.json`/`es.json` with keys: `title`, `subtitle`, `signInWithGoogle`, `securePrivateFree`. Add `login` key to existing `Header` namespace.

**Rationale**: Follows the established pattern where each page/section has its own namespace (`Hero`, `Dashboard`, `Pricing`, etc.). The header key follows the existing `blog`, `pricing`, `dashboard`, `logout`, `contact` pattern.

**Alternatives considered**:
- Nesting under existing `Configurator` namespace — rejected because the login page is a standalone route, not part of the configurator flow.

### 6. Header Modification Approach

**Decision**: Replace the `<Link href="mailto:...">` with `<Link href="/login">` in the unauthenticated branch of the header conditional. Update translation key from `contact` to `login`.

**Rationale**: Minimal change — the conditional structure already exists (`session ? SignOut : Contact`). Only the href, styling, and translation key change. The `contact` key in messages can be kept for backward compatibility but is no longer rendered in the header.

**Alternatives considered**:
- Adding a separate login button alongside Contact — rejected per spec (Contact is fully replaced).
- Removing the `contact` translation key entirely — acceptable but not required; unused keys don't affect runtime.
