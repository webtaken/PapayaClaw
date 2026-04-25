# Quickstart — Composio Integration Layer

A developer-local walkthrough from "fresh branch checkout" to "bot sends a Gmail via the UI." Assumes the project's existing dev setup (DB reachable, Better Auth + Google OAuth configured, a running instance record).

---

## 1. Install new dependency

```bash
npm install @composio/core
```

Add to the Technology Stack record when the constitution is next amended (per Constitution Governance, this is a minor stack addition — track in the PR description).

## 2. Environment variables

Add to `.env.local`:

```
COMPOSIO_API_KEY=<your composio dev key>
COMPOSIO_REDIRECT_URL=http://localhost:3000/api/integrations/callback
```

For staging/prod:

```
COMPOSIO_REDIRECT_URL=https://papayaclaw.com/api/integrations/callback
```

Register the redirect URL once in the Composio dashboard (one URL for all 8 toolkits).

## 3. Apply schema changes

```bash
npx drizzle-kit push
```

Applies `composio_connection`, `instance_integration`, `integration_invocation` plus their indices.

## 4. Start the dev server

```bash
npm run dev
```

Loads the custom Node server via `tsx server.ts` — same as existing dev flow. The new routes live under the same Next.js app.

## 5. Connect Gmail as a signed-in user

1. Sign in at `http://localhost:3000` (Better Auth + Google).
2. Open any instance's detail page, click the **Integrations** tab.
3. In the catalog grid, click **Connect** on the Gmail card.
4. Browser redirects to Google's OAuth consent, you approve.
5. Browser returns to `/api/integrations/callback?composioConnectedAccountId=…` which redirects back to the integrations tab with `?connected=gmail`.
6. The tab shows the Gmail card in **Connected** state and a new row in the Instance Toggles section.

Verify in DB:

```sql
SELECT id, toolkit_slug, status, account_label FROM composio_connection;
```

Expect one row with `status='connected'` and your email in `account_label`.

## 6. Toggle Gmail on for this instance

1. In the same tab, flip the Gmail Switch in the Instance Toggles section to **on**.
2. (If you only have one Gmail connection, the account selector is hidden; otherwise pick one.)
3. Network tab confirms `PATCH /api/instances/:id/integrations/gmail` returned 200.

Verify in DB:

```sql
SELECT toolkit_slug, enabled, selected_connection_id FROM instance_integration
WHERE instance_id = '<your instance id>';
```

## 7. Exercise a bot-facing tool invocation

From a shell, simulate the bot's runtime:

```bash
INSTANCE_ID=<your instance id>
SECRET=<instance.callbackSecret from DB>

# 1. Fetch manifest
curl -s http://localhost:3000/api/instances/$INSTANCE_ID/tools/manifest \
  -H "Authorization: Bearer $SECRET" | jq

# 2. Invoke Gmail send
curl -s http://localhost:3000/api/instances/$INSTANCE_ID/tools/invoke \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"actionSlug":"GMAIL_SEND_EMAIL","arguments":{"recipient_email":"you@example.com","subject":"Hello from PapayaClaw","body":"Test"}}'
```

Expected:
- Manifest contains at least one Gmail action.
- Invoke returns `{ "outcome": "success", "result": {...} }`.
- The email arrives at `you@example.com`.

## 8. Observe the activity panel

Reload the instance's **Integrations** tab. The Activity Panel now shows exactly one row:

| service | action | outcome | time |
|---------|--------|---------|------|
| Gmail   | GMAIL_SEND_EMAIL | success | just now |

Verify in DB:

```sql
SELECT toolkit_slug, action_slug, outcome, latency_ms
FROM integration_invocation
WHERE instance_id = '<your instance id>'
ORDER BY occurred_at DESC LIMIT 5;
```

## 9. Exercise the failure paths

- **Not enabled**: toggle Gmail off, run the invoke again. Expect 400 `NOT_ENABLED`, audit row with `outcome='not_enabled'`.
- **Connection unhealthy**: from the Google account security page, revoke the Composio app. Toggle Gmail back on, run invoke. Expect 409 `CONNECTION_UNHEALTHY`; the UI now shows the Gmail connection as **Reconnect required**.
- **Reconnect**: click **Reconnect** on the Gmail card; re-approve at Google; card returns to **Connected**; invoke succeeds again.

## 10. Clean up

Disconnect via the UI (shows a confirmation dialog listing which instances are affected). Verify:
- Composio side: connection no longer listed for your `user_id` in the Composio dashboard.
- DB: `composio_connection` row gone; `instance_integration.selected_connection_id` nulled where it referenced the deleted row.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| OAuth callback lands on a 404 | `COMPOSIO_REDIRECT_URL` not registered with Composio, or mismatched host |
| `UPSTREAM_UNAVAILABLE` on connect | `COMPOSIO_API_KEY` wrong or missing |
| Manifest empty after connecting | Instance toggle still off, or selected connection is in `pending` |
| Activity panel empty after an invoke | Check DB: if row exists but UI is empty, inspect the SWR cache in devtools |
| `CONNECTION_UNHEALTHY` immediately after reconnect | Browser cached a pre-reconnect manifest response — hard-reload |
