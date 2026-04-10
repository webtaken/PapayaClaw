# Data Model: Landing Page Redesign

## Overview

This feature has **no database schema changes**. All changes are frontend-only (components, translations, page layout). No new tables, columns, or relationships.

## Entities Affected

### Translation Files (messages/*.json)

**Modified entities** — not database entities but structured data:

| Namespace | Action | Fields |
|-----------|--------|--------|
| `HowItWorks` | UPDATE | Replace 3-step keys with 4-step keys: `step01Title`, `step01Description`, `step02Title`, `step02Description`, `step03Title`, `step03Description`, `step04Title`, `step04Description`, `title`, `subtitle` |
| `Enterprise` | CREATE | `title`, `description`, `cta`, `ctaAriaLabel` |
| `Hero` | UPDATE | May simplify/update `titleLine1`, `titleLine2`, `description`, `descriptionHighlight` keys. Remove `badge` key. |
| `Configurator` | DELETE | Remove entire namespace |
| `Comparison` | DELETE | Remove entire namespace |
| `UseCases` | DELETE | Remove entire namespace |

### JSON-LD Structured Data (page.tsx)

**Modified inline data**:
- WebSite, Organization, SoftwareApplication schemas: retained as-is
- FAQPage: Review and remove any Q&A entries referencing removed sections (Configurator, Comparison, UseCases). Current FAQ entries are about PapayaClaw in general, plan contents, cancellation, and technical knowledge — likely all retained.

## Component Props Interfaces

### HowItWorksStepperProps (new)

```typescript
interface StepData {
  id: string;          // "step-01", "step-02", etc.
  number: string;      // "01", "02", etc.
  title: string;       // Translated step title
  description: string; // Translated step description
  icon: LucideIcon;    // Step icon component
}

interface HowItWorksStepperProps {
  steps: StepData[];
}
```

### EnterpriseProps

No props — the Enterprise component is a self-contained server component that fetches its own translations via `getTranslations("Enterprise")`.

### Preview Components

No props — all preview components are self-contained decorative components with hardcoded mock UI content. They may accept translation strings if any visible text needs localization.
