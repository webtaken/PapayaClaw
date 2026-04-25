# REST API — Composio Integration Layer

All routes are under `src/app/api/**`. Auth column values:
- **Session**: Better Auth session cookie (`auth.api.getSession({ headers: await headers() })`). 401 on absence.
- **InstanceSecret**: `Authorization: Bearer <instance.callbackSecret>`; instance resolved from `:id` path param and must match the secret. 401 on mismatch, 404 on absent instance.

---

## User-facing endpoints (Session auth)

### `GET /api/integrations/catalog`

Returns the static curated 8-service catalog.

**200** — `CatalogResponse`:

```json
{
  "services": [
    {
      "slug": "gmail",
      "labelKey": "Integrations.services.gmail.label",
      "descriptionKey": "Integrations.services.gmail.description",
      "iconId": "gmail"
    }
    // … 7 more
  ]
}
```

No writes. Cached at the edge for one hour (`Cache-Control: public, max-age=3600, immutable` is not safe due to locale headers — use `s-maxage` with revalidate).

---

### `POST /api/integrations/connect`

Initiates an OAuth/auth-config flow for the caller on the specified toolkit.

**Body** — `ConnectRequest`:
```json
{ "toolkitSlug": "gmail" }
```

**201** — `ConnectResponse`:
```json
{
  "connectionId": "9f7b…",
  "redirectUrl": "https://backend.composio.dev/auth/start?state=…"
}
```

**Behavior**:
1. Validate session + toolkitSlug ∈ curated 8.
2. Generate a 128-bit URL-safe random `state`.
3. Call `session.toolkits.authorize(toolkitSlug, { state })` (or current SDK equivalent). Append `state` to the redirect URL if the SDK does not forward it.
4. Insert `composio_connection` row `(status='pending', composioConnectedAccountId = SDK-returned id, initiationState = state)`.
5. Return the `redirectUrl`.

**Errors**: 400 `INVALID_TOOLKIT`, 502 `UPSTREAM_UNAVAILABLE`.

---

### `GET /api/integrations/callback`

OAuth redirect target. Pre-registered once at Composio as `https://papayaclaw.com/api/integrations/callback`.

**Query**: `?state=<platform-issued>&composioConnectedAccountId=…&status=…`. `state` is REQUIRED.

**302** → redirects browser to `/[locale]/dashboard/...` with a success / error query flag the UI picks up.

**Behavior**:
1. No session check here (browser is mid-redirect from external provider) — authorisation is done by matching the platform-issued `state`.
2. Look up `composio_connection` by `initiationState`. Reject (redirect with error flag) if no match, if age > 15 min, or if row `status != 'pending'`.
3. On success: set `status='connected'`, null out `initiationState` (single-use), populate `accountLabel` from `session.connectedAccounts.get(…).label`, stamp `lastHealthCheckAt`.
4. On provider error: delete the pending row and redirect with error flag.

---

### `GET /api/integrations/connections`

Lists the caller's connections, grouped implicitly by toolkit (client groups).

**200** — `ConnectionsResponse`:
```json
{
  "connections": [
    {
      "id": "9f7b…",
      "toolkitSlug": "gmail",
      "accountLabel": "saul@example.com",
      "status": "connected",
      "lastHealthCheckAt": "2026-04-22T11:10:03.000Z",
      "createdAt": "2026-04-20T18:02:45.000Z"
    }
  ]
}
```

Returns `pending` rows too so the UI can show mid-OAuth state.

---

### `DELETE /api/integrations/connections/:id`

Disconnects and deletes the connection.

**204**.

**Behavior**:
1. Verify row's `userId` matches session.
2. Call Composio disconnect for `composioConnectedAccountId`.
3. Null out `instance_integration.selectedConnectionId` where it references this row (same txn).
4. Delete row.

**Errors**: 404 `CONNECTION_NOT_FOUND`, 502 `UPSTREAM_UNAVAILABLE` (local row not deleted on upstream failure — user sees an actionable error).

---

### `PATCH /api/integrations/connections/:id`

Currently supports re-initiating auth for a `reconnect_required` / `expired` / `revoked` row.

**Body** — `ReconnectRequest`: `{}` (empty body for v1; reserved for future).

**200** — `{ "redirectUrl": "…" }`

Same behavior as `POST /connect` but preserves the row's `id` and returns a fresh `redirectUrl` tied to the existing `composioConnectedAccountId` where the SDK supports it, otherwise treats as new connection and reuses the row `id` with a rotated `composioConnectedAccountId`.

---

### `GET /api/instances/:id/integrations`

Per-instance binding view.

**200** — `InstanceBindingsResponse`:
```json
{
  "bindings": [
    {
      "toolkitSlug": "gmail",
      "enabled": true,
      "selectedConnectionId": "9f7b…",
      "availableConnections": [
        { "id": "9f7b…", "accountLabel": "saul@example.com", "status": "connected" }
      ]
    }
  ]
}
```

Response includes one row per curated toolkit even when `enabled=false` and no row exists in `instance_integration` yet — the UI renders the full grid.

---

### `PATCH /api/instances/:id/integrations/:toolkitSlug`

Updates (or upserts) the per-instance binding.

**Body** — `InstanceBindingUpdate`:
```json
{ "enabled": true, "selectedConnectionId": "9f7b…" }
```

**200** — the updated binding (same shape as one entry of `bindings` above).

**Behavior**:
1. Verify `instance.userId` matches session.
2. If `enabled=true`, require at least one of the user's `composio_connection` rows with `status='connected'` for this toolkit.
3. If the user has >1 connection for this toolkit, `selectedConnectionId` is required and must belong to the session user.
4. Upsert by `(instanceId, toolkitSlug)`.

**Errors**: 400 `NO_CONNECTED_ACCOUNT`, 400 `AMBIGUOUS_ACCOUNT`, 400 `SELECTED_CONNECTION_NOT_OWNED`.

---

### `GET /api/instances/:id/integration-activity`

Returns the last 50 `integration_invocation` rows for the instance.

**200** — `ActivityResponse`:
```json
{
  "invocations": [
    {
      "toolkitSlug": "gmail",
      "actionSlug": "GMAIL_SEND_EMAIL",
      "outcome": "success",
      "errorClass": null,
      "latencyMs": 842,
      "occurredAt": "2026-04-22T14:12:08.000Z"
    }
  ]
}
```

No filtering, no pagination in v1 (hard cap 50). Response is sorted `occurredAt DESC`.

---

## Bot-facing endpoints (InstanceSecret auth)

### `GET /api/instances/:id/tools/manifest`

Returns the tool manifest the bot should register with its LLM. Re-fetch per-turn (FR-012).

**200** — `ManifestResponse`:
```json
{
  "tools": [
    {
      "actionSlug": "GMAIL_SEND_EMAIL",
      "toolkitSlug": "gmail",
      "name": "Gmail — Send Email",
      "description": "…",
      "parameters": { "type": "object", "properties": { /* JSON Schema */ } }
    }
  ]
}
```

**Behavior**:
1. Authenticate via `callbackSecret`.
2. Read `instance_integration` rows for this instance where `enabled=true`.
3. For each, resolve the selected connection (or sole connection) and skip if not `status='connected'`.
4. Call `session.tools()` for the owning user filtered to the enabled toolkit slugs; return the action list.

Responses are intentionally close to JSON Schema tool-definitions so the bot can register them with any LLM framework without translation logic in this feature.

---

### `POST /api/instances/:id/tools/invoke`

Executes an action on behalf of the bot.

**Body** — `InvokeRequest`:
```json
{ "actionSlug": "GMAIL_SEND_EMAIL", "arguments": { "to": "…", "subject": "…", "body": "…" } }
```

**200** — `InvokeResponse`:
```json
{ "outcome": "success", "result": { /* whatever Composio returns */ } }
```

**4xx / 5xx** with `outcome` classified for the bot to reason about:
- `400 NOT_ENABLED` — service off for this instance.
- `409 CONNECTION_UNHEALTHY` — connection moved to `reconnect_required` mid-flight.
- `502 PROVIDER_ERROR` — upstream returned error; `errorClass` populated.
- `401` — bad `callbackSecret`.

**Behavior**:
1. Auth via `callbackSecret`.
2. Resolve the toolkit slug from `actionSlug` (Composio's slugs are self-describing: `GMAIL_SEND_EMAIL` → toolkit `gmail`). Reject if toolkit not in curated 8.
3. Gate: `instance_integration.enabled=true` AND the selected/sole connection is `status='connected'`.
4. Call Composio action execution via the owning user's session.
5. On any Composio auth-class error, mark connection `reconnect_required` and return `CONNECTION_UNHEALTHY`.
6. Append `integration_invocation` row (sensitive fields stripped — `arguments` and `result` never touch the audit path, FR-019).
7. Return the result.

Timeout: 30 s default; actions that legitimately take longer are out of scope for v1 (surfaced as `PROVIDER_ERROR` with `errorClass='TIMEOUT'`).
