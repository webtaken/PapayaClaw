# VPS Provisioning Lifecycle

This document describes the full lifecycle of creating, monitoring, and tearing down an OpenClaw instance on Hetzner Cloud.

> Source of truth: [`src/lib/cloud-init.ts`](../src/lib/cloud-init.ts), [`src/lib/hetzner.ts`](../src/lib/hetzner.ts), [`src/lib/cloudflare.ts`](../src/lib/cloudflare.ts), [`src/lib/instance-poller.ts`](../src/lib/instance-poller.ts)

---

## Creation Flow

When a user deploys a new instance (`POST /api/instances`):

### 1. Subscription Validation
- Checks that the user has an active subscription without an existing instance bound to it

### 2. SSH Keypair Generation
- Generates an Ed25519 keypair via `crypto.generateKeyPairSync`
- Public key is uploaded to Hetzner; private key is stored encrypted in the database

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
2. Installs OpenClaw CLI (`curl | bash`)
3. Runs `openclaw onboard` with the selected provider/model/API key
4. Patches the OpenClaw config with `jq` (channel, model, UI settings, session config)
5. Handles provider-specific config (e.g., MiniMax custom models block)
6. Restarts the OpenClaw gateway
7. Installs `cloudflared` and configures the Cloudflare Tunnel
8. Installs channel plugins if needed (e.g., `@openclaw/whatsapp`)
9. Writes a sentinel file: `/var/tmp/openclaw-ready` (or `/var/tmp/openclaw-error` on failure)

### 5. Hetzner VPS Creation
- Uploads SSH public key to Hetzner
- Creates a server with:
  - Image: Ubuntu 24.04
  - Server type: varies by plan
  - Location: auto-selected
  - User data: the cloud-init YAML

### 6. Database Record
- Saves the instance with status `deploying` and all metadata (server ID, IP, tunnel ID, SSH key, etc.)

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
- **OpenClaw gateway:** `systemctl --user status openclaw` (as root)

All of these can be accessed via the browser SSH terminal in the dashboard.
