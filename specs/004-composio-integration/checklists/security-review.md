# Security Review Checklist: 004-composio-integration

**Purpose**: Audit-log privacy compliance (FR-019) and auth surface review before merge.

## FR-019 — Audit row must not store action arguments or results

**Rule**: `integration_invocation` rows MUST NOT contain `arguments`, `result`, or any field derived from them. The audit log records only metadata: toolkit, action slug, outcome class, error class (truncated), latency, and timing.

**Test procedure**:
```
grep -n "arguments\|result" src/lib/integrations/invoke-service.ts
```
Verify no grep hit appears inside a `db.insert(integrationInvocation).values(...)` block.

**Current evidence** (as of implementation):
- Line 88: `arguments: args` — passed to `composio.tools.execute()`, NOT to any DB insert
- Line 180: `arguments: args` — same, Composio execution call
- Line 93: `result` typed as return value
- Line 197: `return { outcome: "success", result }` — returned to caller only
- All `db.insert(integrationInvocation).values({...})` blocks (lines 119, 146, 163, 188, 221, 235): contain only `instanceId`, `userId`, `toolkitSlug`, `actionSlug`, `outcome`, `errorClass`, `latencyMs`

**Status**: PASS — no arguments or results written to audit row.

## Auth surface

- [X] Bot-facing routes (`/api/instances/[id]/tools/*`) use `callbackSecret` Bearer auth — no session cookie required
- [X] User-facing routes (`/api/integrations/*`, `/api/instances/[id]/integrations*`) require Better Auth session
- [X] Instance ownership verified before returning/mutating instance data (404 on mismatch, not 403)
- [X] Connection ownership verified in `disconnect` and `reinitiate` before any mutation
- [X] `initiationState` is single-use (nulled on successful callback) — prevents replay

## Privacy

- [X] `errorClass` stored as truncated string (≤200 chars) — no full stack traces
- [X] `integrationLifecycleEvent.connectionId` is a text field (no live FK) — safe if connection deleted
- [X] Composio credentials never stored locally — custody lives at Composio

## Reviewer sign-off

Before merging, a reviewer must:
1. Run `grep -n "arguments\|result" src/lib/integrations/invoke-service.ts` and verify no hits inside `integrationInvocation` insert blocks
2. Confirm `npm run build` passes with 0 TypeScript errors
3. Confirm `npm run lint` shows 0 new errors in `src/lib/integrations/` and `src/app/api/integrations/`
