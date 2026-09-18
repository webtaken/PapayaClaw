# VPS Provisioning Lifecycle

This document describes the full lifecycle of creating, monitoring, and tearing down an OpenClaw instance on Hetzner Cloud.

> Source of truth: [`src/lib/cloud-init.ts`](../src/lib/cloud-init.ts), [`src/lib/hetzner.ts`](../src/lib/hetzner.ts), [`src/lib/cloudflare.ts`](../src/lib/cloudflare.ts), [`src/lib/instance-poller.ts`](../src/lib/instance-poller.ts)

---

## Creation Flow

When a user deploys a new instance (`POST /api/instances`):

### 1. Subscription Validation
- Checks that the user has an active subscription without an existing instance bound to it
- **If Polar is not configured** (no `POLAR_ACCESS_TOKEN` / `POLAR_WEBHOOK_SECRET`), this step is skipped. The instance is created with no subscription linked and defaults to server type `cx22`

### 2. SSH Keypair Generation
- Generates an Ed25519 keypair via `crypto.generateKeyPairSync`
- Public key is uploaded to Hetzner; private key is stored in the database

### 3. Cloudflare Tunnel Setup
- Creates a Cloudflare Tunnel via API (`POST /accounts/{id}/cfe/tunnel`)
- Configures the tunnel to route traffic to `http://localhost:18789` (OpenClaw gateway port)
- Creates a DNS CNAME record pointing `{instance-slug}.papayaclaw.com` to the tunnel

### 4. Cloud-Init Script Generation
The cloud-init script (`src/lib/cloud-init.ts`) runs on first boot of the Ubuntu 24.04 VPS:

1. **bootcmd** — Fixes Hetzner DNS (replaces broken `185.12.64.x` resolvers with `1.1.1.1` / `8.8.8.8`)
2. **packages** — Installs `jq` via apt
3. **write_files** — Writes the setup script to `/run/openclaw-setup.sh`
4. **runcmd** — Executes the setup script with bash

The setup script then:
1. Waits for DNS resolution (up to 60s)
2. Installs the pinned OpenClaw CLI (`install.sh --version $OPENCLAW_VERSION`, default `2026.9.4`)
3. Runs `openclaw onboard` with the selected provider/API key (xtrace is off around this line so the key and gateway token never reach the setup log)
4. Patches the OpenClaw config with `jq` using the 2026.9 schema:
   - `channels.telegram` / `channels.whatsapp`
   - `agents.defaults.model.primary` (normalized — a duplicated `openrouter/` prefix is collapsed) and, for OpenRouter, `agents.defaults.thinkingDefault = "off"` (thinking + tool continuations through OpenRouter's chat-completions API fail with "incomplete or malformed tool call")
   - `agents.entries.main.identity.name` (the old `ui.assistant` key is retired in 2026.9 and makes the whole config invalid)
   - `memory.search.provider = "none"` (default is OpenAI embeddings, which we have no key for)
   - `tools.deny = ["ask_user"]` (blocks the run waiting for a Control UI answer — never wanted on a chat channel)
   - `gateway.controlUi.enabled` + `allowedOrigins` (device auth can no longer be disabled; the old flag is retired)
5. Handles provider-specific config (e.g., MiniMax custom models block)
6. Runs `openclaw config validate` — on failure writes `/var/tmp/openclaw-error` (`config-invalid`) and exits
7. Restarts the OpenClaw gateway (`openclaw gateway restart`, `pkill` fallback) and waits up to 2 min — on timeout writes `/var/tmp/openclaw-error` (`gateway-timeout`) and exits
8. Installs `cloudflared` and configures the Cloudflare Tunnel
9. Installs channel plugins if needed (e.g., `@openclaw/whatsapp`)
10. Writes a sentinel file: `/var/tmp/openclaw-ready`

Why validate: the gateway refuses to hot-reload an invalid file and silently keeps the pre-patch config (no channels, `openrouter/auto`), while the VM reports as running. That was the failure behind the 2026-09-16 Bigotito incident.

### 5. Hetzner VPS Creation
- Uploads SSH public key to Hetzner
- Creates a server with:
  - Image: Ubuntu 24.04
  - Server type: varies by plan (`basic` → `cx23`, `pro` → `cx33`, see `PLAN_SERVER_TYPE` in `src/lib/polar.ts`)
  - Location: first location with stock, in preference order (see below)
  - User data: the cloud-init YAML

#### Location fallback

`createServer` in `src/lib/hetzner.ts` never hardcodes a location. It walks the preference list from `HETZNER_LOCATIONS` (default `hel1,nbg1,fsn1`) and keeps the server type fixed:

1. **Pre-check** — `GET /v1/server_types?name=<type>` returns `locations[].available`. Locations reported `false` are skipped (logged as `[createServer] skipping <loc>: … (pre-check)`). If the pre-check request itself fails, all locations are tried in order — the pre-check is advisory. (The older `datacenters[].server_types.available` field is deprecated by Hetzner; it is not used.)
2. **Create** — `POST /v1/servers` with `location: <loc>`. If Hetzner answers `412 resource_unavailable` (its out-of-stock code), the next location is tried (`[createServer] <loc> out of stock … trying next location`). Any other error is rethrown unchanged.
3. **Success** — logged as `[createServer] Server <id> created in <loc> (pre-check | fallback after <prev>: resource_unavailable)`. The chosen location is stored on the instance row as `provider_location`.
4. **No stock anywhere** — throws `HetznerNoCapacityError` ("No Hetzner capacity for server type <type> in any configured location (…)"). `POST /api/instances` returns it as **503** with that message so the deploy dialog shows it; the Polar webhook logs it under `[Polar Webhook] Provisioning failed for order …`.

Cloudflare tunnel and DNS setup do not depend on the location.

Follow-ups (not implemented): server-type fallback (e.g. `cx23` → `cpx22`) when the whole CX line is out of stock; treating `placement_error` (422) as retriable; persisting failed provisioning attempts so paid-but-unprovisioned orders are visible to staff instead of only in logs.

**Retry on no capacity.** When every location is out of stock, `createServer`
re-runs the full walk up to `NO_CAPACITY_MAX_ATTEMPTS` (3) times with
`NO_CAPACITY_RETRY_DELAY_MS` (20 s) between attempts, then throws
`HetznerNoCapacityError` (`code: "no_capacity"`). `POST /api/instances` maps it
to **503** `{ error, code: "no_capacity", serverType, retryAfterSeconds: 120 }`
plus a `Retry-After: 120` header; the deploy dialog shows a localized toast with
a Retry action. The Polar webhook path uses the same retry.

**Capacity badge is a quota, not stock.** `/api/capacity` reports
`HETZNER_SERVER_LIMIT − count(instance)`. It says nothing about Hetzner's live
inventory; a non-zero badge can coexist with a no-capacity 503.

### 6. Database Record
- Saves the instance with status `deploying` and all metadata (server ID, IP, tunnel ID, SSH key, etc.)

---

## Checkout states (paid but no instance yet)

`order.paid` upserts the subscription row from the order payload and links the
instance by `order.subscriptionId`, so `subscription.created` ordering no longer
matters. The dashboard derives a `checkoutState` (`src/lib/checkout-state.ts`)
from the user's latest `pending_instance_config`:

| pending config | subscription available | instances | state | UI |
|---|---|---|---|---|
| unconsumed, < 15 min old | yes | 0 | `pending` | "Setting up…" banner, deploy disabled, page auto-refreshes |
| consumed < 2 min ago | yes | 0 | `pending` | same banner — provisioning may not have inserted the instance row yet |
| consumed 2 min – 24 h ago | yes | 0 | `failed` | error banner + Retry (direct deploy, no second charge) |
| consumed > 24 h ago | — | — | `none` | stale (e.g. the user deleted the server days later) |
| anything else | — | — | `none` | normal |

The `failed` verdict is bounded on both sides (`FAILED_GRACE_MS` = 2 min,
`FAILED_MAX_AGE_MS` = 24 h): "consumed with no instance row" means *provisioning
failed* only inside that window — before it, provisioning is probably still
running; after it, the user most likely deleted a server that did get created.

`POST /api/instances` runs the same derivation for non-staff users on the Polar
path and answers `409 checkout_pending` (with `Retry-After: 30`) while the state
is `pending`, so a stale tab cannot deploy a second server during that window.

Provisioning failure inside the webhook is still only logged; the `failed`
state is what makes it visible to the user.

---

## Status Polling

After creation, a background poller (`src/lib/instance-poller.ts`) monitors the deployment:

- **Method:** SSH into the VPS every 15 seconds
- **Checks for:** Sentinel files at `/var/tmp/openclaw-ready` or `/var/tmp/openclaw-error`
- **Timeout:** 6 minutes (24 attempts)
- **On success:** Updates instance status to `running`
- **On failure:** Updates instance status to `error`
- **On timeout:** Updates instance status to `error`

The frontend polls `GET /api/instances/[id]/status` to reflect the current state.

### Gateway health

Once the VM is `running` and the DB status is no longer `deploying`, the status endpoint also probes the OpenClaw gateway in one SSH command (`PROBE_SCRIPT` in `src/lib/gateway-health.ts`):

```sh
export XDG_RUNTIME_DIR=/run/user/0 PATH="/root/.local/bin:/usr/local/bin:/usr/bin:$PATH"
echo "GATEWAY=$(curl -s -o /dev/null -m 5 -w '%{http_code}' http://127.0.0.1:18789/ 2>/dev/null || echo 000)"
openclaw config validate >/dev/null 2>&1; echo "CONFIG=$?"
echo "SENTINEL=$(cat /var/tmp/openclaw-error 2>/dev/null || echo none)"
```

- **Gateway up** = curl got *any* HTTP status (a `401` on `/` still proves the process is alive). `000` = nothing listening.
- **Config valid** = `openclaw config validate` exited 0. Invalid config wins as the reason (it is the root cause of a dead gateway).
- **Sentinel** = `/var/tmp/openclaw-error` is written once by cloud-init and never cleared, so it is shown as detail only and never drives health. A successful dashboard restart removes it.

The result surfaces as `health` (`healthy | degraded | down | unknown`) — see `docs/api-routes.md`. The instance detail header badge shows **this**, not the VM power state: a powered-on VM with a dead gateway reads **DEGRADED** with the reason underneath. The raw Hetzner state is shown separately in the General tab telemetry band.

Polling cadence in the dashboard: 10 s while deploying / VM transitioning, 30 s while degraded or unknown, 60 s while healthy, none while the VM is off.

---

## Instance Lifecycle States

```
deploying  ──→  running  ──→  stopped  ──→  running
    │                              │
    └──→  error                    └──→  (deleted)
```

| Status | Meaning |
|--------|---------|
| `deploying` | VPS created, cloud-init running |
| `running` | Sentinel file detected, OpenClaw is live |
| `stopped` | User stopped the instance (VPS powered off) |
| `error` | Cloud-init failed or polling timed out |

---

## Start / Stop

- **Stop** (`PATCH /api/instances/[id]` with `status: "stopped"`): Powers off the Hetzner VPS via API
- **Start** (`PATCH /api/instances/[id]` with `status: "running"`): Powers on the Hetzner VPS via API

---

## Deletion

When a user deletes an instance (`DELETE /api/instances/[id]`):

1. **Hetzner VPS** — Deleted via API
2. **Hetzner SSH Key** — Deleted via API
3. **Cloudflare DNS Record** — Deleted via API
4. **Cloudflare Tunnel** — Deleted via API
5. **Database Record** — Deleted from the `instance` table
6. **Subscription** — Unbound (available for a new instance)

All cleanup steps are best-effort — if one fails, the others still execute.

---

## Debugging

- **Setup logs on the VPS:** `cat /var/log/openclaw-setup.log`
- **OpenClaw config:** `cat /root/.openclaw/openclaw.json`
- **Sentinel files:** `ls /var/tmp/openclaw-*`
- **Cloudflared status:** `systemctl status cloudflared`
- **OpenClaw gateway:** `systemctl --user status openclaw-gateway` (as root; `export XDG_RUNTIME_DIR=/run/user/0` first), or `openclaw gateway status` / `openclaw gateway restart`
- **Gateway journal:** `journalctl --user -u openclaw-gateway --since "1 hour ago"` — look for `[reload] config reload skipped (invalid config)` and `embedded run agent end: ... isError=true ... rawError=`
- **Config validity:** `openclaw config validate` (and `openclaw doctor --fix` to migrate legacy keys)
- **Badge says DEGRADED:** the reason under the badge tells you which signal failed. `Config invalid` → run `openclaw config validate` on the VPS and fix `/root/.openclaw/openclaw.json`; `Gateway not responding` → check the gateway journal, then use **Restart agent** in the General tab (`POST /api/instances/[id]/restart`). The restart response reports the post-restart health, so a still-degraded result means the config is still broken, not that the restart failed.
- **Badge says UNKNOWN:** the VM is up but the SSH probe (or the Hetzner API) failed — check `sshd`, the firewall, or Hetzner status before assuming the agent is down.

All of these can be accessed via the browser SSH terminal in the dashboard.
