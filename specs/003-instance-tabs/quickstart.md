# Quickstart: Instance Detail Tabbed Interface

**Feature**: 003-instance-tabs | **Date**: 2026-04-16

A one-page guide for an implementer (or reviewer) to get oriented, run the change locally, and verify acceptance.

---

## 1. Prerequisites

- Node 20+, npm, a working local `.env` with database + Better Auth credentials.
- The branch is already checked out:
  ```text
  git rev-parse --abbrev-ref HEAD   # → 003-instance-tabs
  ```
- At least one running/deployed instance in your user's dashboard so the detail page has real data to render. (If you don't have one, use the dashboard's "Deploy" flow or pick an existing instance ID from the DB.)

## 2. Run locally

```text
npm install                     # first time only
npx drizzle-kit push             # if schema is out of sync (not required for this feature)
npm run dev                      # runs `tsx server.ts` — required, don't use `next dev`
```

Open `http://localhost:3000/{locale}/dashboard/{instanceId}` and confirm the page still renders before you begin editing.

## 3. Files touched by this feature

| File | Change |
|------|--------|
| `src/app/[locale]/dashboard/[id]/page.tsx` | Unchanged |
| `src/components/dashboard/instance-detail.tsx` | Rewritten — becomes the tabbed shell; keeps all shared state |
| `src/components/dashboard/tabs/general-tab.tsx` | NEW |
| `src/components/dashboard/tabs/channels-tab.tsx` | NEW (extracts existing Telegram/WhatsApp logic) |
| `src/components/dashboard/tabs/ssh-tab.tsx` | NEW |
| `src/components/dashboard/tabs/integrations-tab.tsx` | NEW (placeholder) |
| `src/components/dashboard/tabs/agents-tab.tsx` | NEW (placeholder) |
| `messages/en.json` | Extend `InstanceDetail` namespace |
| `messages/es.json` | Mirror Spanish copy for every new key |
| `src/components/dashboard/model-provider-module.tsx` | Unchanged (rendered inside GeneralTab) |
| `src/components/dashboard/ssh-terminal.tsx` | Unchanged (dynamically imported from SshTab) |
| `src/components/ui/tabs.tsx` | Unchanged |

No API files, no schema files, no auth files.

## 4. Implementation order (suggested)

1. **Scaffold tab panels** — create the five files under `src/components/dashboard/tabs/` with minimal "Hello {tab}" bodies so the shell compiles.
2. **Rewrite `InstanceDetail`** — leave shared state where it is; wrap the existing branches in `<Tabs>` / `<TabsContent>`; render the new panels.
3. **Move markup into panels** — cut the General UI, Channels UI, and SSH UI out of the shell and paste into their respective panel files, wiring via props as documented in `contracts/component-contracts.md`.
4. **Fill Integrations + Agents placeholders** — invoke the `frontend-design` skill; aim for a distinctive, intentional "coming soon" treatment, not an empty box.
5. **Add i18n keys** — extend `InstanceDetail` in both `en.json` and `es.json`. Every new string in JSX must resolve through `t(...)`.
6. **Attention indicator** — render a small badge on the Channels `TabsTrigger` when `pairingRequests.length > 0`.
7. **Polish** — invoke `interface-design` + `shadcn` skills on the final composition; `vercel-react-best-practices` to sanity-check no stray `useMemo`/`useCallback` or unnecessary `"use client"` boundaries were introduced.
8. **Lint + build** — `npm run lint && npm run build`.

## 5. Acceptance verification (manual, matching the spec)

For each, navigate with a logged-in user to a matching instance and observe:

| Check | Spec refs | Expected result |
|-------|-----------|-----------------|
| Five tabs visible in order | FR-001, SC-001 | General, Channels, SSH, Integrations, Agents |
| General is default on page load | FR-014 | General is active after full reload |
| Persistent header stays on every tab | FR-002 | Back link, instance name/ID/created, status badge always visible |
| Switching tabs never re-fetches pairing list | FR-012, SC-007 | Network tab shows no new `/api/instances/:id/pairing` call on tab switch |
| Gateway launch from General (ready state) | FR-003, User Story 2 | Opens new tab with `https://{tunnel}/?token=…` |
| Gateway pending state | User Story 2 AC2 | Launch action absent/disabled when `cfTunnelHostname` is null |
| Provisioning in General | FR-005, User Story 2 AC4 | Boot sequence visible in General when `isProvisioning` |
| Channels empty state when not ready | FR-011, User Story 3 AC5 | Channels tab shows "not ready" message |
| Pending-pairing indicator cross-tab | FR-007, SC-006 | Send a real Telegram pairing request; badge appears on Channels trigger while on any other tab |
| WhatsApp allowlist add/remove | User Story 3 AC2 | Add a number; it appears in the list; remove it; it disappears |
| SSH empty state when not ready | User Story 4 AC4 | SSH tab shows "not ready" message before provisioning completes |
| SSH connect/disconnect round-trip | User Story 4 AC1–2 | Click Connect → xterm mounts; Disconnect returns to idle |
| Integrations + Agents placeholders | FR-009, FR-010, User Story 5 | Both show coming-soon copy, no actionable controls |
| Keyboard nav | FR-013 | Tab to `TabsList`, arrow-right / arrow-left cycle triggers, Enter/Space activates |
| Narrow viewport | FR-015 | At ~640 px width, every tab label is reachable (wraps or scrolls; nothing hidden) |
| Locale parity | Constitution §IV | Visit `/es/...` and confirm every tab label, placeholder, and empty state renders Spanish copy |
| No regressions | SC-004 | Every button/link/input that worked before still works |

## 6. Design & code-quality self-checks (before PR)

- [ ] `frontend-design` invoked for layout polish and placeholder treatment
- [ ] `interface-design` invoked for overall IA (tab strip placement, header lockup)
- [ ] `shadcn` invoked to confirm Tabs composition is idiomatic
- [ ] `vercel-react-best-practices` invoked: no unnecessary `useMemo`/`useCallback`/`React.memo`, minimal `"use client"` boundaries, no new polling
- [ ] Zero `any`, zero `@ts-ignore` (Constitution §II)
- [ ] All new user-visible strings resolve through `useTranslations("InstanceDetail")` (Constitution §IV)
- [ ] Theme CSS variables only — no hardcoded hex in new JSX (Constitution §VII)
- [ ] Dark mode visually checked alongside light mode
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

## 7. Known gotchas

- **xterm / SSH session reconnect on tab switch**: Radix unmounts inactive `TabsContent`. When a user opens SSH, clicks away, and returns, the xterm/WebSocket session will reconnect. This matches the spec's Acceptance Scenario 3 of User Story 4 ("if it must disconnect, the behavior is clearly communicated") — either keep the current behavior and add a small tooltip/note, or (preferred) persist `isTerminalOpen` in the shell so re-entering the tab auto-reconnects without an extra click. Do not silently burn a user's active shell without any signal.
- **React Compiler**: The project has React Compiler enabled. Do not sprinkle `useMemo`/`useCallback` in new code; it fights the compiler (research §6).
- **`"use client"` contagion**: Only the panel components need the directive. Do not add `"use client"` to `page.tsx` or to `tabs.tsx` (which already has it).
- **Translations in both locales**: PRs that only update `en.json` will cause runtime `next-intl` fallback warnings in the `/es` route. Mirror every new key in `es.json`.

## 8. After the PR merges

- No data migration.
- No environment variable changes.
- Monitor dashboard sessions for any regressions in: pairing-request approval latency, WhatsApp allowlist write latency, SSH connection success rate.
