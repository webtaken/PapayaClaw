# Database Schema

PapayaClaw uses **PostgreSQL** with **Drizzle ORM**. The schema is defined in [`src/lib/schema.ts`](../src/lib/schema.ts).

---

## Tables

### `user`

Authentication users, managed by Better Auth.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | text | PK |
| `name` | text | NOT NULL |
| `email` | text | NOT NULL, UNIQUE |
| `emailVerified` | boolean | NOT NULL |
| `image` | text | nullable |
| `createdAt` | timestamp | NOT NULL |
| `updatedAt` | timestamp | NOT NULL |

### `session`

Active user sessions.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | text | PK |
| `expiresAt` | timestamp | NOT NULL |
| `token` | text | NOT NULL, UNIQUE |
| `createdAt` | timestamp | NOT NULL |
| `updatedAt` | timestamp | NOT NULL |
| `ipAddress` | text | nullable |
| `userAgent` | text | nullable |
| `userId` | text | NOT NULL, FK → user.id |

### `account`

OAuth provider accounts (Google).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | text | PK |
| `accountId` | text | NOT NULL |
| `providerId` | text | NOT NULL |
| `userId` | text | NOT NULL, FK → user.id |
| `accessToken` | text | nullable |
| `refreshToken` | text | nullable |
| `idToken` | text | nullable |
| `accessTokenExpiresAt` | timestamp | nullable |
| `refreshTokenExpiresAt` | timestamp | nullable |
| `scope` | text | nullable |
| `password` | text | nullable |
| `createdAt` | timestamp | NOT NULL |
| `updatedAt` | timestamp | NOT NULL |

### `verification`

Email verification tokens.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | text | PK |
| `identifier` | text | NOT NULL |
| `value` | text | NOT NULL |
| `expiresAt` | timestamp | NOT NULL |
| `createdAt` | timestamp | nullable |
| `updatedAt` | timestamp | nullable |

### `subscription`

Polar.sh payment subscriptions.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | text | PK (Polar subscription ID) |
| `user_id` | text | NOT NULL, FK → user.id |
| `polar_customer_id` | text | NOT NULL |
| `product_id` | text | NOT NULL |
| `price_id` | text | nullable |
| `plan_type` | text | NOT NULL (`basic` or `pro`) |
| `status` | text | NOT NULL, default `incomplete` |
| `current_period_start` | timestamp | nullable |
| `current_period_end` | timestamp | nullable |
| `cancel_at_period_end` | boolean | NOT NULL, default `false` |
| `created_at` | timestamp | NOT NULL, default `now()` |
| `updated_at` | timestamp | NOT NULL, default `now()` |

**Status values:** `active`, `canceled`, `past_due`, `revoked`, `incomplete`

### `instance`

Deployed OpenClaw instances.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | text | PK (UUID, auto-generated) |
| `name` | text | NOT NULL |
| `model` | text | NOT NULL |
| `model_api_key` | text | nullable |
| `channel` | text | NOT NULL |
| `bot_token` | text | NOT NULL |
| `channel_phone` | text | nullable |
| `status` | text | NOT NULL, default `deploying` |
| `provider` | text | NOT NULL, default `hetzner` |
| `provider_server_id` | integer | nullable |
| `provider_server_ip` | text | nullable |
| `provider_ssh_key_id` | integer | nullable |
| `callback_secret` | text | nullable |
| `ssh_private_key` | text | nullable |
| `cf_tunnel_id` | text | nullable |
| `cf_dns_record_id` | text | nullable |
| `cf_tunnel_hostname` | text | nullable |
| `subscription_id` | text | nullable, FK → subscription.id |
| `user_id` | text | NOT NULL, FK → user.id |
| `created_at` | timestamp | NOT NULL, default `now()` |
| `updated_at` | timestamp | NOT NULL, default `now()` |

**Status values:** `deploying`, `running`, `stopped`, `error`

---

## Entity Relationships

```
user 1 ──→ N session
user 1 ──→ N account
user 1 ──→ N subscription
user 1 ──→ N instance
subscription 1 ──→ 0..1 instance
```

- A user can have multiple subscriptions and instances
- Each instance is bound to at most one subscription (1:1 business rule enforced in application logic)

---

## Migrations

```bash
# Push schema changes directly to the database
npx drizzle-kit push

# Generate SQL migration files
npx drizzle-kit generate

# Apply generated migrations
npx drizzle-kit migrate
```

Migration files are auto-generated in the `drizzle/` directory.

---

## Configuration

Database connection is configured via the `DATABASE_URL` environment variable in `drizzle.config.ts`:

```
postgresql://user:password@host:port/database
```
