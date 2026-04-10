# Research: Landing Page Redesign

## R1: shadcn Tabs for ARIA tablist stepper

**Decision**: Use shadcn/ui Tabs component (`npx shadcn@latest add tabs`)

**Rationale**: shadcn Tabs is built on Radix UI Tabs, which provides full ARIA tablist/tab/tabpanel semantics out of the box — keyboard navigation (Arrow keys, Tab, Enter/Space), focus management, and proper role attributes. This satisfies FR-022 without custom ARIA implementation.

**Alternatives considered**:
- Custom ARIA tablist from scratch: More control but significantly more code and testing for accessibility compliance. Rejected — shadcn/Radix provides this for free.
- Accordion pattern: Would stack content vertically but doesn't match the side-by-side stepper layout from the reference design. Rejected.

**Usage pattern**:
```tsx
<Tabs defaultValue="step-01" orientation="vertical">
  <TabsList className="flex flex-col"> {/* Left column */}
    <TabsTrigger value="step-01">...</TabsTrigger>
    <TabsTrigger value="step-02">...</TabsTrigger>
  </TabsList>
  <TabsContent value="step-01"> {/* Right column */}
    <PreviewLogin />
  </TabsContent>
</Tabs>
```

Note: Radix Tabs supports `orientation="vertical"` which changes Arrow key navigation to Up/Down instead of Left/Right — correct for the vertical step list layout.

## R2: Enterprise section dark background strategy

**Decision**: Use Tailwind's built-in dark surface utilities with a custom approach for theme differentiation.

**Rationale**: The Enterprise section must be dark in both light and dark modes. In light mode, `bg-zinc-950` provides strong contrast against the light page background. In dark mode, the surrounding page uses `--background: #0f1014` which is very close to zinc-950 (`#09090b`), so the Enterprise section needs differentiation.

**Approach**:
- Light mode: `bg-zinc-950 text-zinc-50` — strong dark contrast
- Dark mode: `bg-zinc-800/50` or a subtle gradient (`bg-gradient-to-br from-zinc-800/60 to-zinc-900/80`) to create a "lifted" surface effect distinct from the page background

**Alternatives considered**:
- Single `bg-zinc-950` for both modes: Would blend into dark mode background. Rejected.
- Accent-colored background in dark mode: Would break the "enterprise = serious/dark" visual intent. Rejected.
- CSS custom property for enterprise bg: Could work but adds complexity for a single section. Rejected for simplicity.

## R3: i18n strategy for new sections

**Decision**: Add translation keys under new top-level namespaces: `"HowItWorks"` (update existing), `"Enterprise"` (new).

**Rationale**: Consistent with existing pattern — each component has its own namespace (`"Hero"`, `"Pricing"`, etc.). Server components use `getTranslations("Enterprise")`.

**Keys to add**:
- `Enterprise.title`, `Enterprise.description`, `Enterprise.cta`, `Enterprise.ctaAriaLabel`
- `HowItWorks.step01Title`, `HowItWorks.step01Description`, `HowItWorks.step02Title`, etc. (update existing step keys to accommodate 4 steps)

**Keys to remove**:
- `Configurator.*` (entire namespace)
- `Comparison.*` (entire namespace)
- `UseCases.*` (entire namespace)

## R4: Scroll behavior for Hero CTAs

**Decision**: Use native `element.scrollIntoView({ behavior: 'smooth', block: 'start' })` with an offset for the fixed header.

**Rationale**: CSS `scroll-behavior: smooth` doesn't account for fixed header offset. Using `scrollIntoView` with `scroll-margin-top` on target sections is the cleanest approach — set `scroll-margin-top: 80px` (header height) on `#how-it-works` and `#pricing` sections.

**Alternatives considered**:
- `window.scrollTo` with manual offset calculation: More brittle, requires knowing header height. Rejected.
- CSS `scroll-padding-top` on `html`: Global solution but affects all anchor scrolling. Acceptable alternative but per-section `scroll-margin-top` is more targeted.

## R5: Preview components — static vs. interactive

**Decision**: All preview components are purely presentational React components with no state, no event handlers, and `aria-hidden="true"` on the container.

**Rationale**: FR-015 specifies previews must be static/decorative. The interactivity is in the tab navigation (switching which preview is shown), not in the preview content itself. Marking containers as `aria-hidden` prevents screen readers from reading mock form labels and fake input values.

**Implementation**: Each preview component renders shadcn Card with mock UI elements (buttons, inputs) that have `tabIndex={-1}` and `pointer-events-none` to prevent accidental interaction.
