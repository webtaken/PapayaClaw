# Contracts — Composio Integration Layer

Two consumer groups:

1. **Dashboard client** (browser, authenticated via Better Auth session cookie) — manages connections and per-instance toggles, reads activity.
2. **Bot runtime** (OpenClaw instance running on its Hetzner VPS, authenticated via Bearer `callbackSecret` matching `instance.callbackSecret`) — fetches its tool manifest and proxies tool invocations through the platform.

All endpoints are Next.js App Router `route.ts` handlers. All request/response bodies are Zod-validated at the edge (see `schemas.ts`).

Files:
- `rest-api.md` — endpoint reference (paths, methods, auth, status codes, response shapes).
- `schemas.ts` — Zod schema source of truth for all request/response bodies. Checked into the spec alongside the docs; the actual implementation re-imports or inlines these as needed.

Conventions:
- Errors are returned as `{ "error": { "code": "INTEGRATION_UNAVAILABLE", "message": "…" } }` with the appropriate HTTP status. Error codes are a finite enum (see `schemas.ts`).
- Sensitive content (tool args/results) never appears in error `message` fields.
- All timestamps are ISO 8601 with Z.
