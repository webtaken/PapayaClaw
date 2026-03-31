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
1. Validates subscription availability
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

Returns the current status of an instance. Used by the frontend to poll during deployment.

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
