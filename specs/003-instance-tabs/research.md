# Research: Instance Detail Tabbed Interface

**Feature**: 003-instance-tabs | **Date**: 2026-04-16

This phase resolved every open question in the plan's Technical Context. No `NEEDS CLARIFICATION` markers remain. The research items below capture the technology choices and integration patterns that drive Phase 1 design.

---

## 1. Tabs primitive selection

**Decision**: Use the existing shadcn `Tabs` components (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`) from `@/components/ui/tabs`. Render all five triggers in a single `TabsList` at the top of the shell; render one `TabsContent` per tab panel. Use `defaultValue="general"` and leave state uncontrolled unless the attention-indicator/pre-mount behavior forces otherwise.

**Rationale**:
- The component is already in the repo (`src/components/ui/tabs.tsx`), wraps `@radix-ui/react-tabs`, and provides accessibility (keyboard nav, proper `role="tablist"` / `role="tab"` / `role="tabpanel"`, ARIA relationships) out of the box — directly satisfies FR-013.
- Default (unforced) mounting behavior in Radix mounts the active panel and unmounts inactive panels. To preserve state on tab switch without a remount, we lift long-lived state (SWR subscriptions, local UI state for pairing & WhatsApp numbers) into the **shell** component, not the panels. This is cheaper than forcing all panels mounted (which would also burn render time on placeholders).
- The `variant="line"` option exists but the default `bg-muted` look matches the dense, panel-like aesthetic elsewhere in the dashboard better. Final variant chosen during implementation based on visual review with the `frontend-design` skill.

**Alternatives considered**:
- Custom button-based tab strip (like the existing in-card Telegram/WhatsApp toggle): rejected because it duplicates the shadcn primitive and loses accessibility-for-free.
- `forceMount` on every `TabsContent` to keep DOM alive: rejected — ejects the placeholders into the DOM for no benefit and bloats the initial render.

---

## 2. State hoisting strategy (preserving live state across tab switches)

**Decision**: Keep the SWR status poller (`useSWR('/api/instances/:id/status', ...)`) and the pairing-request / WhatsApp-number local state in the `InstanceDetail` shell. Tab panels are "dumb" consumers that receive props (data + handlers). The `TabsContent` for inactive tabs unmounts freely because no state lives there.

**Rationale**:
- Radix unmounts inactive `TabsContent` by default. If SWR hooks lived inside a panel, switching away would unmount the subscription and a revalidation would run on return — SC-007 (100 ms switch) would fail.
- Hoisting preserves a single source of truth and matches React 19 + React Compiler expectations (shared data, stable callbacks — the compiler auto-memoizes without manual `useCallback` sprawl, per `vercel-react-best-practices`).
- Handlers (`addWhatsAppNumber`, `removeWhatsAppNumber`, `approvePairing`, `fetchPairingRequests`, `onModelChanged`) stay defined in the shell and are passed down; callers are unaffected.
- The Channels-tab attention indicator (pending pairing count) is computed in the shell from its own state, so the `TabsTrigger` badge stays accurate even when the Channels tab has never been opened (FR-007, SC-006).

**Alternatives considered**:
- Route-level `Context` for shared state: rejected — overkill for a single client component tree; explicit props keep the data flow obvious.
- Moving SWR into a shared hook file: not rejected outright, but not needed — the hook is used in exactly one place. Revisit only if a second consumer appears.

---

## 3. Gating panel content on instance readiness

**Decision**: Keep the existing `isProvisioning` / `currentIp` / `cfTunnelHostname` gating logic, but apply it **inside the panel** rather than at the shell level. Every tab is always reachable (FR-011); tabs whose content is not ready render an empty-state explaining why.

Readiness matrix:

| Tab | Available when | Empty state when |
|-----|----------------|------------------|
| General | Always | N/A — General tab is the provisioning home: when `isProvisioning`, the boot-sequence UI is shown here; when ready, the telemetry+gateway UI is shown |
| Channels | `currentIp && !isProvisioning` | `currentIp` absent → "Channels become available once provisioning completes." |
| SSH | `currentIp && !isProvisioning` | `currentIp` absent → "SSH becomes available once provisioning completes." |
| Integrations | Always (static placeholder) | N/A |
| Agents | Always (static placeholder) | N/A |

**Rationale**:
- Prior behavior hid the Channels / SSH / Model-Provider modules entirely until `currentIp` existed. The spec requires every tab to remain accessible (FR-011), so the gating moves inside the panel and becomes a friendly message instead of a disappeared module.
- Keeping the provisioning boot-sequence inside the General tab matches the spec's description of General as "general information of the instance" and avoids a separate pseudo-state above the tab strip.

**Alternatives considered**:
- Disable `TabsTrigger` for Channels/SSH while provisioning: rejected — the user can still be curious and click. A disabled trigger + no content violates the principle that every tab tells you something.
- Split "provisioning" into its own top-level screen above the tabs: rejected — adds structural complexity for a transient state; General already has natural space for it.

---

## 4. Channel attention indicator on the `TabsTrigger`

**Decision**: Derive `pairingRequests.length` in the shell (already available) and pass it to a small `ChannelsTrigger` wrapper that renders a `Badge`/dot next to the "Channels" label when `> 0`. No new polling interval is introduced — the indicator piggybacks on the existing pairing-requests fetch lifecycle.

**Rationale**:
- SC-006 requires the indicator to appear within the same polling cycle that already updates live channel state. The existing `useEffect` inside the shell already re-fetches pairing requests when readiness flips; extending this to an indicator does not add new network traffic.
- Keeping the indicator logic in the shell (rather than in `channels-tab.tsx`) ensures the badge updates even when the Channels tab has never been opened (Radix would otherwise not mount `channels-tab.tsx`).

**Alternatives considered**:
- Background polling for channel events regardless of readiness: rejected — introduces network traffic the spec explicitly avoids (SC-006).
- Toast-only surfacing: rejected — toasts are transient; the indicator must persist until addressed.

---

## 5. Server-vs-client split

**Decision**: Leave `src/app/[locale]/dashboard/[id]/page.tsx` as a server component. The entire `InstanceDetail` tree (shell + all five panels) is `"use client"`. No new server components are added.

**Rationale**:
- `InstanceDetail` already requires client features (SWR, local state, event handlers, `dynamic(..., { ssr: false })` imports for the SSH terminal). Splitting panels into server components would be impossible without fragmenting the shared state.
- Constitution §I requires `"use client"` only where interactivity demands it. Every new tab panel either reads shell state (client) or runs interactive UI (client). Placeholder panels could technically be server components, but keeping them in the client tree avoids awkward `"use client"` boundaries inside `TabsContent`.

**Alternatives considered**:
- Dynamic-import each tab panel with `next/dynamic`: considered for the SSH panel's xterm import (already done) and potentially for the Channels panel. Decision: keep current `dynamic(..., { ssr: false })` for `ssh-terminal.tsx` only; don't add additional dynamic boundaries until a bundle-size measurement justifies it (per `vercel-react-best-practices`: don't pre-optimize without data).

---

## 6. React 19 + React Compiler considerations

**Decision**: Do not add manual `useCallback`, `useMemo`, or `React.memo` to the new panel components; rely on the React Compiler's automatic memoization. Keep the existing `useCallback`s in the shell (they were authored pre-compiler and removing them is out of scope).

**Rationale**:
- Per `vercel-react-best-practices`, the React Compiler produces better-than-hand-written memoization in Next.js 16 + React 19 when you write straightforward hooks/handlers. Sprinkling `useCallback` on every prop "just to be safe" fights the compiler.
- The existing `useCallback`s in `instance-detail.tsx` are harmless; touching them is scope creep.

**Alternatives considered**:
- Rewrite the shell to remove all manual memoization: rejected — scope creep, and the existing code works.
- Add `React.memo` to panel components: rejected — the compiler handles this; explicit memo here would be noise.

---

## 7. Dynamic import for the SSH tab

**Decision**: Move the existing `dynamic(() => import("./ssh-terminal").then(...), { ssr: false })` pattern into `ssh-tab.tsx`. Keep `ssr: false` (xterm relies on `window`).

**Rationale**:
- Matches current behavior. The terminal has a heavy xterm/WebSocket payload; deferring it keeps the initial bundle slim — aligned with `vercel-react-best-practices` guidance on code-splitting heavy client-only widgets.
- Also conveniently ensures the terminal only mounts when the SSH tab is actually opened (Radix unmounts inactive `TabsContent`), giving us natural deferred instantiation.

**Alternatives considered**:
- Static import: rejected — drags xterm into the initial bundle even for users who never open SSH.

---

## 8. Tab identifier strategy

**Decision**: Use stable string literal keys: `"general" | "channels" | "ssh" | "integrations" | "agents"`. Define a `type TabKey = ...` union and a `TABS: readonly TabKey[]` array in `instance-detail.tsx` to drive both the `TabsList` render and the tab-label translations.

**Rationale**:
- Typed union enables exhaustiveness checks (TypeScript will error if a new tab key is added without handling).
- Separating the key (stable, internal) from the display label (localized via `next-intl`) is standard practice — labels change per locale; keys never do.

**Alternatives considered**:
- Index-based tab keys (`"0"`, `"1"`, ...): rejected — fragile, makes reordering dangerous, worse logs.

---

## 9. i18n namespacing for new strings

**Decision**: Extend the existing `InstanceDetail` namespace in `messages/en.json` and `messages/es.json`. New keys grouped under `tabs` (for tab labels), `general`, `channels`, `ssh`, `integrations`, `agents`, and `provisioning` sub-objects.

**Rationale**:
- Keeps everything localized for this screen in one namespace (matches how `LoginPage`, `Dashboard`, `Hero`, etc. are organized).
- Nested sub-objects (`InstanceDetail.tabs.general`, `InstanceDetail.channels.telegramNotConfiguredHint`, etc.) keep the flat key space manageable and discoverable.
- Both locales must be updated before merge (Constitution §IV).

**Alternatives considered**:
- Create a new top-level namespace `InstanceTabs`: rejected — splits a single feature's strings across two namespaces.
- Hardcode English placeholder copy: hard-rejected — violates Constitution §IV (non-negotiable).

---

## 10. Design quality & skill invocations

**Decision**: During implementation, invoke the `frontend-design`, `interface-design`, `shadcn`, and `vercel-react-best-practices` skills at the following points:
- Before writing any new JSX: `frontend-design` + `interface-design` for layout and aesthetic choices within each tab (especially the Integrations/Agents placeholder cards, which need to look intentional rather than stubby).
- When composing the `TabsList` and `TabsTrigger` markup: `shadcn` skill for correct composition and variant choice.
- When reviewing the finished client tree: `vercel-react-best-practices` skill to double-check we have not added unnecessary memoization, unnecessary `'use client'` boundaries, or unnecessary polling.

**Rationale**:
- Required by Constitution §VII and explicitly reinforced by the user's input to `/speckit.plan`.
- The placeholder tabs (Integrations, Agents) are a known risk for "AI slop" — generic empty cards. `frontend-design` guides us to something distinctive and on-brand.

**Alternatives considered**: None — skill invocation is a constitutional requirement, not a design choice.

---

## Summary of resolved questions

| Question | Answer |
|----------|--------|
| Which tabs primitive? | Existing shadcn `Tabs` (Radix-backed) from `@/components/ui/tabs` |
| Where does shared state live? | Hoisted into `InstanceDetail` shell; panels are prop-driven |
| How do inactive tabs stay cheap? | Radix default unmount + state hoisted; no `forceMount` |
| How is provisioning modeled? | Per-tab inline empty states; General tab hosts the boot sequence |
| How does the attention indicator work? | Shell computes count; `TabsTrigger` renders badge; no new polling |
| Route stays server, tree stays client? | Yes — no change to the server route; client tree expands |
| Manual memoization for new code? | No — trust the React Compiler |
| Dynamic import for xterm? | Yes, inside `ssh-tab.tsx` (same as today) |
| Tab key type? | `TabKey` union literal: `"general" \| "channels" \| "ssh" \| "integrations" \| "agents"` |
| i18n home? | Extend `InstanceDetail` namespace in `en.json` and `es.json` |
| Design skills? | `frontend-design`, `interface-design`, `shadcn`, `vercel-react-best-practices` at the noted checkpoints |
