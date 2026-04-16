---
description: "Task list for feature 003-instance-tabs: split InstanceDetail into a tabbed interface"
---

# Tasks: Instance Detail Tabbed Interface

**Input**: Design documents from `/specs/003-instance-tabs/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/component-contracts.md](./contracts/component-contracts.md), [quickstart.md](./quickstart.md)

**Tests**: No test framework is configured for UI in this repo (see `plan.md` Technical Context). The spec does not request TDD. Manual acceptance verification is tracked in `quickstart.md` §5 and surfaced in Polish below.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: `[US1]..[US5]` maps to user stories in `spec.md`; Setup / Foundational / Polish carry no story label
- All paths are absolute where clarity matters; relative to repo root otherwise

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Minimal scaffolding before any code changes.

- [X] T001 Create the tabs panel directory `src/components/dashboard/tabs/` (empty) so subsequent phases have a target location.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cross-cutting infrastructure every user story depends on: i18n keys, shared types, and the tab configuration. Touching these first prevents `TabKey` / translation drift during later phases.

**⚠️ CRITICAL**: All user stories (US1–US5) consume the i18n keys and `TabKey` type. Do not start US1–US5 until this phase is complete.

- [X] T002 Extend the `InstanceDetail` namespace in `messages/en.json` with the full new-key tree (`tabs.*`, `general.*`, `channels.*`, `ssh.*`, `integrations.*`, `agents.*`, `provisioning.*`) per `data-model.md` §i18n keys. Do not remove or rename existing keys (`allowedNumbers`, `noNumbers`, `allowedNumbersInfo`).
- [X] T003 [P] Mirror every new key added in T002 with Spanish copy in `messages/es.json` — identical key shape, semantically equivalent translations. Constitution §IV requires locale parity before merge.
- [X] T004 In `src/components/dashboard/instance-detail.tsx`, add (near the top of the file) the `TabKey` union type (`"general" | "channels" | "ssh" | "integrations" | "agents"`) and a `readonly TABS` array containing `{ key, labelKey, icon }` entries per `data-model.md` §Tab configuration. Do not yet consume these — this task only introduces them so US1 can reference them.
- [X] T005 In `src/components/dashboard/instance-detail.tsx`, export the existing `InstanceData` interface (change the current local `interface InstanceData { ... }` to `export interface InstanceData { ... }`) so new panel files can import it from a single source of truth per `contracts/component-contracts.md` §1.

**Checkpoint**: i18n keys present in both locales; `TabKey`/`TABS`/`InstanceData` available for import — user stories may now begin.

---

## Phase 3: User Story 1 - Navigate instance details through organized tabs (Priority: P1) 🎯 MVP

**Goal**: The instance detail page renders five tabs (General, Channels, SSH, Integrations, Agents) with keyboard-accessible navigation and a default landing on General. All existing content remains reachable inside one or more tabs during this slice (no regressions — SC-004).

**Independent Test**: Open `/{locale}/dashboard/{instanceId}`. Confirm five tab triggers are visible in the listed order; the General tab is active on load; clicking each other tab swaps the content area; keyboard arrow keys and Enter/Space cycle + activate tabs. Existing controls (gateway launch, channels UI, SSH terminal) are still reachable somewhere (allowed to be collocated within the General tab as an intermediate step until US2–US4 relocate them).

### Implementation for User Story 1

- [X] T006 [P] [US1] Scaffold `src/components/dashboard/tabs/general-tab.tsx` as a `"use client"` stub that accepts `GeneralTabProps` per `contracts/component-contracts.md` §2 and renders a minimal placeholder (e.g., an empty div or a simple label using `t("tabs.general")`). Use named export `GeneralTab`. This stub becomes the target for US2 in Phase 4.
- [X] T007 [P] [US1] Scaffold `src/components/dashboard/tabs/channels-tab.tsx` as a `"use client"` stub that accepts `ChannelsTabProps` per `contracts/component-contracts.md` §3 and renders a placeholder. Named export `ChannelsTab`.
- [X] T008 [P] [US1] Scaffold `src/components/dashboard/tabs/ssh-tab.tsx` as a `"use client"` stub that accepts `SshTabProps` per `contracts/component-contracts.md` §4 and renders a placeholder. Named export `SshTab`.
- [X] T009 [P] [US1] Scaffold `src/components/dashboard/tabs/integrations-tab.tsx` as a `"use client"` component with named export `IntegrationsTab` that renders an interim placeholder (polished in US5).
- [X] T010 [P] [US1] Scaffold `src/components/dashboard/tabs/agents-tab.tsx` as a `"use client"` component with named export `AgentsTab` that renders an interim placeholder (polished in US5).
- [X] T011 [US1] Rewrite the return JSX of `InstanceDetail` in `src/components/dashboard/instance-detail.tsx` so the persistent header (back link, instance name, ID, createdAt, status badge) stays outside a new `<Tabs defaultValue="general">` container, and the body is a `<TabsList>` with five `<TabsTrigger value={key}>…</TabsTrigger>` entries built from the `TABS` array plus five `<TabsContent value={key}>` regions. During this task, render the **entire existing body** (telemetry databand, provisioning sequence, Gateway Console card, Channels module, `ModelProviderModule`, SSH Terminal module) inside the `TabsContent value="general"` region so nothing is lost. The other four `TabsContent` regions mount the stub panels from T006–T010 with the minimum props required by their prop contracts. Keep all existing state, SWR hooks, and handlers in place — only the JSX layout changes. (Satisfies FR-001, FR-002, FR-012, FR-014.)
- [X] T012 [US1] In `src/components/dashboard/instance-detail.tsx`, import Lucide icons referenced in `TABS` (`LayoutDashboard`, `Radio`, `Server`, `Plug`, `Bot`) and use `useTranslations("InstanceDetail")` for all tab labels via the `labelKey` (e.g., `t("tabs.general")`). No hardcoded English strings. (Satisfies Constitution §IV.)

**Checkpoint — US1 is independently demonstrable**: Five tabs visible, navigable, keyboard-accessible; General is default; reload keeps defaulting to General (FR-014); all prior functionality still reachable (currently collocated under General — acceptable per SC-004; US2–US4 will redistribute).

---

## Phase 4: User Story 2 - Review core instance details and open the gateway from the General tab (Priority: P1)

**Goal**: The General tab becomes the properly structured summary: telemetry databand + Gateway Console launcher + provisioning boot-sequence + AI model/provider module. MVP scope with US1 = tabs exist + General works fully.

**Independent Test**: On a running instance with gateway ready, open the General tab and verify telemetry (IP, Model, Channels summary, Gateway hostname) is shown, the Launch Interface action opens the gateway URL in a new browser tab with the instance's access token applied. Switch the model via `ModelProviderModule` and confirm state survives a tab switch. On a provisioning instance, verify the boot-sequence UI replaces the telemetry.

### Implementation for User Story 2

- [X] T013 [US2] Implement `GeneralTab` in `src/components/dashboard/tabs/general-tab.tsx` per `contracts/component-contracts.md` §2: render the telemetry databand (IP, Model, Channels summary, Gateway hostname) when `!isProvisioning`; render the provisioning boot-sequence markup when `isProvisioning` is true (move the existing `provisioningSteps` + `getActiveStep` logic here, or accept `hetznerStatus` and derive internally). Render the Gateway Console card with the Launch Interface button that links to `https://${instance.cfTunnelHostname}/?token=${encodeURIComponent(instance.botToken)}` with `target="_blank"` and `rel="noopener noreferrer"` (only when `cfTunnelHostname` is truthy; otherwise show the translated pending state using `t("general.gatewayPending")`). Render `<ModelProviderModule instanceId={instance.id} currentModel={instance.model} onModelChanged={onModelChanged} />` when `currentIp` is truthy. All copy goes through `useTranslations("InstanceDetail")`. Use Lucide icons and CSS-variable theming only.
- [X] T014 [US2] In `src/components/dashboard/instance-detail.tsx`, remove the telemetry databand JSX, the provisioning boot-sequence JSX, the Gateway Console card JSX, and the `ModelProviderModule` mount from the `TabsContent value="general"` region; replace them with a single `<GeneralTab instance={instance} currentIp={currentIp} currentStatus={currentStatus} isProvisioning={!!isProvisioning} effectiveStatus={effectiveStatus} channels={channels} hetznerStatus={statusData?.hetznerStatus ?? null} onModelChanged={(newModel) => setInstance((prev) => ({ ...prev, model: newModel }))} />`. Delete now-unused constants in the shell (`provisioningSteps`, `getActiveStep`) if they are no longer referenced after moving the logic; keep `statusConfig` since the header badge still uses it.
- [X] T015 [US2] Invoke the `frontend-design` skill on the General tab layout: confirm the telemetry databand grid, the Gateway Console card, and the provisioning sequence each feel intentional under the cyber-tropical palette; adjust spacing/typography as needed. No hardcoded colors introduced. (Satisfies Constitution §VII and user input to `/speckit.plan`.)

**Checkpoint — US2 is independently demonstrable**: General tab fully structured per spec; all existing General-section behavior preserved (launch gateway, change model, see provisioning progress). Other tabs may still contain duplicated content from T011 (to be removed in US3/US4); this is acceptable intermediate state.

---

## Phase 5: User Story 3 - Manage connected messaging channels from the Channels tab (Priority: P2)

**Goal**: The Channels tab hosts the full Telegram + WhatsApp management experience, including the cross-tab attention indicator on the trigger when pairing requests are pending.

**Independent Test**: From an instance with Telegram configured, open the Channels tab, observe pending pairing requests and approve one. Switch to WhatsApp sub-view and add/remove an allowed number. From an instance with no channels configured, see the add-channel instructions. Send a new pairing request while on any other tab and verify the Channels trigger shows a pending-count badge.

### Implementation for User Story 3

- [X] T016 [US3] Implement `ChannelsTab` in `src/components/dashboard/tabs/channels-tab.tsx` per `contracts/component-contracts.md` §3: render the "not ready" empty state using `t("channels.notReady")` when `!currentIp || isProvisioning`; otherwise render the existing two-view (Telegram / WhatsApp) module driven by the `activeChannelTab` prop and `setActiveChannelTab` setter. Move the entire Telegram sub-view markup (including pairing-requests list, Approve buttons, Refresh button, security warning, add-channel instructions) and the entire WhatsApp sub-view markup (including allowlist display, add-number form with `/^\+\d+$/` validation, remove buttons, link-device instructions) from `instance-detail.tsx` into this file. Consume data exclusively via props — no SWR calls, no fetchers — per `research.md` §2. Every user-visible string must resolve through `t(...)`; move any still-inline English copy into the i18n tree added in T002/T003.
- [X] T017 [US3] In `src/components/dashboard/instance-detail.tsx`, remove the Channels module JSX from the `TabsContent value="general"` region added in T011 and replace the `TabsContent value="channels"` stub with `<ChannelsTab instanceId={instance.id} currentIp={currentIp} isProvisioning={!!isProvisioning} channelSet={channelSet} activeChannelTab={activeChannelTab} setActiveChannelTab={setActiveChannelTab} pairingRequests={pairingRequests} isPairingLoading={isPairingLoading} pairingError={pairingError} approvingCode={approvingCode} onRefreshPairing={fetchPairingRequests} onApprovePairing={approvePairing} whatsappNumbers={statusData?.whatsappNumbers ?? []} newPhone={newPhone} setNewPhone={setNewPhone} isAddingPhone={isAddingPhone} removingPhone={removingPhone} onAddWhatsAppNumber={addWhatsAppNumber} onRemoveWhatsAppNumber={removeWhatsAppNumber} />`. Keep all state, handlers, and SWR hooks in the shell unchanged.
- [X] T018 [US3] In `src/components/dashboard/instance-detail.tsx`, inside the rendered `TabsList`, render a `Badge` (amber, matching the existing pending-requests treatment) beside the Channels `TabsTrigger`'s label when `pairingRequests.length > 0`; include the count and pass the translated `channelsAttentionAria` plural key as the badge's `aria-label`. Do not introduce any new polling (research §4). (Satisfies FR-007, SC-006.)
- [X] T019 [US3] Invoke the `interface-design` + `shadcn` skills on the Channels tab layout: confirm the top-level tab strip and the nested Telegram/WhatsApp sub-strip are visually distinct enough that users do not confuse them; adjust if needed (e.g., swap inline button-strip for nested `Tabs variant="line"`).

**Checkpoint — US3 is independently demonstrable**: Channels tab fully replaces the old inline module; attention badge appears cross-tab; every pairing/allowlist control still works; provisioning-unready instances show the translated empty state.

---

## Phase 6: User Story 4 - Access the SSH root terminal from a dedicated SSH tab (Priority: P2)

**Goal**: The SSH tab contains the full Root Terminal experience — idle connect card, active xterm session, disconnect control — and degrades to a translated empty state until the server is reachable.

**Independent Test**: On a running instance, open SSH tab, click Connect, confirm xterm mounts and is interactive, click Disconnect, confirm return to idle. On a provisioning instance, see the translated "SSH becomes available once provisioning completes" message.

### Implementation for User Story 4

- [X] T020 [US4] Implement `SshTab` in `src/components/dashboard/tabs/ssh-tab.tsx` per `contracts/component-contracts.md` §4: at the top of the file, declare `const SshTerminal = dynamic(() => import("../ssh-terminal").then((m) => m.SshTerminal), { ssr: false });` (research §7). Render the translated "not ready" empty state when `!currentIp || isProvisioning`. Otherwise render the Root Terminal card: idle state with Connect button (calls `setIsTerminalOpen(true)`) when `!isTerminalOpen`, and the `<SshTerminal instanceId={instanceId} />` session plus a Disconnect control (calls `setIsTerminalOpen(false)`) when `isTerminalOpen`. All copy through `t(...)` using the `ssh.*` keys.
- [X] T021 [US4] In `src/components/dashboard/instance-detail.tsx`, remove the SSH Terminal module JSX from the `TabsContent value="general"` region (inserted during T011) and replace the `TabsContent value="ssh"` stub with `<SshTab instanceId={instance.id} currentIp={currentIp} isProvisioning={!!isProvisioning} isTerminalOpen={isTerminalOpen} setIsTerminalOpen={setIsTerminalOpen} />`. Delete the now-unused top-level `const SshTerminal = dynamic(...)` in `instance-detail.tsx` (the dynamic import now lives exclusively in `ssh-tab.tsx`).

**Checkpoint — US4 is independently demonstrable**: SSH tab hosts the full terminal experience; bundle weight is unchanged for users who never open SSH; empty state appears until readiness.

---

## Phase 7: User Story 5 - See explicit "coming soon" messaging for Integrations and Agents (Priority: P3)

**Goal**: Both Integrations and Agents tabs show polished, intentional "not yet available" messaging aligned with the cyber-tropical design language — not generic empty cards.

**Independent Test**: Open Integrations and Agents tabs and confirm each renders a self-explanatory informational message naming the section, summarizing its future purpose, and clearly indicating it is not yet available; no interactive controls imply the feature can be used now.

### Implementation for User Story 5

- [X] T022 [P] [US5] Finalize `src/components/dashboard/tabs/integrations-tab.tsx`: render a polished placeholder card using `useTranslations("InstanceDetail")` keys `integrations.title`, `integrations.comingSoon`, `integrations.description`. Use a `Plug` Lucide icon inside a decorative tile, a subtle "coming soon" badge (non-interactive), and translated body copy. No buttons. Styling via theme CSS variables only. (Satisfies FR-009.)
- [X] T023 [P] [US5] Finalize `src/components/dashboard/tabs/agents-tab.tsx`: same pattern as T022 but using `agents.*` translation keys and a `Bot` Lucide icon. (Satisfies FR-010.)
- [X] T024 [US5] Invoke the `frontend-design` skill on both placeholder tabs to avoid generic/AI-slop aesthetics (required by Constitution §VII and explicitly reinforced in the `/speckit.plan` user input). Adjust composition as needed so the two placeholder tabs feel as intentional as the functional tabs.

**Checkpoint — US5 is independently demonstrable**: Integrations and Agents tabs display localized, well-composed "not yet available" messaging; no misleading interactive controls.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final quality gates, manual acceptance run, and code-quality self-checks across all stories.

- [X] T025 [P] In `src/components/dashboard/instance-detail.tsx`, remove any now-dead imports (e.g., components, icons, helpers, `dynamic` for SshTerminal) that were relocated into panel files during US2–US4. Run ESLint to catch any missed unused imports (`npm run lint`).
- [X] T026 [P] Invoke the `vercel-react-best-practices` skill on the final client tree: confirm no manual `useMemo`/`useCallback`/`React.memo` was added in the new panel files (let the React Compiler handle memoization — research §6), confirm no new `"use client"` boundaries outside the panel files, and confirm no new polling intervals were introduced (SC-006).
- [X] T027 Run `npm run lint` and resolve any errors. All new files must conform to the project's ESLint config (`next/core-web-vitals`, `typescript`).
- [X] T028 Run `npm run build` and resolve any errors. Build must succeed before merge.
- [X] T029 Execute the manual acceptance checklist in `quickstart.md` §5 end-to-end on a running instance: five-tab visibility and order, default tab on reload, persistent header, no refetch on tab switch, gateway launch, gateway pending state, provisioning in General, Channels empty state, cross-tab pending-pairing badge, WhatsApp add/remove, SSH empty state, SSH connect/disconnect, placeholders, keyboard nav, narrow viewport (≈640 px), locale parity between `/en/` and `/es/`, no regressions.
- [X] T030 [P] Verify dark mode parity: toggle dark mode and re-scan every tab's content for hardcoded colors; confirm all new markup uses theme CSS variables only (Constitution §VII).
- [X] T031 [P] Verify Spanish locale parity: open `/es/dashboard/{instanceId}` and confirm every tab label, every placeholder, and every empty state renders Spanish copy — no `InstanceDetail.tabs.xxx` fallback strings visible.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. Starts immediately.
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS all user stories.
- **US1 (Phase 3)**: Depends on Foundational. Unblocks US2–US5 because it creates the panel stubs and shell.
- **US2 (Phase 4)**: Depends on US1 (the `<GeneralTab />` stub must exist; the shell must mount it).
- **US3 (Phase 5)**: Depends on US1 (same reason, plus the in-shell state the prop contract expects).
- **US4 (Phase 6)**: Depends on US1.
- **US5 (Phase 7)**: Depends on US1.
- **Polish (Phase 8)**: Depends on whichever user stories you chose to ship.

### Within-story edge dependencies

- **US2, US3, US4** each touch `src/components/dashboard/instance-detail.tsx` (to remove the temporarily-collocated inline content and wire the new panel). These edits are in different regions of the same file and must therefore be serialized — no `[P]` across them. Panel-file creation tasks (T013, T016, T020) can still run in parallel with one another.
- **US1's panel scaffolding** (T006–T010) is fully parallel ([P]) because each task creates a distinct file.
- **T022 and T023** are parallel because they create distinct files.
- **T025, T026** are parallel across files; **T027, T028** are linting/build and run sequentially against the repo.
- **T030, T031** are parallel (different verification surfaces).

### Parallel Opportunities

- T003 runs in parallel with T002 only in terms of human effort — actual edits are to different files (`es.json` vs `en.json`), but the key *shape* must match T002's additions. Sequence T002 → T003 if an implementer is solo.
- T006 / T007 / T008 / T009 / T010 → all parallel (distinct new files).
- T015 / T019 / T024 / T026 (skill invocations) can be batched together at review time if preferred.

---

## Parallel Example: Phase 3 (User Story 1)

```bash
# After Foundational is done, scaffold all five panel stubs in parallel:
Task: "Scaffold GeneralTab stub in src/components/dashboard/tabs/general-tab.tsx (T006)"
Task: "Scaffold ChannelsTab stub in src/components/dashboard/tabs/channels-tab.tsx (T007)"
Task: "Scaffold SshTab stub in src/components/dashboard/tabs/ssh-tab.tsx (T008)"
Task: "Scaffold IntegrationsTab stub in src/components/dashboard/tabs/integrations-tab.tsx (T009)"
Task: "Scaffold AgentsTab stub in src/components/dashboard/tabs/agents-tab.tsx (T010)"

# Then wire the shell (T011) — not parallel, edits instance-detail.tsx:
Task: "Rewrite InstanceDetail body with Tabs + five TabsContent regions (T011)"
Task: "Translate tab labels via useTranslations (T012)"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

Both P1 user stories together deliver the minimum useful increment:

1. Phase 1 Setup (T001).
2. Phase 2 Foundational (T002–T005).
3. Phase 3 US1 (T006–T012) — tab shell ships.
4. Phase 4 US2 (T013–T015) — General tab fully structured.
5. **STOP / VALIDATE**: run US1 + US2 acceptance tests; the gateway-launch path is the key CTA and must be polished.
6. Deploy/demo if desired — users already gain navigability + a polished General tab.

### Incremental Delivery

1. Setup + Foundational + US1 → tabs visible, nothing regresses.
2. + US2 → polished General tab (MVP).
3. + US3 → Channels tab isolated, attention indicator live.
4. + US4 → SSH tab isolated.
5. + US5 → placeholders polished.
6. Polish → lint/build/QA gates.

### Parallel Team Strategy

With multiple developers after Foundational completes:

- Developer A: US1 (T006–T012) — owns the shell.
- Developer B starts once T006 (GeneralTab stub) lands: US2 (T013–T015).
- Developer C starts once T007 (ChannelsTab stub) lands: US3 (T016–T019).
- Developer D starts once T008 (SshTab stub) lands: US4 (T020–T021).
- Developer E starts once T009/T010 (placeholder stubs) land: US5 (T022–T024).
- **Serialize edits to `instance-detail.tsx`** — US2, US3, US4 each modify it; merge sequentially.

---

## Notes

- `[P]` tasks = different files, no dependencies.
- `[Story]` label maps task to a specific user story for traceability.
- Each user story remains independently completable: US2 works even if US3/US4/US5 are not done (the old content is still rendered under General from T011 until each story removes it).
- Intermediate state after US1 / US2 intentionally keeps content duplicated in General — this preserves SC-004 (no functionality lost) while US3/US4 are in progress.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently.
- Avoid: vague tasks, same-file conflicts (US2/US3/US4 shell edits are serialized on purpose), cross-story dependencies that break independence.
