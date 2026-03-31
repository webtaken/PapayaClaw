# Architecture

This document describes the high-level architecture of PapayaClaw, how the components fit together, and the provisioning lifecycle.

---

## System Overview

```
Browser (React 19 + Next.js App Router)
  |
  v
+-------------------------------------------+
|  Custom Node.js Server (server.ts)        |
|  ├── Next.js 16 (pages + API routes)     |
|  └── Socket.IO (SSH terminal WebSocket)   |
+-------------------------------------------+
  |            |              |            |
  v            v              v            v
Better Auth  PostgreSQL    Hetzner API   Polar.sh
(Google       (Drizzle      (VPS          (Payments &
 OAuth)        ORM)         provisioning)  subscriptions)
                              |
                              v
                        Cloud-Init Script
                        (Ubuntu 24.04 VPS)
                              |
                              v
                       +---------------+
                       |  Hetzner VPS  |
                       |  ├── OpenClaw |
                       |  └── cloudflared
                       +---------------+
                              |
                              v
                       Cloudflare Tunnel
                       (HTTPS proxy)
                              |
                              v
                       Telegram / WhatsApp
```

---

## Key Components

### Custom Server (`server.ts`)

PapayaClaw uses a custom Node.js server instead of `next start` because it needs Socket.IO for the SSH terminal. The server:

1. Creates an HTTP server
2. Attaches Socket.IO with CORS and session authentication
3. Delegates HTTP requests to Next.js
4. Handles SSH WebSocket connections (connect, data, resize, disconnect)

### Authentication

- **Library:** Better Auth with Google OAuth provider
- **Server config:** `src/lib/auth.ts`
- **Client hooks:** `src/lib/auth-client.ts`
- **Session validation:** Used in API routes and Socket.IO handshake

### Database

- **ORM:** Drizzle ORM with PostgreSQL
- **Schema:** `src/lib/schema.ts` — 6 tables (user, session, account, verification, subscription, instance)
- **Migrations:** Auto-generated in `drizzle/` via `drizzle-kit`
- **Client:** `src/lib/db.ts`

See [database.md](./database.md) for the full schema reference.

### VPS Provisioning Pipeline

See [provisioning.md](./provisioning.md) for the complete lifecycle.

### SSH Terminal

Browser-based terminal using xterm.js:

1. Client opens a Socket.IO connection with the instance ID
2. Server validates the user's Better Auth session via cookie
3. Server establishes an SSH connection to the VPS using the stored private key
4. Bidirectional data flow: xterm <-> Socket.IO <-> ssh2 <-> VPS
5. Supports terminal resize events

Implementation: `src/components/dashboard/ssh-terminal.tsx` (client), `server.ts` (server)

### Payments & Subscriptions

- **Provider:** Polar.sh
- **Integration:** `@polar-sh/nextjs`
- **Webhook handler:** `src/app/api/webhook/polar/route.ts`
- **Business rule:** 1 instance per active subscription
- **Plans:** Basic and Pro (configured via `NEXT_PUBLIC_POLAR_*_PRODUCT_ID` env vars)

---

## Request Flow Examples

### Deploy an Instance

1. User fills the 3-step wizard in the dashboard
2. `POST /api/instances` is called with name, model, API key, channel, bot token
3. Server validates the user has an available subscription
4. Server generates an SSH keypair (`crypto.generateKeyPairSync`)
5. Server creates a Cloudflare Tunnel + DNS CNAME record
6. Server generates a cloud-init script (see [provisioning.md](./provisioning.md))
7. Server uploads the SSH public key to Hetzner
8. Server creates a Hetzner VPS with the cloud-init user data
9. Instance is saved to DB with status `deploying`
10. Background poller starts checking for readiness via SSH

### SSH Terminal Session

1. User clicks "Terminal" on an instance detail page
2. xterm.js renders in the browser
3. Socket.IO connects to the server with `instanceId` + auth cookie
4. Server looks up the instance, retrieves the SSH private key
5. ssh2 connects to the VPS IP on port 22
6. Data flows bidirectionally until disconnect

### Telegram Pairing

1. A new Telegram user messages the bot
2. OpenClaw queues a pairing request (DM policy: `pairing`)
3. Instance owner opens the Pairing Dialog in the dashboard
4. `GET /api/instances/[id]/pairing` runs `openclaw telegram list-pairings` via SSH
5. Owner clicks "Approve"
6. `POST /api/instances/[id]/pairing` runs `openclaw telegram approve-pairing <id>` via SSH
