# Quickstart: Landing Page Redesign

## Prerequisites

- Node.js and npm installed
- Project dependencies installed (`npm install`)
- Environment variables configured (`.env` file — no new variables needed for this feature)

## Setup Steps

### 1. Add shadcn Tabs component

```bash
npx shadcn@latest add tabs
```

This installs the Tabs, TabsList, TabsTrigger, and TabsContent components to `src/components/ui/tabs.tsx`.

### 2. Start dev server

```bash
npm run dev
```

Opens at `http://localhost:3000`.

### 3. Verify changes

1. Navigate to `http://localhost:3000` (English) or `http://localhost:3000/es` (Spanish)
2. Verify Hero section: clean headline, no badge, no uppercase/text-stroke effects
3. Verify Hero CTAs: "Get Started" scrolls to How It Works section, "See Pricing" scrolls to Pricing
4. Verify How It Works: 4 steps in vertical list on left, preview panel on right. Click each step to see preview change.
5. Verify Pricing: retained as-is
6. Verify Enterprise: dark background section with "Are you a company?" headline and "Book a Call" CTA opening Cal.com in new tab
7. Toggle dark mode: all sections render correctly, Enterprise section maintains visual distinction
8. Resize to mobile (375px): all sections stack vertically, steps and previews stack

### 4. Verify removed components

Confirm these are no longer rendered:
- Configurator section
- Comparison section
- UseCases section

### 5. Verify accessibility

```bash
# Run Lighthouse audit in Chrome DevTools
# Target: Accessibility score >= 90
```

- Tab through the How It Works stepper: focus indicator visible, Arrow keys navigate between steps
- Enterprise CTA: screen reader announces "Book a call for enterprise AI agent deployment, opens in new tab"

## Files Changed Summary

| Action | File |
|--------|------|
| MODIFY | `src/app/[locale]/page.tsx` |
| MODIFY | `src/components/hero.tsx` |
| MODIFY | `src/components/hero-ctas.tsx` |
| REWRITE | `src/components/how-it-works.tsx` |
| CREATE | `src/components/how-it-works-stepper.tsx` |
| CREATE | `src/components/how-it-works-previews/preview-login.tsx` |
| CREATE | `src/components/how-it-works-previews/preview-configure.tsx` |
| CREATE | `src/components/how-it-works-previews/preview-deploy.tsx` |
| CREATE | `src/components/how-it-works-previews/preview-marketplace.tsx` |
| CREATE | `src/components/enterprise.tsx` |
| DELETE | `src/components/configurator.tsx` |
| DELETE | `src/components/comparison.tsx` |
| DELETE | `src/components/use-cases.tsx` |
| ADD | `src/components/ui/tabs.tsx` (via shadcn CLI) |
| MODIFY | `messages/en.json` |
| MODIFY | `messages/es.json` |
