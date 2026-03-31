# Environment Variables

All required environment variables are listed in [`.env.example`](../.env.example). Copy it to `.env.development.local` for local development.

```bash
cp .env.example .env.development.local
```

---

## Reference

### Database

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string. Format: `postgresql://user:pass@host:port/dbname` |

### Authentication

| Variable | Required | Description |
|----------|----------|-------------|
| `BETTER_AUTH_SECRET` | Yes | Random 32+ character string for session encryption. Generate with `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | Yes | Server-side base URL (e.g., `http://localhost:3000`) |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | Yes | Client-side base URL (same as above in development) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID from [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |

**Google OAuth setup:**
1. Go to Google Cloud Console > APIs & Services > Credentials
2. Create an OAuth 2.0 Client ID (Web application)
3. Add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI
4. Copy the client ID and secret

### Hetzner Cloud

| Variable | Required | Description |
|----------|----------|-------------|
| `HETZNER_API_TOKEN` | Yes | API token from [Hetzner Cloud Console](https://console.hetzner.cloud/) > Security > API Tokens |

Create a token with **Read & Write** permissions.

### Cloudflare

| Variable | Required | Description |
|----------|----------|-------------|
| `CLOUDFLARE_API_TOKEN` | Yes | API token with `Zone:DNS:Edit` and `Account:Cloudflare Tunnel:Edit` permissions |
| `CLOUDFLARE_ZONE_ID` | Yes | Found in your domain's Overview page on the Cloudflare dashboard |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | Found in the Cloudflare dashboard URL or account overview |

**Token permissions needed:**
- Zone > DNS > Edit
- Account > Cloudflare Tunnel > Edit
- Account > Cloudflare Tunnel > Read

### Polar.sh Payments (Optional)

> **OSS / dev mode:** If `POLAR_ACCESS_TOKEN` and `POLAR_WEBHOOK_SECRET` are not set, the subscription check is bypassed entirely. Instances are created with no subscription linked and default to the smallest server type (`cx22`). This lets contributors run the project without setting up Polar.

| Variable | Required | Description |
|----------|----------|-------------|
| `POLAR_ACCESS_TOKEN` | No | API access token from [Polar dashboard](https://polar.sh) > Settings > Developers |
| `POLAR_WEBHOOK_SECRET` | No | Webhook signing secret (configured when creating the webhook endpoint) |
| `POLAR_SERVER` | No | `sandbox` for testing, `production` for live payments |
| `NEXT_PUBLIC_POLAR_BASIC_PRODUCT_ID` | No | Product ID for the Basic subscription plan |
| `NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID` | No | Product ID for the Pro subscription plan |

**Polar setup (only needed if you want subscription-gated instance creation):**
1. Create an organization on [polar.sh](https://polar.sh)
2. Create two products (Basic and Pro plans)
3. Set up a webhook pointing to `https://yourdomain.com/api/webhook/polar`
4. Use the sandbox environment for development

### App

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | Yes | Public-facing URL of the app (e.g., `http://localhost:3000`) |

---

## Production vs Development

| Variable | Development | Production |
|----------|------------|------------|
| `BETTER_AUTH_URL` | `http://localhost:3000` | `https://papayaclaw.com` |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | `http://localhost:3000` | `https://papayaclaw.com` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `https://papayaclaw.com` |
| `POLAR_SERVER` | `sandbox` | `production` |

All other variables use the same format in both environments (just different values/credentials).
