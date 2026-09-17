# API Routes

All API routes live under `src/app/api/`. Routes require authentication unless noted otherwise.

---

## Authentication

| Method | Route | Description |
|--------|-------|-------------|
| `*` | `/api/auth/[...all]` | Better Auth catch-all (OAuth flow, sessions, signout) |

Handled entirely by Better Auth — no custom logic.

---

## Instances

### List Instances

```
GET /api/instances
```

Returns all instances owned by the authenticated user.

### Create Instance

```
POST /api/instances
```

**Body:**
```json
{
  "name": "My Bot",
  "model": "claude-sonnet-4-6",
  "modelApiKey": "sk-...",
  "channel": "telegram",
  "botToken": "123456:ABC...",
  "channelPhone": null
}
```

**What it does:**
1. Validates subscription availability (skipped if Polar is not configured — see [Environment Variables](./environment-variables.md))
2. Generates SSH keypair
3. Creates Cloudflare Tunnel + DNS record
4. Generates cloud-init script
5. Creates Hetzner VPS
6. Starts background status polling

**Returns:** `201` with the created instance.

### Get Instance

```
GET /api/instances/[id]
```

Returns a single instance by ID. Must be owned by the authenticated user.

### Update Instance

```
PATCH /api/instances/[id]
```

**Body (partial):**
```json
{
  "name": "New Name",
  "status": "stopped"
}
```

Setting `status` to `stopped` powers off the VPS. Setting it to `running` powers it on.

### Delete Instance

```
DELETE /api/instances/[id]
```

Deletes the instance and cleans up all associated resources (VPS, SSH key, Cloudflare tunnel, DNS record).

### Get Instance Status

```
GET /api/instances/[id]/status
```

Returns the DB status, the live Hetzner VM state and — once the VM is up and setup is no longer in flight — the OpenClaw **gateway health**. VM power state alone does not prove the agent is alive, so the dashboard badge is driven by `health`, not `hetznerStatus`.

Response:

```json
{
  "instanceStatus": "running",
  "hetznerStatus": "running",
  "serverIp": "1.2.3.4",
  "gatewayToken": "...",
  "channels": ["telegram"],
  "whatsappNumbers": [],
  "health": "healthy",
  "healthReason": null,
  "gatewayUp": true,
  "configValid": true,
  "errorSentinel": null
}
```

| `health` | `healthReason` | Meaning |
|----------|----------------|---------|
| `healthy` | `null` | VM running, gateway answers HTTP on `127.0.0.1:18789`, `openclaw config validate` passes |
| `degraded` | `config-invalid` | VM running but the config does not validate (gateway may be crash-looping) |
| `degraded` | `gateway-unreachable` | VM running, config valid, but no HTTP answer from the gateway |
| `down` | `vm-off` | Hetzner reports the VM is not `running` (off, starting, …); no SSH attempted |
| `unknown` | `ssh-unreachable` | VM running but the SSH probe failed |
| `unknown` | `hetzner-unknown` | Hetzner API call failed |

`gatewayUp` / `configValid` / `errorSentinel` are the raw probe values (`null` when no probe ran). `errorSentinel` is the content of `/var/tmp/openclaw-error` written by cloud-init (`config-invalid`, `gateway-timeout`, or a numeric exit code). It is informational only and never affects `health`; a successful restart clears it.

Health is computed per request and never stored. The probe is one SSH command (`src/lib/gateway-health.ts` → `PROBE_SCRIPT`) and runs whenever `hetznerStatus === "running"` and `instanceStatus !== "deploying"` — including DB status `error`, so a broken instance can still be diagnosed and restarted.

---

### Restart Gateway

```
POST /api/instances/[id]/restart
```

Restarts the OpenClaw gateway on the VPS without touching VM power state: `openclaw gateway restart`, falling back to `pkill -f "openclaw gateway"` (systemd `Restart=always` brings it back). Waits up to ~20 s for the gateway to answer HTTP, clears the stale cloud-init error sentinel if it does, then re-probes and returns the fresh health.

Response `200`:

```json
{
  "health": "healthy",
  "healthReason": null,
  "gatewayUp": true,
  "configValid": true,
  "errorSentinel": null
}
```

A `200` with `health: "degraded"` means the restart ran but the agent is still unhealthy — check `healthReason` (typically `config-invalid`).

| Status | When |
|--------|------|
| `400` | Instance has no server IP / SSH key yet |
| `401` | Not authenticated |
| `404` | Instance not found or not accessible (`canAccessInstance`) |
| `500` | Restart command exited non-zero; `detail` carries stderr/stdout |
| `502` | SSH could not connect to the VPS |

No DB writes.

---

## Telegram Pairing

### List Pairing Requests

```
GET /api/instances/[id]/pairing
```

Runs `openclaw telegram list-pairings` via SSH on the VPS. Returns pending pairing requests.

### Approve Pairing Request

```
POST /api/instances/[id]/pairing
```

**Body:**
```json
{
  "pairingId": "abc123"
}
```

Runs `openclaw telegram approve-pairing <id>` via SSH on the VPS.

---

## WhatsApp Numbers

### Add Number

```
POST /api/instances/[id]/whatsapp-numbers
```

**Body:**
```json
{
  "phone": "+1234567890"
}
```

Adds a phone number to the WhatsApp allowlist via SSH.

### Remove Number

```
DELETE /api/instances/[id]/whatsapp-numbers
```

**Body:**
```json
{
  "phone": "+1234567890"
}
```

Removes a phone number from the WhatsApp allowlist via SSH.

---

## Payments (Polar.sh)

### Create Checkout

```
POST /api/checkout
```

Generates a Polar checkout URL for the selected plan and redirects the user.

### Customer Portal

```
GET /api/portal
```

Redirects to the Polar customer portal for subscription management.

### Webhook

```
POST /api/webhook/polar
```

Handles Polar subscription events:
- `subscription.created` — Creates a subscription record
- `subscription.updated` — Updates status, billing period, cancellation
- `subscription.revoked` / `subscription.canceled` — Marks subscription as inactive

Verified via `POLAR_WEBHOOK_SECRET`.
