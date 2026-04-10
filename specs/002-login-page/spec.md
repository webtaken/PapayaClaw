# Feature Specification: Login Page

**Feature Branch**: `002-login-page`  
**Created**: 2026-04-09  
**Status**: Draft  
**Input**: User description: "Add a login page with Google OAuth only. Replace the 'Contact' button in the header with a 'Login' button that navigates to the login page."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in with Google from Login Page (Priority: P1)

An unauthenticated user visits the dedicated `/login` page and signs in using the "Sign in with Google" button. After successful authentication, they are redirected to `/dashboard`.

**Why this priority**: Core functionality — without this, there is no way to authenticate via a dedicated page.

**Independent Test**: Navigate to `/login`, click "Sign in with Google", complete Google OAuth flow, verify redirect to `/dashboard`.

**Acceptance Scenarios**:

1. **Given** an unauthenticated user, **When** they visit `/login`, **Then** they see a login page with the PapayaClaw branding, a "Sign in with Google" button, and supporting copy.
2. **Given** an unauthenticated user on `/login`, **When** they click "Sign in with Google", **Then** Better Auth initiates the Google OAuth flow.
3. **Given** a user completes Google OAuth successfully, **When** the callback resolves, **Then** they are redirected to `/dashboard`.
4. **Given** an already authenticated user, **When** they visit `/login`, **Then** they are redirected to `/dashboard` automatically.

---

### User Story 2 - Header Login Button (Priority: P1)

The "Contact" link in the header is replaced with a "Login" button that navigates to `/login` when the user is unauthenticated. When authenticated, the existing "Sign Out" button remains unchanged.

**Why this priority**: Equally critical — the login page needs a discoverable entry point from the header.

**Independent Test**: Load any page while unauthenticated, verify the header shows "Login" instead of "Contact", click it, verify navigation to `/login`.

**Acceptance Scenarios**:

1. **Given** an unauthenticated user on any page, **When** they look at the header, **Then** they see a "Login" button styled consistently with the existing header design (primary background, rounded-full, uppercase).
2. **Given** an unauthenticated user, **When** they click "Login" in the header, **Then** they navigate to `/login`.
3. **Given** an authenticated user, **When** they look at the header, **Then** they see the existing "Sign Out" button (no change to current behavior).

---

### User Story 3 - Login Page i18n Support (Priority: P1)

The login page and the new header button text are fully translated for both English and Spanish locales.

**Why this priority**: Constitution Principle IV mandates i18n for all user-facing strings before merge.

**Independent Test**: Switch locale to Spanish, visit `/login`, verify all text is in Spanish. Check header "Login" button text in both locales.

**Acceptance Scenarios**:

1. **Given** locale is `en`, **When** the user visits `/login`, **Then** all text is in English.
2. **Given** locale is `es`, **When** the user visits `/login`, **Then** all text is in Spanish.
3. **Given** locale is `es`, **When** the user views the header, **Then** the login button reads the Spanish equivalent.

---

### Edge Cases

- What happens when Google OAuth fails or the user cancels? The user should be returned to `/login` with no error crash (Better Auth handles this by default).
- What happens if the user navigates to `/login` with an expired session? They see the login page normally (treated as unauthenticated).
- What happens on mobile viewports? The login page must be responsive (but mobile header hamburger menu is out of scope for this feature if one does not currently exist).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render a dedicated login page at the `/login` route using Next.js App Router conventions.
- **FR-002**: The login page MUST display the PapayaClaw logo, a welcome/title message, and a "Sign in with Google" button. The Google button MUST use the existing `Google` icon component from `src/components/icons/google.tsx` — not an inline SVG or third-party icon.
- **FR-003**: Clicking "Sign in with Google" MUST initiate the Better Auth Google OAuth flow via `authClient.signIn.social({ provider: "google" })`.
- **FR-004**: After successful authentication, the system MUST redirect the user to `/dashboard`.
- **FR-005**: If an authenticated user visits `/login`, the system MUST redirect them to `/dashboard` (server-side check preferred).
- **FR-006**: The header component MUST replace the "Contact" `mailto:` link with a "Login" link pointing to `/login` when the user is unauthenticated.
- **FR-007**: All user-facing strings on the login page and the header login button MUST use next-intl translations for `en` and `es` locales.
- **FR-008**: The login page MUST support both light and dark themes via CSS variables.

### Key Entities

- **Session**: Existing Better Auth session entity — no schema changes needed.
- **User**: Existing Better Auth user entity — no schema changes needed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Unauthenticated users can complete Google sign-in from `/login` and land on `/dashboard` within a single OAuth round-trip.
- **SC-002**: The header "Contact" link is fully replaced by "Login" for unauthenticated users with no visual regression.
- **SC-003**: All login page text renders correctly in both `en` and `es` locales.
- **SC-004**: Authenticated users visiting `/login` are redirected to `/dashboard` without seeing the login form.
- **SC-005**: The login page passes visual review for both light and dark themes.

## Assumptions

- Better Auth's Google OAuth is already configured and functional (environment variables `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set).
- No new database tables or schema changes are required — Better Auth manages user/session storage.
- The existing `authClient.signIn.social()` API supports the Google provider as currently configured.
- The "Contact" button (`mailto:support@papayaclaw.com`) is no longer needed and can be fully removed from the header.
- Mobile-specific header layout (hamburger menu) is out of scope — only the existing desktop header is modified.
