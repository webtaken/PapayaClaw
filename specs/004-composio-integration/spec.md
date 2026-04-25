# Feature Specification: Composio Integration Layer

**Feature Branch**: `004-composio-integration`
**Created**: 2026-04-22
**Status**: Draft
**Input**: User description: "Build a Composio integration layer for PapayaClaw (papayaclaw.com). This feature allows platform users to connect third-party services (Gmail, GitHub, Slack, Notion, etc.) to their deployed OpenClaw bots via Composio as the tool provider."

## Clarifications

### Session 2026-04-22

- Q: v1 catalog scope → A: 8 curated services — Gmail, Google Calendar, Google Drive, Google Sheets, Notion, Linear, Slack, GitHub. No other services are surfaced to the user in v1, even if the upstream tool provider supports them. Expanding the catalog is a post-v1 operation.
- Q: Connection ownership scope → A: Per-user connection + per-instance enable + per-instance selected connected account. One OAuth per service per user; every instance owned by that user can independently enable/disable and, where multiple connected accounts exist for a service, pick which one it uses.
- Q: Action-list granularity per instance (v1) → A: Per-service on/off only. Enabling a service for an instance grants the instance every upstream-supported action for that service. Per-action allow-list is explicitly deferred to v2. Over-granting risk is mitigated by the audit log (FR-017), not by UI gating in v1.
- Q: Billing / plan gating (v1) → A: Universally available to every signed-in user; no per-user metering in v1; upstream action-execution cost is absorbed by the platform. Metering and tier gating are explicitly out of scope for this feature and belong to a separate billing workstream.
- Q: Activity log visibility (v1) → A: Minimal per-instance activity panel inside the integrations tab showing the last 50 tool invocations for that instance (service, action name, timestamp, outcome). No cross-instance dashboard, filters, or health dashboard in v1. This satisfies the audit-log mitigation premise of the action-granularity decision above. Full activity dashboard and health overview are v2.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Connect a third-party service to my account (Priority: P1)

A PapayaClaw user opens the "Integrations" area inside the platform, browses a catalog of supported services (Gmail, GitHub, Slack, Notion, and others Composio supports), picks one, completes the service's OAuth consent in a redirect window, and returns to PapayaClaw to see the integration marked as **Connected**. The connection belongs to the user's PapayaClaw account and can be made available to any of their deployed OpenClaw bots.

**Why this priority**: Without a completed connection, no downstream feature works. This is the minimal viable slice — a user can authenticate one service end-to-end and see a durable connected state.

**Independent Test**: A user with an empty integrations list can pick Gmail from the catalog, walk through Google's OAuth screen, be redirected back to PapayaClaw, and observe the Gmail integration listed as **Connected** with the correct account email displayed. Reloading the page preserves the state. This delivers tangible value (a usable credential) even if no bot has been wired up yet.

**Acceptance Scenarios**:

1. **Given** a signed-in user with no prior integrations, **When** they select "Connect Gmail" and approve consent at Google, **Then** they return to PapayaClaw and Gmail appears in their integration list with status **Connected** and the connected account identifier (e.g., email address) shown.
2. **Given** a user who cancels or denies consent at the provider, **When** they return to PapayaClaw, **Then** the integration is **not** marked as connected, a clear message explains the cancellation, and the user can retry.
3. **Given** a user who already has a Gmail connection, **When** they initiate a second Gmail connection, **Then** a new, independent connected account is added (supporting e.g. work + personal accounts) and both appear in their list with distinguishable identifiers.
4. **Given** a user with an active connection whose token was later revoked at the provider, **When** any of their bots next attempts to invoke a tool on that service, **Then** the connection transitions to **Reconnect required** and the owner sees that state (with a one-click reconnect action) on the integrations tab from that moment on — detection is invocation-driven; the platform does not background-poll provider revocation.

---

### User Story 2 - Manage my connections (Priority: P2)

A user opens the Integrations area, sees every service they have connected, the account identifier for each, which OpenClaw bots (if any) are currently using that connection, and controls to disconnect or reconnect. Disconnecting revokes access within PapayaClaw/Composio and prevents any bot from using that connection from that moment on.

**Why this priority**: Connections are durable credentials; users need ongoing control. Without management, the feature ships a one-way door that erodes trust.

**Independent Test**: A user with at least one connected service can open the list, click **Disconnect** on one entry, confirm the destructive action, and see the entry move to a disconnected state. A subsequent bot run that would have used that connection fails gracefully with a clear "not connected" signal rather than silently.

**Acceptance Scenarios**:

1. **Given** a user with three connected services, **When** they view the integrations list, **Then** each entry shows service name, account identifier, connection health (connected / reconnect required / expired), and the list of bots consuming it.
2. **Given** a connected integration in use by one or more bots, **When** the user clicks **Disconnect**, **Then** a confirmation dialog names the affected bots by title and requires explicit confirmation before proceeding.
3. **Given** a confirmed disconnect, **When** the operation completes, **Then** the connection is removed from the user's account, Composio no longer holds the credential, and bots lose access from the next tool invocation onward.

---

### User Story 3 - Make connected services available to a specific bot (Priority: P2)

From a bot's integrations tab, the bot owner toggles each of their connected services on or off for that bot. When a service is on, the bot at runtime receives every action the upstream tool provider exposes for that service; when off, the bot sees no tools from it. Per-action gating is not part of v1.

**Why this priority**: Ships alongside P1 for any meaningful bot use, but is distinct from the act of connecting. Per-bot on/off scoping is what lets the same user safely deploy many bots with different service access without re-authenticating.

**Independent Test**: Starting from a bot with no integrations enabled and a user account with two connected services, the owner opens the bot's integrations tab, toggles Gmail on, saves, and verifies the bot reports Gmail's actions as available at runtime. Toggling Gmail off and saving returns the bot to zero Gmail tools.

**Acceptance Scenarios**:

1. **Given** a bot owner with connected services, **When** they open the bot's integrations tab, **Then** every service the owner has connected is listed and can be toggled on/off for this bot.
2. **Given** a service toggled on for a bot, **When** the bot runs, **Then** every upstream-supported action for that service is exposed to the bot; when toggled off, none are.
3. **Given** a user who disconnects a service at the account level, **When** any bot that had the service toggled on runs next, **Then** the service's actions are no longer offered and the bot surfaces a clear "integration unavailable" condition rather than failing silently or leaking a raw error.

---

### User Story 4 - Bot executes a third-party action end-to-end (Priority: P1)

A deployed OpenClaw bot, while responding to a user request, invokes an allowed tool (e.g., "send a Gmail message" or "create a GitHub issue"), the action executes against the third-party service through Composio using the correct user's credentials, the result is returned to the bot, and the outcome is reflected both in the bot's conversation and in the third-party service itself (email sent, issue created, etc.).

**Why this priority**: This is the payoff — it's what distinguishes "connected" from "useful." Without working execution, P1/P2/P3 are theatre.

**Independent Test**: A user with Gmail connected and a bot that allows Gmail's "send email" action asks the bot to send themselves a test email. Within a reasonable time, the email arrives in the user's inbox and the bot confirms success. Rejection paths (revoked token, provider rate limit) produce legible error messages rather than stack traces.

**Acceptance Scenarios**:

1. **Given** a bot with allowed Gmail "send email" action and a connected Gmail account, **When** the bot calls that action with valid parameters during a conversation, **Then** the email is sent and the bot receives and reports a success outcome.
2. **Given** a bot whose underlying connection has expired between runs, **When** the bot attempts an action, **Then** the platform surfaces a **Reconnect required** signal to the user without the bot producing a raw authentication error.
3. **Given** a bot attempting an action whose service is toggled off or disconnected (e.g., stale configuration), **When** the request reaches the integration layer, **Then** the request is rejected with an authorisation error, and the event is auditable.
4. **Given** a third-party action that mutates state and then fails mid-flight, **When** the bot reports back, **Then** the reported outcome accurately reflects what the provider returned (partial success / failure) and is logged for audit.

---

### User Story 5 - Owner sees what a bot actually did (Priority: P2)

Inside a bot's integrations tab, the bot owner can see the last 50 tool invocations that instance made: service, action name, timestamp, and outcome (success / provider error / authorisation denied). This is the owner's audit surface in v1 and the verifiable mitigation for per-service (not per-action) scoping.

**Why this priority**: Q3 made per-service on/off the v1 authorisation boundary and deferred per-action gating to v2, on the premise that the audit log lets owners spot over-use. Without a user-visible log, that premise is unverifiable; the feature ships trust-me. P2 lands it in v1 alongside connect + toggle.

**Independent Test**: After a bot with a toggled-on service has executed three actions, the owner opens the integrations tab's activity panel and sees exactly three entries in chronological order, each with service, action name, timestamp, and outcome. Entries beyond the 50-invocation cap age out in FIFO order.

**Acceptance Scenarios**:

1. **Given** a bot has executed prior tool invocations, **When** the owner opens the integrations tab, **Then** the activity panel lists the last 50 invocations for that instance with service, action name, timestamp, and outcome.
2. **Given** a failed invocation, **When** it appears in the panel, **Then** its outcome classifies the failure (provider error / authorisation denied / connection unhealthy) without exposing raw provider stack traces or sensitive argument values.
3. **Given** an instance has never executed a tool, **When** the owner opens the panel, **Then** a clear empty state is shown rather than a blank region.

---

---

### Edge Cases

- **OAuth redirect hijack / state mismatch**: The return URL is opened in the wrong browser or tab, or with a stale state parameter. The platform must refuse to mark the connection as live and prompt the user to retry.
- **User closes the OAuth window**: No callback is received. After a reasonable timeout, the in-progress connection is cleaned up and the user sees a "connection was not completed" state they can retry from.
- **Provider-side revocation**: A user revokes access at Google/GitHub directly. The next bot invocation fails; the platform must detect this, move the connection to **Reconnect required**, and notify the owner (at minimum in-app).
- **Multiple accounts per service**: A user connects two Gmail accounts. Any bot that uses Gmail must let its owner pick which connected account the bot should use. The platform must never silently choose.
- **Bot owner loses platform access**: If the PapayaClaw user account is deleted or suspended, all their connected accounts must be revoked at Composio and no bot may continue to use them.
- **Rate limits / provider outages**: The third-party service returns 429 or 5xx. Error is surfaced to the bot and logged; the platform does not retry mutating actions silently.
- **Action parameter validation failure**: The bot calls an action with malformed arguments. The error is returned to the bot in a form it can reason about, not a raw provider stack trace.
- **Very long-running actions**: Actions that take longer than a reasonable UI timeout complete in the background and the result is visible to the bot when available.
- **Upstream scope gap at runtime**: An action invoked by the bot requires a scope the original OAuth grant didn't include. The platform surfaces the upstream error as a structured "reconnect with additional scopes required" signal rather than a raw stack trace; the user is prompted to reconnect.
- **Two bots, same user, same service, different account preference**: Each bot's owner can choose a different connected account per service without affecting the other bot.

## Requirements *(mandatory)*

### Functional Requirements

**Identity & tenancy**

- **FR-001**: The system MUST associate every third-party connection with exactly one PapayaClaw user identity, and MUST prevent any cross-user leakage of connections, tokens, or tool outputs.
- **FR-002**: The system MUST support the same user holding multiple connected accounts for the same service (e.g., work + personal Gmail), each independently addressable.

**Catalog & connection**

- **FR-003**: Users MUST be able to browse a curated v1 catalog of exactly 8 services — Gmail, Google Calendar, Google Drive, Google Sheets, Notion, Linear, Slack, GitHub — each with name, icon, and short description. No other services are shown, even if the upstream tool provider supports them.
- **FR-004**: Users MUST be able to initiate a connection to a chosen service through a standard consent flow (OAuth where applicable, API-key entry where the service uses API keys) without the platform asking them for provider credentials directly.
- **FR-005**: The system MUST handle the redirect back from the provider, verify the completion is legitimate by matching a platform-issued `state` parameter against the pending connection row (generated at `POST /api/integrations/connect`, single-use, expires in 15 minutes), and move the connection to a **Connected** state only on verified match. The upstream tool provider's own correlation identifiers are treated as untrusted input.
- **FR-006**: The system MUST display, for each connection, the service name, the account identifier (e.g., email), the health status (**Connected** / **Reconnect required** / **Expired** / **Revoked**), and the time of the last successful check.
- **FR-007**: Users MUST be able to disconnect any connection, and disconnection MUST revoke the credential upstream, remove it from the platform's storage, and take effect for every bot that was using it from the next tool invocation onward.
- **FR-008**: Users MUST be able to reconnect a connection that is in **Reconnect required** / **Expired** / **Revoked** state in a single flow that preserves the connection's identity (the same entry in the list updates rather than a duplicate being added).

**Per-bot tool scoping**

- **FR-009**: Bot owners MUST be able to, per bot, toggle each of their connected services on or off. A service toggled on exposes every upstream-supported action for that service to the bot; a service toggled off exposes none.
- **FR-010**: Per-action allow-listing is out of scope for v1. The v1 authorisation boundary is strictly the per-service on/off toggle combined with connection health. Per-action gating is a planned v2 enhancement.
- **FR-011**: When a user has multiple connected accounts for the same service, bot owners MUST be able to specify which connected account a given bot uses for that service.
- **FR-012**: The system MUST re-evaluate tool availability for a bot on every run so that changes to service toggles, connected-account selection, and connection health take effect without redeployment.

**Runtime execution**

- **FR-013**: When a deployed bot invokes an allowed tool, the system MUST execute the action through the upstream tool provider using the correct user's credentials and return the provider's result to the bot.
- **FR-014**: The system MUST reject any runtime tool call for a service that is not toggled on for the bot, or whose underlying connection is not in **Connected** state, returning a structured authorisation error to the bot.
- **FR-015**: The system MUST refresh expiring credentials transparently where the upstream provider supports it, without the bot being aware.
- **FR-016**: On irrecoverable auth failure (revoked/expired with no refresh possible), the system MUST mark the connection as **Reconnect required**, surface the condition to the bot as a structured integration-unavailable signal, and notify the owner in-app.

**Observability & audit**

- **FR-017**: The system MUST log every tool invocation (bot, user, service, action, timestamp, outcome, latency) in a store the owner can review.
- **FR-017a**: The integrations tab MUST surface a per-instance activity panel showing the last 50 invocations for that instance, each row displaying service, action name, timestamp, and outcome classification.
- **FR-017b**: The per-instance activity panel MUST age out entries in FIFO order beyond the 50-entry cap. Longer retention, cross-instance views, filters, and health dashboards are out of scope for v1.
- **FR-018**: The system MUST log every connection lifecycle event (created, reconnected, disconnected, flagged unhealthy) in the same audit surface. Lifecycle events are not required to appear in the per-instance activity panel in v1.
- **FR-019**: Sensitive fields in tool arguments and results (e.g., email bodies, file contents) MUST NOT be written to the audit log or surfaced in the activity panel; only metadata (action name, argument keys, success/failure, error class) is retained.

**Security & privacy**

- **FR-020**: The platform MUST NOT store third-party access tokens in its own primary database in plaintext; credential custody MUST sit with the upstream tool provider.
- **FR-021**: When a PapayaClaw user account is deleted or suspended, the system MUST revoke all of that user's third-party connections at the upstream tool provider within a bounded, auditable time window.
- **FR-022**: The system MUST NOT expose any user's connection or tool activity to another user, bot, or administrator except via an explicit, audited admin path.

### Key Entities

- **User Integration Identity**: The stable identifier by which the platform represents a given PapayaClaw user to the upstream tool provider. One per user. The boundary of multi-tenancy.
- **Connected Account**: A single authenticated relationship between a User Integration Identity and one specific third-party service account (e.g., "this user's work Gmail"). Carries: service name, provider-side account identifier, health status, created/updated timestamps. Multiple may exist per user per service.
- **Service Catalog Entry**: One of the 8 curated v1 services (Gmail, Google Calendar, Google Drive, Google Sheets, Notion, Linear, Slack, GitHub). Read-only from the user's perspective; curated by the platform from the upstream tool provider's broader catalog.
- **Action**: A specific capability within a service (e.g., "send email", "create issue"). Addressable by a stable slug.
- **Bot Integration Binding**: The per-bot configuration declaring (a) which services are toggled on for that bot, (b) for services with multiple connected accounts, which connected account is used. Per-action selection is deferred to v2.
- **Tool Invocation Record**: An audit entry capturing a single runtime tool call: bot, owner user, connected account, action, timestamp, latency, outcome, and error class on failure. Contains no sensitive argument/result content.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can connect their first third-party service and see it marked **Connected** in under **2 minutes**, measured from catalog click to confirmed status (including the provider's own consent screen).
- **SC-002**: A bot owner can, for any already-connected service, toggle whether their bot may use that service — and where the user has multiple connected accounts, select which one — in under **60 seconds** from opening the bot's integrations tab. (Per-action gating is out of v1 scope; see Clarification Q3 / FR-010.)
- **SC-003**: At least **95%** of runtime tool invocations against healthy connections complete without any platform-originated (non-provider) error.
- **SC-004**: When a connection's health degrades (token revoked / expired), it is reflected in the UI and surfaced to affected bots within **1 minute** of the first failing invocation, not on the next session.
- **SC-005**: **100%** of tool invocations produce an audit record containing bot, action, outcome, and timestamp within the same session they occur, and the 50 most recent of those for a given instance are visible to the owner in the integrations tab within **5 seconds** of occurrence.
- **SC-006**: Zero bot at runtime can successfully invoke an action whose service is toggled off for that bot, or whose connection is not in **Connected** state (verified by penetration test / test suite).
- **SC-007**: Deleting a PapayaClaw user account revokes **100%** of that user's third-party connections at the upstream provider within **24 hours**, verifiable via provider-side audit.
- **SC-008**: Across the supported service catalog, the **top 5** services by user adoption can each be exercised end-to-end (connect → bot action → visible outcome at provider) without platform intervention.

## Assumptions

- **Upstream tool provider**: Composio is the single tool-provider substrate for this feature. The platform does not independently implement OAuth flows per service; it delegates credential custody, token refresh, and action execution to Composio.
- **Provider identity model**: The platform uses Composio's multi-tenant user/entity model, treating each PapayaClaw user as a distinct upstream identity. Multiple connected accounts per user per service are supported natively by Composio.
- **Auth configuration**: v1 uses Composio-managed OAuth credentials (no white-label/custom OAuth apps). White-labeling is explicitly out of scope for v1 and can be added later without changing the user-facing model.
- **Event-driven triggers deferred**: Composio supports triggers (e.g., "new Gmail arrives → do X"). This specification does **not** include trigger-based workflows; triggers are a follow-up phase. Bots invoke tools only in response to their own reasoning (chat / task turns), not in response to inbound events.
- **Action execution model**: Tool invocation happens through the agent framework's native tool-use cycle at runtime; the platform exposes to each bot only the actions of services that are both toggled on for that bot and in **Connected** health.
- **Billing / metering**: v1 is universally available to every signed-in PapayaClaw user with no per-user metering and no tier gating. Upstream action-execution cost is absorbed by the platform. Any metering, quotas, or paid-plan gating is explicitly a separate billing workstream.
- **Explicit v2 scope (out of v1)**: (a) cross-instance activity dashboard with filters, date ranges, and per-service health overview beyond the last-50 per-instance panel; (b) owner-configurable per-action allow-listing within an enabled service; (c) Composio trigger-based inbound-event workflows; (d) white-label / custom OAuth app support; (e) per-user billing, metering, or tier gating.
- **Service catalog is curated**: v1 exposes exactly the 8 services listed in FR-003; action lists within each service are whatever the upstream tool provider supports for that service at runtime. Adding or removing services is a platform-side change, not a user-side setting.
- **Platform identity**: Authentication and user identity are provided by the existing PapayaClaw auth system; this feature does not introduce a new login mechanism.
- **Storage boundary**: The platform stores mappings and metadata (which user owns which connection, which service is toggled on per bot, which connected account a bot uses) but does not store raw third-party tokens.
- **Network boundary**: All OAuth redirect and tool-execution traffic transits over HTTPS on papayaclaw.com and the upstream tool provider's endpoints.

## Dependencies

- **Composio SDK / platform availability**: This feature cannot function without Composio's tool, auth, and execution APIs being reachable. Degraded upstream availability degrades the entire feature.
- **Provider OAuth apps (Composio-managed)**: Composio must have active OAuth app registrations with each third-party provider we surface in the catalog.
- **Existing PapayaClaw user account system**: User identity and session management are prerequisites; every connection belongs to a logged-in PapayaClaw user.
- **Existing OpenClaw bot runtime**: Bots must be able to receive a per-run tool list and invoke tools through the agent framework's tool-use mechanism.
