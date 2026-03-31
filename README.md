# PapayaClaw

A managed deployment platform for [OpenClaw](https://github.com/openclaw/openclaw) — an open-source personal AI assistant. PapayaClaw enables non-technical users to deploy secure, self-hosted OpenClaw instances to dedicated Hetzner Cloud VPS servers in minutes, without requiring SSH, Docker, or YAML knowledge.

**Think of it as "Heroku for OpenClaw."**

---

## Features

- **3-Step Deploy Wizard** — Pick a model, pick a channel, deploy
- **Automated VPS Provisioning** — Hetzner Cloud + cloud-init, fully hands-off
- **Cloudflare Tunneling** — Automatic HTTPS via `instance-xyz.papayaclaw.com`
- **Browser SSH Terminal** — Debug instances directly from the dashboard
- **Subscription Management** — Polar.sh payments with Basic & Pro plans
- **Internationalization** — English and Spanish (next-intl)
- **Blog System** — MDX-based, multilingual

### AI Providers & Channels

| Providers | Channels |
|-----------|----------|
| Anthropic (Claude), OpenAI (GPT), Z.AI (GLM), Mistral, MiniMax, OpenRouter, OpenCode Zen | Telegram, WhatsApp (Discord & Slack planned) |

See [docs/providers-and-models.md](docs/providers-and-models.md) and [docs/channels.md](docs/channels.md) for full details.

---

## Tech Stack

**Frontend:** Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, xterm.js, SWR, next-intl
**Backend:** Custom Node.js server (Socket.IO + Next.js), Drizzle ORM, PostgreSQL, Better Auth (Google OAuth)
**Infrastructure:** Hetzner Cloud, Cloudflare Tunnels, Polar.sh, ssh2, OpenTelemetry
**Deployment:** Railway

---

## Getting Started

### Prerequisites

- **Node.js** 20+
- **Yarn** 1.22+
- **PostgreSQL** 14+

### Installation

```bash
# Clone
git clone https://github.com/yourusername/papayaclaw.git
cd papayaclaw

# Install dependencies
yarn install

# Set up environment variables
cp .env.example .env.development.local
# Edit .env.development.local with your credentials (see docs/environment-variables.md)

# Push the database schema
npx drizzle-kit push

# Start development server
yarn dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Description |
|---------|-------------|
| `yarn dev` | Start development server |
| `yarn build` | Build for production |
| `yarn start` | Start production server |
| `yarn lint` | Run ESLint |

---

## Environment Variables

Copy `.env.example` to `.env.development.local`. You'll need credentials for:

- **PostgreSQL** — `DATABASE_URL`
- **Google OAuth** — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- **Better Auth** — `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- **Hetzner Cloud** — `HETZNER_API_TOKEN`
- **Cloudflare** — `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_ACCOUNT_ID`
- **Polar.sh** — `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, product IDs

See [docs/environment-variables.md](docs/environment-variables.md) for the full reference with setup instructions.

---

## Project Structure

```
papayaclaw/
├── src/
│   ├── app/
│   │   ├── api/                    # API routes (auth, instances, payments)
│   │   └── [locale]/               # Pages (landing, pricing, blog, dashboard)
│   ├── components/
│   │   ├── dashboard/              # Deploy wizard, instance cards, SSH terminal, pairing
│   │   ├── ui/                     # shadcn/ui primitives
│   │   └── ...                     # Landing page sections
│   ├── lib/                        # Core logic (DB, auth, Hetzner, Cloudflare, SSH, AI config)
│   ├── content/blog/               # MDX blog posts (en + es)
│   └── i18n/                       # Internationalization config
├── docs/                           # Detailed documentation (see below)
├── drizzle/                        # Auto-generated database migrations
├── messages/                       # Translation files (en.json, es.json)
├── server.ts                       # Custom Node.js server (Socket.IO + Next.js)
└── .env.example                    # Environment variable template
```

---

## Documentation

Detailed documentation lives in the [`docs/`](docs/) folder:

| Document | Description |
|----------|-------------|
| [Providers & Models](docs/providers-and-models.md) | Supported AI providers, model list, how to add new ones |
| [Channels](docs/channels.md) | Communication channels (Telegram, WhatsApp), setup and pairing workflows |
| [Architecture](docs/architecture.md) | System overview, component diagram, request flow examples |
| [Provisioning](docs/provisioning.md) | VPS creation lifecycle, cloud-init, status polling, debugging |
| [Database](docs/database.md) | Full schema reference, entity relationships, migration commands |
| [API Routes](docs/api-routes.md) | All endpoints with request/response formats |
| [Environment Variables](docs/environment-variables.md) | Complete variable reference with setup guides |

---

## Deployment

### Railway (Current)

Configured via `railway.json`:

- **Build:** `npm run build`
- **Pre-deploy:** `npx drizzle-kit push` (runs migrations)
- **Start:** `NODE_ENV=production tsx server.ts`
- **Health check:** `GET /` (300s timeout)

Set all environment variables from `.env.example` in the Railway dashboard.

> The custom `server.ts` is required (not `next start`) because Socket.IO is needed for the SSH terminal.

### Manual

```bash
yarn build
npx drizzle-kit push
NODE_ENV=production tsx server.ts
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Read the relevant [docs](docs/) for the area you're changing
4. Run `yarn lint` before committing
5. Open a Pull Request

---

## License

TBD
