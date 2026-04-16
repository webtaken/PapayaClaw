# Data Model: Instance Detail Tabbed Interface

**Feature**: 003-instance-tabs | **Date**: 2026-04-16

## Overview

This feature is a UI reorganization. **No database schema changes, no new server data, no new API endpoints.** All entities below are either existing data shapes the UI already consumes or client-side-only constructs introduced by the tabbed shell.

---

## Existing server-side data (unchanged)

### `instance` row (Drizzle schema, read-only here)

Source: `src/lib/schema.ts`. Consumed by the server route `src/app/[locale]/dashboard/[id]/page.tsx`.

| Field | Type | Purpose in this feature |
|-------|------|------------------------|
| `id` | string | Page identity, SWR key, terminal session binding |
| `userId` | string | Server-side authorization check (not used client-side) |
| `name` | string | Rendered in persistent page header |
| `status` | string | Badge label + gating (provisioning vs. ready) |
| `model` | string | General tab telemetry + ModelProviderModule |
| `channel` | string (pipe-separated) | Fallback channel list when live status has no `channels` |
| `botToken` | string | Gateway launch URL (General tab) |
| `providerServerIp` | string \| null | Fallback IP when live status has no `serverIp` |
| `cfTunnelHostname` | string \| null | Gateway hostname (General tab) |
| `createdAt` | timestamp | Persistent header metadata |

### `GET /api/instances/:id/status` response (unchanged)

Shape defined in `src/components/dashboard/instance-detail.tsx#StatusData`:

```ts
type StatusData = {
  instanceStatus: string;
  hetznerStatus: string | null;
  serverIp: string | null;
  gatewayToken: string | null;
  channels?: string[];
  whatsappNumbers?: string[];
};
```

Continues to be fetched via SWR with a 10 s refresh that stops once the instance reaches `running`.

### `GET /api/instances/:id/pairing?channel=telegram` response (unchanged)

```ts
type PairingRequest = {
  code: string;
  senderId: string;
  senderName: string | null;
  timestamp: string;
};
type PairingResponse = { requests: PairingRequest[] };
```

### `POST /api/instances/:id/pairing` (unchanged)

Body: `{ code: string }`. Used for approving a pairing request from the Channels tab.

### `POST /api/instances/:id/whatsapp-numbers` / `DELETE` (unchanged)

Body: `{ phone: string }`. Returns `{ numbers: string[] }`. Used for managing the WhatsApp allowlist from the Channels tab.

---

## Client-side UI state (introduced by this feature)

### `TabKey` (new)

A union literal describing the five top-level tabs.

```ts
type TabKey = "general" | "channels" | "ssh" | "integrations" | "agents";
```

| Key | Display label (en) | Display label (es) | Requires `currentIp`? |
|-----|-------------------|-------------------|-----------------------|
| `general` | "General" | "General" | No |
| `channels` | "Channels" | "Canales" | Yes (empty-state otherwise) |
| `ssh` | "SSH" | "SSH" | Yes (empty-state otherwise) |
| `integrations` | "Integrations" | "Integraciones" | No |
| `agents` | "Agents" | "Agentes" | No |

### Tab configuration (new, client-only)

```ts
const TABS: readonly { key: TabKey; labelKey: string; icon: LucideIcon }[] = [
  { key: "general",      labelKey: "tabs.general",      icon: LayoutDashboard },
  { key: "channels",     labelKey: "tabs.channels",     icon: Radio },
  { key: "ssh",          labelKey: "tabs.ssh",          icon: Server },
  { key: "integrations", labelKey: "tabs.integrations", icon: Plug },
  { key: "agents",       labelKey: "tabs.agents",       icon: Bot },
];
```

- `labelKey` resolves through `t("tabs.general")` etc.
- Icon choices are indicative; final selection is made with the `frontend-design` / `shadcn` skills during implementation.

### Shell state (hoisted — already exists, not moved)

State already held by `InstanceDetail` that must **stay** in the shell (not panels):

| State | Source | Why in shell |
|-------|--------|--------------|
| `instance` (`InstanceData`) | Props → `useState` | Shared by General + Channels (model, channel summary) |
| `statusData` (SWR) | `useSWR('/api/instances/:id/status')` | Drives gating for every tab + attention indicator |
| `pairingRequests` (PairingRequest[]) | Fetched on readiness | Drives Channels panel + Channels tab trigger badge |
| `isPairingLoading`, `approvingCode`, `pairingError` | Local | Channels panel UI; lifted so refetch survives tab switches |
| `newPhone`, `isAddingPhone`, `removingPhone` | Local | Channels panel (WhatsApp) |
| `activeChannelTab` (`"telegram" \| "whatsapp"`) | Local | Sub-tab within Channels; preserved across top-level tab switches |
| `isTerminalOpen` | Local | SSH panel connect/disconnect state; preserved across top-level tab switches so a user can click away and return without losing their shell |

### Panel-local state (new, tiny)

- **`general-tab.tsx`**: no new local state (consumes shell state only)
- **`channels-tab.tsx`**: no new local state (consumes shell state; continues to use existing `activeChannelTab` from shell)
- **`ssh-tab.tsx`**: no new local state (consumes shell's `isTerminalOpen`)
- **`integrations-tab.tsx`**: no state
- **`agents-tab.tsx`**: no state

### Derived values (shell)

- `currentStatus = statusData?.instanceStatus ?? instance.status`
- `currentIp = statusData?.serverIp ?? instance.providerServerIp`
- `isProvisioning = currentStatus === "deploying" || (statusData?.hetznerStatus && statusData.hetznerStatus !== "running")`
- `effectiveStatus = statusData?.hetznerStatus ?? currentStatus`
- `channels = statusData?.channels?.length ? statusData.channels : instance.channel.split("|")`
- `channelSet = new Set(channels)`
- `hasTelegram = channelSet.has("telegram")`
- `hasWhatsApp = channelSet.has("whatsapp")`
- `pendingPairingCount = pairingRequests.length` *(new — drives trigger badge)*

All derivations are inexpensive and do not require `useMemo` (React Compiler handles it).

---

## i18n keys (new)

Extend `InstanceDetail` namespace in `messages/en.json` and `messages/es.json`.

```jsonc
{
  "InstanceDetail": {
    "allowedNumbers": "Allowed Numbers",
    "noNumbers": "No numbers configured",
    "allowedNumbersInfo": "Only messages from numbers listed here ...",

    "tabs": {
      "general": "General",
      "channels": "Channels",
      "ssh": "SSH",
      "integrations": "Integrations",
      "agents": "Agents",
      "channelsAttentionAria": "{count, plural, one {# pending action} other {# pending actions}}"
    },

    "general": {
      "telemetryLabel": "Telemetry",
      "gatewayTitle": "Gateway Console",
      "gatewayDescription": "Access the OpenClaw securely-tunneled web interface ...",
      "gatewayWarning": "Do not share this web interface with anyone ...",
      "gatewayLaunch": "Launch Interface",
      "gatewayPending": "Gateway tunnel is being provisioned"
    },

    "channels": {
      "notReady": "Channel management becomes available once provisioning completes.",
      "pendingBadge": "{count} pending"
    },

    "ssh": {
      "notReady": "SSH access becomes available once provisioning completes.",
      "title": "Root Terminal",
      "description": "Secure WebRTC shell protocol. Direct root access to standard input/output.",
      "connect": "Connect",
      "disconnect": "Disconnect",
      "idleLabel": "Idle"
    },

    "integrations": {
      "title": "Integrations",
      "comingSoon": "Not yet available",
      "description": "Connect this agent to other apps and services. This section is under active development and will be available in a future release."
    },

    "agents": {
      "title": "Custom Agents",
      "comingSoon": "Not yet available",
      "description": "Define custom agent behaviors and personas for this instance. This section is under active development and will be available in a future release."
    },

    "provisioning": {
      "bannerTitle": "System Boot Sequence",
      "stepCreating": "Creating server allocation",
      "stepInitializing": "Running boot sequence",
      "stepStarting": "Starting system services",
      "stepRunning": "System online",
      "awaitingTelemetry": "Awaiting telemetry broadcast..."
    }
  }
}
```

Final copy is polished during implementation with `frontend-design`. Spanish copy mirrors every key.

---

## State transitions (UI)

```text
User opens /dashboard/:id
  ├─ Server: fetch instance; session OK → render <InstanceDetail>
  └─ Client: InstanceDetail mounts
        ├─ SWR starts polling /api/instances/:id/status (10 s)
        ├─ Active tab defaults to "general" (FR-014)
        └─ If ready AND hasTelegram: fetch pairing requests

User clicks Channels tab
  └─ TabsContent for "channels" mounts; shell state (pairingRequests,
     WhatsApp numbers, activeChannelTab) is reused — no refetch

User clicks SSH tab (ssh-tab mounts first time)
  └─ If isTerminalOpen was true, SshTerminal remounts via dynamic()
     Note: WebRTC session will reconnect; this is existing behavior
     and is considered acceptable for this feature.

User clicks Integrations / Agents tabs
  └─ Placeholder panel mounts; no network calls

Pending pairing request arrives (via next SWR cycle or manual refresh)
  └─ pairingRequests state updates in shell → Channels trigger badge appears
     (visible regardless of active tab — FR-007)

Provisioning completes (hetznerStatus → "running")
  ├─ isProvisioning flips to false
  ├─ General tab switches from boot-sequence to telemetry+gateway UI
  └─ Channels / SSH tabs clear their "not ready" empty-states
```

---

## Validation rules

No server-side validation rules are introduced. Client-side validations remain unchanged:

- WhatsApp phone number must match `^\+\d+$` (existing regex in shell's submit handler)
- Pairing approval accepts any `code` from the returned list (no client validation beyond the button's disabled state)

---

## Out of scope for this feature

- Deep-linking active tab via URL (`?tab=...`) — explicitly excluded (spec "Assumptions")
- Persisting the active tab across sessions (localStorage) — excluded for the same reason
- Actual functionality behind the Integrations and Agents tabs — placeholders only
- Any changes to the gateway authentication URL format, Telegram pairing API, or WhatsApp allowlist API
