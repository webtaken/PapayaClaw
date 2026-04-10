# Quickstart: Login Page

**Feature**: 002-login-page | **Date**: 2026-04-09

## Prerequisites

- Node.js installed, `npm install` completed
- Environment variables set: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DATABASE_URL`
- PostgreSQL running with Better Auth tables migrated

## Implementation Order

### Step 1: Add i18n translations

Add `LoginPage` namespace and `Header.login` key to both `messages/en.json` and `messages/es.json`.

### Step 2: Create login layout (server-side auth redirect)

Create `src/app/[locale]/login/layout.tsx`:
- Server component
- Check session via `auth.api.getSession({ headers: await headers() })`
- If session exists → `redirect("/dashboard")`
- Otherwise render children

### Step 3: Create login page (server component)

Create `src/app/[locale]/login/page.tsx`:
- Server component
- Renders `<LoginForm />` client component
- Sets request locale via `setRequestLocale()`

### Step 4: Create LoginForm client component

Create `src/components/login-form.tsx`:
- `"use client"` directive
- Uses shadcn `Card`, `Button` components
- Displays PapayaClaw logo (`/papayaclaw.png` via `next/image`)
- Displays title, subtitle from `useTranslations("LoginPage")`
- "Sign in with Google" button with `Google` icon from `src/components/icons/google.tsx`
- On click: `authClient.signIn.social({ provider: "google", callbackURL: "/dashboard" })`
- All colors via CSS variables (bg-card, text-foreground, bg-primary, etc.)
- Dark mode support automatic via CSS variables

### Step 5: Modify header component

Edit `src/components/header.tsx`:
- Replace `mailto:support@papayaclaw.com` link with `<Link href="/login">`
- Update translation key from `t("contact")` to `t("login")`
- Keep existing styling (rounded-full, primary background, uppercase)

### Step 6: Verify

1. `npm run dev` → visit `/login` while unauthenticated → see login page
2. Click "Sign in with Google" → complete OAuth → land on `/dashboard`
3. Visit `/login` while authenticated → auto-redirect to `/dashboard`
4. Check header shows "Login" when unauthenticated, "Sign Out" when authenticated
5. Toggle locale → verify Spanish translations
6. Toggle theme → verify dark mode
