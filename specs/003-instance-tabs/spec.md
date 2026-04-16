# Feature Specification: Instance Detail Tabbed Interface

**Feature Branch**: `003-instance-tabs`
**Created**: 2026-04-16
**Status**: Draft
**Input**: User description: "Modify the interface of the instance detail page. Split the information of the instance into different tabs using the tabs component. The sections are: 1) General: general information of the instance, including the link to the gateway; 2) Channels: manage the connected channels of the instance (Telegram, WhatsApp, etc.); 3) SSH: the SSH console section; 4) Integrations: not yet implemented — show an information message; 5) Agents: custom agents — not yet implemented — show an information message."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navigate instance details through organized tabs (Priority: P1)

As a user who has opened the detail page for one of their agent instances, I want the information to be split into clear, named tabs so that I can focus on one concern at a time instead of scrolling through a long stacked page of mixed information.

**Why this priority**: This is the core reorganization that motivates the feature. Without tabs, none of the other stories deliver value. All subsequent stories assume the tabbed shell exists.

**Independent Test**: Open an existing instance detail page. Verify five tabs are visible with the labels General, Channels, SSH, Integrations, Agents. Clicking each tab switches the main content area to that section's content while the page header (back link, instance name, status badge, identifying metadata) stays visible. Delivers immediate value by reducing visual clutter and making navigation between concerns explicit.

**Acceptance Scenarios**:

1. **Given** a user lands on a running instance's detail page, **When** the page renders, **Then** five tabs (General, Channels, SSH, Integrations, Agents) are visible and one tab is active by default.
2. **Given** the detail page is loaded, **When** the user clicks a different tab, **Then** the content area updates to show only that tab's content and the active tab indicator moves to the clicked tab.
3. **Given** a user switches between tabs repeatedly, **When** they return to a previously visited tab, **Then** the content renders immediately without a full reload of the underlying page.
4. **Given** a page reload happens while a non-default tab was active, **Then** the system chooses a consistent default landing tab (the General tab) on the next load.

---

### User Story 2 - Review core instance details and open the gateway from the General tab (Priority: P1)

As a user who wants a quick overview of an instance, I want the General tab to show all identifying and telemetry information (status, IP address, model, connected channels summary, gateway hostname) together with the action to launch the gateway web interface, so I can understand the state of the instance and jump into its console without hunting across the page.

**Why this priority**: The gateway is the primary way users interact with their agent once the instance is running. Surfacing it on the first (default) tab preserves the existing primary call-to-action behavior.

**Independent Test**: Open an instance that is running and has a gateway tunnel ready. Confirm the General tab displays the instance's summary telemetry and exposes a single, obvious action to launch the gateway interface in a new tab. Clicking the action opens the gateway URL in a new browser tab authenticated with the instance's access token.

**Acceptance Scenarios**:

1. **Given** an instance whose gateway tunnel is ready, **When** the user views the General tab, **Then** the gateway hostname is shown and a prominent action to launch the gateway web interface is available.
2. **Given** an instance whose gateway tunnel is not yet ready, **When** the user views the General tab, **Then** the gateway field shows a clear pending state and the launch action is hidden or disabled with contextual messaging.
3. **Given** the user clicks the launch gateway action, **When** the click completes, **Then** the gateway interface opens in a new browser tab with the instance's access credentials applied, without leaving the dashboard page.
4. **Given** an instance is still provisioning (server is being allocated / booted), **When** the user views the General tab, **Then** the provisioning progress (current step, pending steps) is visible in place of the ready-state summary.
5. **Given** the user is on the General tab, **When** they view the section, **Then** they can see the configured AI model/provider for the instance.

---

### User Story 3 - Manage connected messaging channels from the Channels tab (Priority: P2)

As a user who wants to connect or inspect messaging channels (Telegram, WhatsApp, and any future channel) for their agent, I want a dedicated Channels tab that groups every channel-related control, so I can add, approve, or manage channels without being distracted by unrelated instance information.

**Why this priority**: Channel management is the second-most-used workflow after launching the gateway. It already has its own nested sub-tabs today (Telegram / WhatsApp) and benefits from a larger, uncluttered area.

**Independent Test**: From an instance that has at least one channel configured, navigate to the Channels tab. Confirm that all channel sub-controls — switching between Telegram and WhatsApp sub-views, seeing pending pairing requests, approving a request, adding/removing a WhatsApp allowed number, and seeing instructions to add a new channel — are accessible without leaving the tab. Delivers value independently by isolating a distinct management workflow.

**Acceptance Scenarios**:

1. **Given** an instance with Telegram configured, **When** the user opens the Channels tab and selects the Telegram sub-view, **Then** the list of pending pairing requests is displayed and each can be approved.
2. **Given** an instance with WhatsApp configured, **When** the user opens the Channels tab and selects the WhatsApp sub-view, **Then** the list of allowed phone numbers is displayed and the user can add or remove numbers.
3. **Given** an instance without a given channel configured, **When** the user opens that channel's sub-view, **Then** clear instructions to add the channel (and the associated terminal command) are shown.
4. **Given** the instance has pending pairing requests, **When** the user is on any other tab, **Then** the Channels tab label carries a visible indicator showing that attention is needed.
5. **Given** the instance's server is not yet allocated (no IP), **When** the user opens the Channels tab, **Then** a clear message explains that channel management becomes available once provisioning completes.

---

### User Story 4 - Access the SSH root terminal from a dedicated SSH tab (Priority: P2)

As a technically proficient user, I want the SSH console to live in its own tab so that, when I am actively using the terminal, I have the full content area for the shell session and am not distracted by other instance panels.

**Why this priority**: The terminal is an advanced but important workflow. Isolating it gives it the vertical space it needs and separates it from read-only or informational content.

**Independent Test**: On a running instance, switch to the SSH tab. Confirm a "Connect" action is visible. Click it and verify the terminal opens, takes the tab's content area, and offers a way to disconnect. Delivers value independently because the terminal is a self-contained tool usable without needing the other tabs.

**Acceptance Scenarios**:

1. **Given** an instance whose server is allocated and reachable, **When** the user opens the SSH tab, **Then** a control to initiate an SSH session is presented, together with a short explanation of the session's nature.
2. **Given** the user initiates an SSH session, **When** the connection is established, **Then** an interactive terminal occupies the tab's content area and a disconnect control is available.
3. **Given** the SSH session is active, **When** the user switches to a different tab and back, **Then** the session persists (does not forcibly disconnect on every tab change) or, if it must disconnect, the behavior is clearly communicated to the user.
4. **Given** the instance's server is not yet allocated, **When** the user opens the SSH tab, **Then** a clear message indicates that SSH access becomes available once provisioning completes.

---

### User Story 5 - See explicit "coming soon" messaging for Integrations and Agents (Priority: P3)

As a user browsing the tabs, I want the Integrations and Agents tabs to clearly communicate that they are planned but not yet implemented, so I understand the roadmap and am not confused by empty tabs.

**Why this priority**: This prevents user confusion around empty or non-functional tabs and sets expectations for upcoming capabilities. It is cosmetic/informational, so it is the lowest priority.

**Independent Test**: Open the Integrations tab, then the Agents tab. Verify each renders a self-explanatory informational message identifying the section, summarizing its future purpose, and indicating that it is not yet available. Delivers value independently because it communicates roadmap intent even before the features exist.

**Acceptance Scenarios**:

1. **Given** the user opens the Integrations tab, **When** the content renders, **Then** an informational message is shown explaining the tab's intended purpose (connections to other apps) and clearly stating that the feature is not yet available.
2. **Given** the user opens the Agents tab, **When** the content renders, **Then** an informational message is shown explaining the tab's intended purpose (custom agent configurations) and clearly stating that the feature is not yet available.
3. **Given** either placeholder tab is shown, **When** the user inspects the view, **Then** no interactive controls mislead them into believing they can act on the section now.

---

### Edge Cases

- **Provisioning state**: When the instance is still being provisioned (server not yet allocated, tunnel not yet established, or status is any non-ready state), tabs that depend on a ready instance (Channels, SSH) communicate their unavailability within the tab content; the user can still freely switch tabs without errors.
- **Partial readiness**: If the server has an IP but the gateway tunnel is not yet ready (or vice-versa), each dependent tab independently reflects only the parts that are actually available.
- **Channel attention indicator**: If new pairing requests arrive while the user is on a non-Channels tab, the Channels tab badge updates without the user having to reload the page.
- **Narrow viewport**: On smaller widths where five tab labels may not fit horizontally, the tab strip remains usable (e.g., wraps or scrolls) and no label is hidden without an accessible affordance.
- **Keyboard navigation**: The tab strip supports standard keyboard navigation (arrow keys move between tabs, Enter/Space activates).
- **Direct-link / reload behavior**: On page load or reload, the default active tab is always the General tab; there is no requirement in this feature to deep-link to a specific tab via the URL.
- **Instance not found / unauthorized**: Outside the scope of this feature (existing server-side handling applies before the tabbed view is rendered).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The instance detail page MUST present its content organized into five tabs with the following labels and order: General, Channels, SSH, Integrations, Agents.
- **FR-002**: The page MUST keep the following elements persistent outside the tab content area: the "back to dashboard" navigation, the instance's display name and identifying metadata (instance ID, creation date), and the current status indicator.
- **FR-003**: The General tab MUST display the instance's core telemetry (IP address, configured model/provider, connected channels summary, gateway hostname) and the primary action to launch the gateway web interface when the gateway is ready.
- **FR-004**: The General tab MUST expose the existing capability to view or change the instance's AI model/provider configuration.
- **FR-005**: When the instance is still provisioning, the General tab MUST show the provisioning progress (step-by-step status) in place of the ready-state summary.
- **FR-006**: The Channels tab MUST host all existing channel management controls, including switching between supported channel types (Telegram, WhatsApp, and any additional channel supported by the product), listing and approving pending pairing requests, managing WhatsApp allowed numbers, and showing instructions to add a channel that is not yet configured.
- **FR-007**: The Channels tab label MUST display a visible attention indicator when there are actionable events for any channel (e.g., pending pairing requests), regardless of which tab is currently active.
- **FR-008**: The SSH tab MUST host the interactive root terminal experience, including the idle/connect state, the active terminal session, and a way to disconnect.
- **FR-009**: The Integrations tab MUST render an informational placeholder message that identifies the section, summarizes its future purpose, and clearly states that the feature is not yet available, with no interactive controls that suggest otherwise.
- **FR-010**: The Agents tab MUST render an informational placeholder message that identifies the section, summarizes its future purpose, and clearly states that the feature is not yet available, with no interactive controls that suggest otherwise.
- **FR-011**: When a tab's functionality depends on the instance reaching a ready state, the tab MUST remain accessible but MUST clearly communicate within its content area that the functionality will become available once provisioning completes.
- **FR-012**: Switching tabs MUST NOT cause the instance's live state (status polling, pairing requests, allowed-number updates, AI provider configuration) to be lost or reset.
- **FR-013**: The tab strip MUST support standard pointer (click/tap) and keyboard (arrow keys for navigation, Enter/Space for activation) interaction patterns consistent with accessible tab controls.
- **FR-014**: On page load or reload, the General tab MUST be the active tab by default.
- **FR-015**: The tabbed layout MUST remain usable on viewports commonly used for the dashboard (both typical desktop widths and at minimum a narrow laptop width), with no tab label becoming unreachable.

### Key Entities *(include if feature involves data)*

- **Instance**: An agent deployment belonging to the authenticated user; identified by an ID, a name, a status, an IP address (once allocated), a configured model/provider, a list of connected channels, and a gateway hostname. The detail page's tabs are all scoped to a single instance.
- **Channel**: A messaging integration attached to an instance (currently Telegram and WhatsApp). Each channel carries its own state (configured or not, pending items such as pairing requests or allowed numbers).
- **Pairing Request**: An inbound Telegram pairing attempt awaiting user approval; drives the Channels tab's attention indicator.
- **SSH Session**: A user-initiated interactive root terminal bound to the instance's server; lives inside the SSH tab.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user opening an instance detail page can identify and reach any of the five sections (General, Channels, SSH, Integrations, Agents) in a single click without scrolling.
- **SC-002**: The General tab surfaces the gateway launch action prominently enough that a user can go from "opened the page" to "launched the gateway web interface" in no more than two interactions (open page → click launch) when the gateway is ready.
- **SC-003**: Channel management tasks (approving a pairing request, adding/removing a WhatsApp allowed number, viewing instructions to add a new channel) are fully completable without leaving the Channels tab.
- **SC-004**: 100% of content and interactive controls that exist on the current instance detail page continue to work after the reorganization (no functionality is lost; all controls are reachable from one of the five tabs).
- **SC-005**: A user who is unfamiliar with the product can open the Integrations or Agents tab and correctly answer "is this feature available today?" from the content shown, without needing external documentation.
- **SC-006**: The Channels tab's attention indicator appears within the same polling cycle that currently updates live channel state (i.e., no additional refresh interval is introduced).
- **SC-007**: Switching tabs completes visibly within 100 ms for already-rendered content (no perceptible re-fetch for data the page already has).

## Assumptions

- The existing tabs UI primitive (`src/components/ui/tabs.tsx`) is the intended component for realizing the five top-level tabs on this page.
- The current page header (back link, instance name and metadata, status badge) and the "provisioning boot sequence" UI are retained as-is in behavior — only their placement relative to the new tab shell changes.
- The AI provider/model management module, which today lives as a standalone module on the page, is placed under the General tab because it is core instance configuration and the user's description of the General tab as "general information of the instance" is the best fit; it is not reclassified as part of the separately described Integrations or Agents tabs.
- The existing status polling, pairing-request polling, WhatsApp allowed-number management, and SSH terminal implementations continue to work unchanged underneath the new tab shell.
- There is no requirement in this feature to persist the active tab in the URL (deep-linking to tabs) or across sessions; a reload resets to the default General tab.
- The Integrations and Agents placeholders are purely informational in this feature; defining what those features will actually do is out of scope.
- Channel sub-tabs (Telegram / WhatsApp) remain nested within the Channels top-level tab using whatever presentation best distinguishes them from the top-level tab strip; the current in-card sub-tab behavior is acceptable.
- Existing authentication, authorization, and "instance not found" handling on the server side are unchanged by this feature.
