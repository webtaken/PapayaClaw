# Component Contracts: Instance Detail Tabbed Interface

**Feature**: 003-instance-tabs | **Date**: 2026-04-16

This project has no public API being added, so the "interface contracts" here are **component-level contracts** for the React client tree being introduced. Each entry specifies the props surface of a new component, how it is consumed, and the behavioral guarantees implementers must preserve so the spec's functional requirements hold.

No backend endpoints are added or modified. See `data-model.md` for the existing endpoints these components consume.

---

## 1. `InstanceDetail` (rewritten shell)

**File**: `src/components/dashboard/instance-detail.tsx`
**Directive**: `"use client"`
**Role**: Top-level client shell. Owns all shared state and renders the persistent page header plus the five-tab Radix/shadcn `Tabs` shell.

### Props

```ts
interface InstanceData {
  id: string;
  name: string;
  model: string;
  channel: string;
  botToken: string;
  status: string;
  providerServerIp: string | null;
  cfTunnelHostname: string | null;
  createdAt: string | Date;
}

export function InstanceDetail(props: {
  initialInstance: InstanceData;
}): JSX.Element;
```

### Behavioral contract

- MUST render the persistent header (back link, instance name, ID, createdAt, status badge) **outside** the `<Tabs>` container (FR-002).
- MUST render exactly 5 `TabsTrigger` elements in the order: General, Channels, SSH, Integrations, Agents (FR-001).
- MUST set the tabs' `defaultValue` to `"general"` on every mount (FR-014).
- MUST own all long-lived state (SWR, pairing requests, WhatsApp UI state, `activeChannelTab`, `isTerminalOpen`, `instance`) and pass derived data + handlers to panels as props (research §2).
- MUST compute `pendingPairingCount` and pass it (or a boolean) into the Channels `TabsTrigger` so the attention indicator is visible regardless of active tab (FR-007).
- MUST NOT introduce new network polling or increase the SWR refresh frequency (SC-006).
- MUST route all user-facing text through `useTranslations("InstanceDetail")` (Constitution §IV).

### Exported type

`InstanceData` remains exported (or is redeclared in a `types.ts`) so that the server `page.tsx` can continue constructing it from the Drizzle row.

---

## 2. `GeneralTab`

**File**: `src/components/dashboard/tabs/general-tab.tsx`
**Directive**: `"use client"`

### Props

```ts
export interface GeneralTabProps {
  instance: InstanceData;                 // from shell
  currentIp: string | null;               // derived in shell
  currentStatus: string;                  // derived in shell
  isProvisioning: boolean;                // derived in shell
  effectiveStatus: string;                // derived in shell
  channels: string[];                     // derived in shell
  hetznerStatus: string | null;           // from statusData
  onModelChanged: (newModel: string) => void;
}

export function GeneralTab(props: GeneralTabProps): JSX.Element;
```

### Behavioral contract

- MUST display the telemetry databand (IP, Model, Channels summary, Gateway hostname) when NOT provisioning (FR-003).
- MUST display the Gateway Console card with a visible, labeled "Launch Interface" action that opens `https://${cfTunnelHostname}/?token=${encodeURIComponent(botToken)}` in a new tab (`target="_blank"`, `rel="noopener noreferrer"`) when `cfTunnelHostname` is present (FR-003, SC-002).
- MUST display a pending/empty state for the gateway section when `cfTunnelHostname` is null (spec Acceptance 2).
- MUST display the provisioning boot-sequence UI when `isProvisioning` is true, replacing the telemetry+gateway UI (FR-005).
- MUST render `<ModelProviderModule instanceId={...} currentModel={...} onModelChanged={...} />` when `currentIp` is present (FR-004).
- MUST use Lucide icons only (Constitution §III).
- MUST use theme CSS variables for colors; no hardcoded hex in new markup (Constitution §VII).

---

## 3. `ChannelsTab`

**File**: `src/components/dashboard/tabs/channels-tab.tsx`
**Directive**: `"use client"`

### Props

```ts
export interface ChannelsTabProps {
  instanceId: string;
  currentIp: string | null;
  isProvisioning: boolean;
  channelSet: Set<string>;
  activeChannelTab: "telegram" | "whatsapp";
  setActiveChannelTab: (c: "telegram" | "whatsapp") => void;

  // Telegram
  pairingRequests: PairingRequest[];
  isPairingLoading: boolean;
  pairingError: string | null;
  approvingCode: string | null;
  onRefreshPairing: () => void;
  onApprovePairing: (code: string) => void;

  // WhatsApp
  whatsappNumbers: string[];
  newPhone: string;
  setNewPhone: (v: string) => void;
  isAddingPhone: boolean;
  removingPhone: string | null;
  onAddWhatsAppNumber: (phone: string) => void;
  onRemoveWhatsAppNumber: (phone: string) => void;
}
```

### Behavioral contract

- When `!currentIp || isProvisioning`: MUST render a single empty state (translated) explaining that channel management becomes available once provisioning completes (FR-011, spec Acceptance 5).
- Otherwise: MUST render the two channel sub-views (Telegram, WhatsApp) using the `activeChannelTab` prop and its setter. Sub-tab visual can remain as the current inline button-strip or be migrated to nested shadcn tabs — decision is visual-only and made in implementation with the `shadcn` skill (research §1).
- The Telegram sub-view MUST expose:
  - A refresh control (calls `onRefreshPairing`).
  - The list of pending requests, each with an approve button (calls `onApprovePairing(code)`).
  - A security warning and an "add Telegram" instruction block when `!channelSet.has("telegram")`.
- The WhatsApp sub-view MUST expose:
  - The allowlist display.
  - An input form to add a number (validated against `/^\+\d+$/`), calling `onAddWhatsAppNumber` on submit.
  - A remove button per existing number (calls `onRemoveWhatsAppNumber`).
  - An "add WhatsApp" instruction block when `!channelSet.has("whatsapp")`.
- MUST NOT own SWR subscriptions or fetchers — all data arrives via props (research §2).

---

## 4. `SshTab`

**File**: `src/components/dashboard/tabs/ssh-tab.tsx`
**Directive**: `"use client"`

### Props

```ts
export interface SshTabProps {
  instanceId: string;
  currentIp: string | null;
  isProvisioning: boolean;
  isTerminalOpen: boolean;
  setIsTerminalOpen: (v: boolean) => void;
}
```

### Behavioral contract

- When `!currentIp || isProvisioning`: MUST render an empty state explaining SSH becomes available once provisioning completes (FR-011, spec Acceptance 4 of User Story 4).
- Otherwise: MUST render the idle "Connect" state when `!isTerminalOpen` and the mounted `<SshTerminal />` when `isTerminalOpen`.
- MUST import `SshTerminal` via `dynamic(() => import("../ssh-terminal").then(m => m.SshTerminal), { ssr: false })` to defer the xterm/WebSocket bundle (research §7).
- MUST provide a visible Disconnect control when the terminal is open.
- The disconnect action MUST set `isTerminalOpen` to `false` via `setIsTerminalOpen`.

---

## 5. `IntegrationsTab`

**File**: `src/components/dashboard/tabs/integrations-tab.tsx`
**Directive**: `"use client"` (simpler to keep inside the client tree)

### Props

```ts
export function IntegrationsTab(): JSX.Element;
```

### Behavioral contract

- MUST render a self-explanatory placeholder using translated copy from `InstanceDetail.integrations.*` (FR-009, spec Acceptance 1 of User Story 5).
- MUST include a visible "Not yet available" / "Coming soon" treatment (translated).
- MUST NOT include any interactive control (no buttons that look actionable) besides passive, visually-clear disabled-looking placeholders (FR-009, Acceptance 3 of User Story 5).
- Design MUST feel intentional, not generic — invoke `frontend-design` skill during implementation.

---

## 6. `AgentsTab`

**File**: `src/components/dashboard/tabs/agents-tab.tsx`
**Directive**: `"use client"`

### Props

```ts
export function AgentsTab(): JSX.Element;
```

### Behavioral contract

Identical to `IntegrationsTab` but with copy pointing at `InstanceDetail.agents.*` and messaging about "custom agent behaviors / personas". (FR-010, spec User Story 5.)

---

## 7. `TabsList` composition (inside `InstanceDetail`)

Not a separate component — documented here to fix the expected JSX shape.

```tsx
<Tabs defaultValue="general" className="w-full">
  <TabsList className="w-full justify-start">
    {TABS.map(({ key, labelKey, icon: Icon }) => (
      <TabsTrigger key={key} value={key} className="gap-2">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        <span>{t(labelKey)}</span>
        {key === "channels" && pendingPairingCount > 0 ? (
          <Badge variant="outline" className="...amber...">
            {pendingPairingCount}
          </Badge>
        ) : null}
      </TabsTrigger>
    ))}
  </TabsList>

  <TabsContent value="general">   <GeneralTab   ... /> </TabsContent>
  <TabsContent value="channels">  <ChannelsTab  ... /> </TabsContent>
  <TabsContent value="ssh">       <SshTab       ... /> </TabsContent>
  <TabsContent value="integrations"> <IntegrationsTab /> </TabsContent>
  <TabsContent value="agents">    <AgentsTab /> </TabsContent>
</Tabs>
```

### Behavioral contract

- The `TabsList` MUST remain visually usable at ≥640 px viewport widths (FR-015). If a label would overflow on narrower widths, allow wrapping/scrolling rather than truncation.
- Keyboard and pointer interaction come from Radix defaults (FR-013).

---

## 8. i18n message contract

Contract: the following key tree MUST exist in both `messages/en.json` and `messages/es.json` with identical shape.

```text
InstanceDetail
├── allowedNumbers            (existing — unchanged)
├── noNumbers                 (existing — unchanged)
├── allowedNumbersInfo        (existing — unchanged)
├── tabs.{general,channels,ssh,integrations,agents,channelsAttentionAria}
├── general.{telemetryLabel,gatewayTitle,gatewayDescription,gatewayWarning,gatewayLaunch,gatewayPending}
├── channels.{notReady,pendingBadge}
├── ssh.{notReady,title,description,connect,disconnect,idleLabel}
├── integrations.{title,comingSoon,description}
├── agents.{title,comingSoon,description}
└── provisioning.{bannerTitle,stepCreating,stepInitializing,stepStarting,stepRunning,awaitingTelemetry}
```

Missing any key in either locale MUST fail lint/build-time validation (or at minimum be caught in manual review before merge). Literal English copy is finalized during implementation; Spanish mirrors semantically.

---

## 9. Non-contracts (explicit)

To prevent scope creep, the following are **out of contract**:

- No new API route under `src/app/api/`.
- No new columns on the `instance` table or any other Drizzle schema.
- No new SWR endpoint keys.
- No deep-linking (`?tab=...`) or localStorage persistence for the active tab.
- No modification to the existing gateway-auth URL format or pairing/WhatsApp request/response shapes.
- No renaming or API change to `ModelProviderModule` or `SshTerminal`.
