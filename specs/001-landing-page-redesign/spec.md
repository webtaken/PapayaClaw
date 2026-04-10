# Feature Specification: Landing Page Redesign

**Feature Branch**: `001-landing-page-redesign`
**Created**: 2026-04-09
**Status**: Draft
**Input**: User description: "Redesign completely the landing page of PapayaClaw. Remove unused components like Configurator. Simple but impactful landing page."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First-time Visitor Understands the Product (Priority: P1)

A first-time visitor arrives at papayaclaw.com and immediately understands what PapayaClaw does, who it is for, and why they should care. The page communicates the core value proposition within the first viewport without requiring scrolling.

**Why this priority**: If visitors cannot understand the product in seconds, they bounce. This is the single most important outcome of the redesign.

**Independent Test**: Load the landing page and verify the hero section communicates PapayaClaw's value proposition (deploy AI agents via OpenClaw) with a clear primary CTA visible above the fold.

**Acceptance Scenarios**:

1. **Given** a new visitor lands on the homepage, **When** the page loads, **Then** the hero section displays a clear headline, supporting description, and a primary call-to-action button — all visible without scrolling on desktop viewports.
2. **Given** a visitor reads the hero content, **When** they scan the headline and description, **Then** they understand that PapayaClaw lets them deploy AI agents from a template marketplace without technical knowledge.

---

### User Story 2 - Visitor Learns How It Works (Priority: P2)

After the hero captures attention, the visitor scrolls to understand the deployment process. An enhanced "how it works" section explains a 4-step flow, each step accompanied by a realistic visual preview that shows what the actual product experience looks like.

**Why this priority**: Users need confidence in simplicity before converting. Showing realistic previews of the actual product reduces friction and builds trust.

**Independent Test**: Scroll past the hero section and verify the how-it-works section renders 4 sequential steps, each with a title, description, and visual preview component.

**Acceptance Scenarios**:

1. **Given** a visitor scrolls past the hero, **When** they reach the how-it-works section, **Then** they see 4 distinct steps:
   - Step 01: "Create Account" — with a visual preview of a login page (Google sign-in, no credit card required).
   - Step 02: "Choose Channel & AI Provider" — with a preview form showing Telegram API key input and Claude model selection.
   - Step 03: "Deploy" — with a preview card showing a deploying/provisioning loader state.
   - Step 04: "Start Hiring Agents" — with a preview of the agent template marketplace.
2. **Given** a visitor on a mobile device, **When** they view the how-it-works section, **Then** the steps stack vertically with previews below their descriptions, remaining readable and visually coherent.

---

### User Story 3 - Visitor Sees Pricing and Converts (Priority: P2)

The visitor scrolls to the pricing section, compares plans, and clicks a CTA to sign up or subscribe. The pricing section remains on the landing page as it is a key conversion element.

**Why this priority**: Pricing transparency directly influences conversion. Visitors need to see cost before committing.

**Independent Test**: Scroll to the pricing section and verify plan cards display with features, prices, and working CTA buttons.

**Acceptance Scenarios**:

1. **Given** a visitor scrolls to the pricing section, **When** the section loads, **Then** plan cards display tier names, prices, feature lists, and CTA buttons.
2. **Given** a visitor clicks a pricing CTA, **When** they are not authenticated, **Then** they are prompted to sign in before proceeding to checkout.

---

### User Story 4 - Visitor Browses on Mobile (Priority: P2)

The entire redesigned landing page renders correctly on mobile devices (320px to 768px width). All sections are fully responsive, readable, and interactive via touch.

**Why this priority**: Mobile traffic represents a significant share of web visitors. A broken mobile experience directly loses potential users.

**Independent Test**: Resize the browser to 375px width and scroll through all sections, verifying layout, readability, and CTA tap targets.

**Acceptance Scenarios**:

1. **Given** a visitor on a mobile device (375px width), **When** they load the landing page, **Then** all sections render without horizontal overflow, text is readable, and buttons are tappable (minimum 44x44px touch targets).
2. **Given** a visitor on a mobile device, **When** they navigate using the header, **Then** the navigation menu is accessible via a hamburger/mobile menu pattern.

---

### User Story 5 - Company Decision-Maker Discovers Enterprise Services (Priority: P3)

A company decision-maker (CTO, VP of Operations, etc.) visits PapayaClaw and scrolls past the individual product offering. They reach a visually distinct "Are you a company?" section that speaks directly to enterprise needs — deploying a team of AI agents, custom integrations, dedicated support. The section provides a clear CTA to get in touch.

**Why this priority**: Enterprise clients represent high-value conversions. A dedicated section signals that PapayaClaw serves companies, not just individuals.

**Independent Test**: Scroll to the enterprise section and verify it renders with a dark background, enterprise-focused headline, description, and a contact CTA.

**Acceptance Scenarios**:

1. **Given** a visitor scrolls past the Pricing section, **When** they reach the enterprise section, **Then** they see a visually distinct dark-background section with a bold headline (e.g., "Are you a company?"), a supporting description about enterprise agent deployment services, and at least one CTA button.
2. **Given** a company decision-maker clicks the enterprise CTA, **When** the action triggers, **Then** they are directed to a contact method (email, form, or booking link).

---

### Edge Cases

- What happens when the visitor has JavaScript disabled? Static HTML content MUST still display meaningful content (SSR).
- How does the page behave with slow network connections? The page MUST render meaningful content within the first server response (Server Components).
- What happens in dark mode? All sections MUST render correctly in both light and dark themes.

## Clarifications

### Session 2026-04-09

- Q: Should the Hero badge section ("AI Employees Platform" label) be retained? → A: No, remove the badge entirely.
- Q: Should the Hero title use the current heavy typographic styling (uppercase, text-stroke, drop-shadow)? → A: No, simplify the title to clean, minimal typography without decorative effects.
- Q: Where should the primary Hero CTA navigate now that Configurator is removed? → A: Scroll to the How It Works section (#how-it-works).
- Q: How should the How It Works layout be arranged? → A: Vertical step list on the left with the active step highlighted, large preview panel on the right showing the UI for the active step (donely.ai-style stepper pattern). On mobile, steps and preview stack vertically.
- Q: How should the How It Works section be structured? → A: 4 steps (not 3), each with a realistic visual preview:
  - Step 01: Create account (Google login only, no credit card) — preview of a login page.
  - Step 02: Choose channel + AI provider — preview form simulating Telegram API key + Claude model input (inspired by deploy-dialog).
  - Step 03: Deploy — hit deploy and agent is live in minutes — preview card showing loader/provisioning state (inspired by instance-detail).
  - Step 04: Start hiring agents — select ready-to-use templates & connect apps — preview of template marketplace (placeholder for future implementation).
- Q: Should there be an enterprise/company section? → A: Yes. Add an "Are you a company?" section with a dark, visually distinct background (inspired by donely.ai/enterprises). Offers enterprise services: helping companies deploy a team of agents. Includes a bold headline, supporting description, and CTA(s).
- Q: What should the Enterprise CTA link to? → A: Cal.com booking link (https://cal.com/saul-rojas-zijrrm/30min?overlayCalendar=true).
- Q: How should the Enterprise dark background behave in dark mode? → A: Use a differentiated surface (subtle gradient, texture, or lighter dark shade) in dark mode to maintain visual contrast with surrounding dark sections.
- Q: How should accessibility work for the How It Works interactive stepper? → A: Full ARIA tablist/tab/tabpanel pattern with keyboard navigation (Tab to enter, Arrow keys between steps, Enter/Space to activate). Preview content inside panels is decorative; the step navigation itself is fully interactive and accessible.
- Q: Should the Enterprise CTA have accessible labeling for screen readers? → A: Yes. Contextual aria-label (e.g., "Book a call for enterprise AI agent deployment") plus new-tab indicator (icon and/or screen reader announcement).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The landing page MUST render the following sections in order: Header, Hero, How It Works, Pricing, Enterprise, Footer.
- **FR-002**: The Configurator component MUST be removed from the landing page.
- **FR-003**: The Comparison component MUST be removed from the landing page.
- **FR-004**: The UseCases component MUST be removed from the landing page.
- **FR-005**: The Hero section MUST display a clean headline (no badge, no uppercase, no text-stroke or drop-shadow effects), a supporting description, and a primary call-to-action button above the fold. Typography MUST be simple and minimal.
- **FR-006**: The Hero primary CTA MUST scroll to the How It Works section (#how-it-works). The secondary CTA MUST scroll to the Pricing section (#pricing).
- **FR-014**: The Hero section MUST NOT include the badge element (previously "AI Employees Platform" label).
- **FR-007**: The How It Works section MUST present the deployment process in 4 steps, each with a title, description, and a realistic visual preview component:
  - Step 01 (Create Account): Preview of a login page with Google sign-in button and "no credit card required" messaging.
  - Step 02 (Choose Channel & AI Provider): Preview form simulating a Telegram API key input and Claude model selection, inspired by the deploy-dialog component.
  - Step 03 (Deploy): Preview card showing a deploying/provisioning loader state, inspired by the instance-detail provisioning view.
  - Step 04 (Start Hiring Agents): Preview of a template marketplace showing ready-to-use agent templates and app connections (placeholder design for future implementation).
- **FR-015**: The How It Works visual preview content (login page, deploy form, loader card, marketplace) MUST be static/decorative (not functional forms). The step navigation mechanism itself is interactive (see FR-018).
- **FR-016**: The How It Works section title MUST use clean, simple typography consistent with the Hero section redesign (no uppercase, no text-stroke, no drop-shadow effects).
- **FR-017**: The How It Works layout MUST use a two-column stepper pattern on desktop: a vertical step list on the left (icon, step number, title, short description per step) with the active step visually highlighted (e.g., border emphasis), and a large preview panel on the right displaying the UI preview for the active step. On mobile, steps and preview MUST stack vertically.
- **FR-018**: The How It Works section MUST support step interaction — clicking a step on the left updates the preview panel on the right to show the corresponding UI preview (client-side interactivity).
- **FR-022**: The How It Works stepper MUST use the ARIA tablist/tab/tabpanel pattern. Steps MUST be navigable via keyboard: Tab to enter the step list, Arrow keys to move between steps, Enter/Space to activate. Each step MUST have a visible focus indicator.
- **FR-023**: The How It Works preview panels MUST be marked as decorative for screen readers (aria-hidden on purely visual elements, meaningful alt text on informative images). Each panel MUST be associated with its step via aria-labelledby.
- **FR-019**: The Enterprise section MUST have a visually distinct dark background that contrasts with the rest of the page, inspired by the donely.ai/enterprises design. In dark mode, the section MUST use a differentiated surface treatment (subtle gradient, texture, or lighter dark shade) to maintain visual distinction from surrounding dark-themed sections.
- **FR-020**: The Enterprise section MUST display a bold headline (e.g., "Are you a company?"), a supporting description about enterprise agent deployment services (team of agents, custom integrations, dedicated support), and at least one CTA button.
- **FR-021**: The Enterprise section CTA MUST open the Cal.com booking link (https://cal.com/saul-rojas-zijrrm/30min?overlayCalendar=true) in a new tab. The CTA MUST include a contextual aria-label (e.g., "Book a call for enterprise AI agent deployment") and a visual/screen-reader indicator that the link opens in a new tab.
- **FR-008**: The Pricing section MUST display all current plan tiers with features, pricing, and checkout CTAs.
- **FR-009**: All user-facing text MUST use next-intl translations for both English and Spanish locales.
- **FR-010**: The page MUST support dark mode and light mode via the existing theme toggle.
- **FR-011**: The Header and Footer components MUST be retained with their current functionality (navigation, auth, language switcher, theme toggle).
- **FR-012**: The page MUST retain existing JSON-LD structured data for SEO (WebSite, Organization, SoftwareApplication, FAQPage schemas).
- **FR-013**: The redesigned page MUST follow the project's cyber-tropical design aesthetic (primary #ff5722, secondary #cddc39, Syne/DM Sans fonts).

### Key Entities

- **Landing Page**: The single-page marketing surface at `/[locale]/` that converts visitors to registered users.
- **Section**: A discrete visual block within the landing page (Hero, How It Works, Pricing, Enterprise).
- **Plan Tier**: A subscription option (Basic, Pro, Enterprise) displayed in the Pricing section.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The landing page loads and displays all above-the-fold content within 2 seconds on a standard broadband connection.
- **SC-002**: The total number of landing page sections changes from 6 (Hero, HowItWorks, Configurator, UseCases, Comparison, Pricing) to 4 (Hero, HowItWorks, Pricing, Enterprise).
- **SC-003**: The page renders correctly on viewports from 320px to 2560px wide without layout breakage or horizontal overflow.
- **SC-004**: All text content appears correctly in both English and Spanish locales.
- **SC-005**: The page passes Lighthouse accessibility audit with a score of 90 or above.
- **SC-006**: Both dark mode and light mode render all sections with correct contrast and readability.

## Assumptions

- The Header and Footer components are not part of this redesign scope — they are retained as-is.
- The Pricing component is retained as-is (no redesign of pricing cards in this feature).
- The How It Works component will be significantly enhanced: expanded from 3 steps to 4 steps, each with a realistic visual preview component. This is a full redesign of the section, not just visual refinements.
- The Hero section will be redesigned for stronger visual impact while keeping the same messaging intent.
- Removed components (Configurator, Comparison, UseCases) and their translation keys will be cleaned up as part of this feature.
- The JSON-LD structured data will be updated to remove references to removed sections (e.g., FAQ entries about the configurator) if any exist.
