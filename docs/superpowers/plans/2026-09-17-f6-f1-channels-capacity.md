# F6 Channels Error Clarity + F1 Hetzner No-Capacity UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> At execution start, copy this file to `docs/superpowers/plans/2026-09-17-f6-f1-channels-capacity.md` so the plan travels with the repo.

**Goal:** Make pairing/agents/reconfigure failures diagnosable (typed error codes, localized UI, fixed pairing source), and make Hetzner out-of-stock survivable during the 100–150 person workshop (retry, localized retry toast, paid-but-unprovisioned banner, honest quota badge).

**Architecture:** Pure, relative-import-only modules in `src/lib` hold every decision (error classification, shell script building, pairing parsing, checkout-state derivation, retry loop) so they're unit-testable without the `@/` alias or DB mocks. Route handlers become thin: call helper, `catch → toErrorResponse`. UI maps `body.code` → next-intl key. Webhook upserts the subscription from the `order.paid` payload so the instance is always linked and the dashboard can derive "paid but failed" from existing columns.

**Tech Stack:** TypeScript 5 strict, Next.js 16 App Router, Drizzle/Postgres (no schema change), ssh2, vitest 4 (node env, `src/**/*.test.ts`, no `@/` alias), next-intl (`messages/en.json`, `messages/es.json` must stay key-identical), shadcn new-york semantic tokens, Sonner 2.0.7, SWR.

**Spec:** No separate spec file. Requirements were agreed in the 2026-09-17 conversation; the "Context" and "Agreed decisions" sections below are the spec.

## Context

- **Pairing panel is broken today.** `listPairingRequests` (`src/lib/ssh.ts:121`) reads `~/.openclaw/credentials/<channel>-pairing.json`. OpenClaw ≥2026.4.29 stores pairing in SQLite (`~/.openclaw/state/openclaw.sqlite`) and deletes the legacy file after import. On every 2026.9.4 VPS the panel shows "no requests" forever. Verified against openclaw repo tag v2026.9.4: `openclaw pairing list <channel> --json` prints `{"channel":"telegram","requests":[{id,code,createdAt,lastSeenAt,meta?}]}`; Telegram `meta` = `{senderId, username?, firstName?, lastName?, accountId}`. CLI errors → non-zero exit, message on stderr.
- **Opaque errors.** Pairing route: any throw → 502; JSON parse errors swallowed to `[]`; `channel` query param interpolated into shell unsanitized (injection). Agents route: every failure → 502. Reconfigure: non-zero → 500 with raw stderr; on 2026.9 `openclaw onboard` refuses when config is already invalid, so users get a useless 500; API key interpolated in double quotes into bash (injection); restart via `pkill`.
- **Hetzner no-capacity.** `createServer` (`src/lib/hetzner.ts:303`) walks `HETZNER_LOCATIONS` once and throws `HetznerNoCapacityError` (English). Route → 503 `{error}`; deploy dialog toasts raw English. Badge "Quedan {count} servidores disponibles" is `HETZNER_SERVER_LIMIT − count(instance)` = account quota, not stock.
- **Webhook path loses paid users.** `order.paid` handler links the instance to "newest subscription by customer id" (may be undefined → unlinked instance → user can deploy a second one free). On provisioning failure it only `console.error`s; user paid, sees nothing.
- **CLI env.** OpenClaw CLI on VPS needs `export XDG_RUNTIME_DIR=/run/user/0 PATH="/root/.local/bin:/usr/local/bin:/usr/bin:$PATH"` — already exported as `OPENCLAW_ENV` in `src/lib/gateway-health.ts:36`. F4 already provides `checkGatewayHealth(host,key,exec?)` and `restartGateway(host,key,exec?)` in `src/lib/ssh.ts:354-386` (injectable `ExecFn`).

### Agreed decisions (from the conversation)

1. Pairing: **manual refresh only, no polling.** Source = `openclaw pairing list <channel> --json`.
2. Webhook failure → **dashboard banner** ("paid, couldn't create server, retry — no extra charge"); support handles the rest at the workshop.
3. Retry budget is fine (Railway, long-lived Node). Quota env already raised to 115.
4. Fix reconfigure API-key shell injection in this pass.
5. Include `POST pairing` (approve) in the error-code mapping.
6. Webhook: `order.paid` upserts the subscription row from `order.subscription` and links by `order.subscriptionId`; `subscription.created` keeps upserting (version B). No schema change; dashboard derives checkout state from `pending_instance_config.consumedAt`.

## Global Constraints

- TypeScript strict; `npx tsc --noEmit` clean.
- `npx eslint <changed files>` clean (repo has ~45 pre-existing lint errors elsewhere; only changed files must be clean).
- `npm test` green.
- New `src/lib` modules use **relative imports only** (vitest has no `@/` alias). Route/UI files keep using `@/`.
- Both `messages/en.json` and `messages/es.json` get every new key (next-intl throws on missing keys in dev). Keep key order parallel.
- shadcn semantic tokens (`text-foreground`, `bg-card`, `border-border`, `text-muted-foreground`, `text-destructive`…) — no raw hex.
- No DB schema change. No new provider.
- Server-side `error` strings stay English (existing convention); UI localizes by `code`.
- Do not commit unless the user asks. Each task ends with a "Commit" step **only if the user has asked for commits**; otherwise stop at the verification step.

---

## File map

| File | Responsibility |
|---|---|
| `src/lib/ssh-errors.ts` (new) | `SshUnreachableError`, `CliError` |
| `src/lib/api-errors.ts` (new) | `ConfigInvalidError`, `InvalidInputError`, `API_ERROR_CODES`, `toErrorResponse`, `stderrTail` |
| `src/lib/pairing.ts` (new) | `PAIRING_CHANNELS`, `assertPairingChannel`, `assertPairingCode`, `parsePairingListOutput` |
| `src/lib/reconfigure-script.ts` (new) | `RECONFIGURE_EXIT`, `buildReconfigureScript`, `envVarNameFor` |
| `src/lib/checkout-state.ts` (new) | `deriveCheckoutState` |
| `src/lib/ssh.ts` | `executeCommand` wraps connection errors; pairing/agents helpers throw typed errors, take `exec` |
| `src/lib/hetzner.ts` | `createServer` retry loop; `HetznerNoCapacityError.code`; retry constants |
| `src/lib/provision-instance.ts` | pass retry options |
| `src/app/api/instances/[id]/{pairing,agents,reconfigure}/route.ts` | thin handlers, `toErrorResponse` |
| `src/app/api/instances/route.ts` | 503 body with `code`, `retryAfterSeconds`, `Retry-After` |
| `src/app/api/webhook/polar/route.ts` | subscription upsert from order, `isNull` consume guard |
| `src/app/[locale]/dashboard/page.tsx` | load latest pending config, pass `checkoutState` |
| `src/components/dashboard/dashboard-content.tsx` | pending/failed banner, auto-refresh, disable deploy while pending |
| `src/components/dashboard/deploy-dialog.tsx` | no-capacity toast with Retry action |
| `src/components/dashboard/instance-detail.tsx`, `tabs/channels-tab.tsx`, `tabs/agents-tab.tsx`, `pairing-dialog.tsx`, `model-provider-module.tsx` | localized error by code |
| `src/components/capacity-badge.tsx` | quota copy + hint |
| `messages/en.json`, `messages/es.json` | new keys |
| `docs/provisioning.md`, `docs/channels.md`, `docs/api-routes.md` | docs |

---

### Task 1: Typed SSH errors + `executeCommand` wrapping

**Files:**
- Create: `src/lib/ssh-errors.ts`
- Modify: `src/lib/ssh.ts:1-82` (imports, `executeCommand`)
- Test: `src/lib/ssh-errors.test.ts` (new), `src/lib/ssh.test.ts` (append)

**Interfaces:**
- Produces: `class SshUnreachableError extends Error { level?: string }`, `class CliError extends Error { code: number; stdout: string; stderr: string }`, `executeCommand(host, privateKey, command, createClient?: () => Client)`.

- [ ] **Step 1: Write the error classes**

```ts
// src/lib/ssh-errors.ts
/**
 * Error classes that let API routes distinguish "we never reached the VPS"
 * from "the VPS answered but the command failed".
 */

/** SSH connect / handshake / auth / channel-open failure. Nothing ran. */
export class SshUnreachableError extends Error {
  /** ssh2 error level (client-socket, client-timeout, client-authentication, ...). */
  readonly level: string | undefined;

  constructor(message: string, options?: { cause?: unknown; level?: string }) {
    super(message, { cause: options?.cause });
    this.name = "SshUnreachableError";
    this.level = options?.level;
  }
}

/** The command ran on the VPS and exited non-zero (or printed garbage). */
export class CliError extends Error {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;

  constructor(
    message: string,
    details: { code: number; stdout: string; stderr: string },
  ) {
    super(message);
    this.name = "CliError";
    this.code = details.code;
    this.stdout = details.stdout;
    this.stderr = details.stderr;
  }
}
```

- [ ] **Step 2: Write the failing test for `executeCommand` classification**

Append to `src/lib/ssh.test.ts` (add `import { EventEmitter } from "node:events";`, `import type { Client } from "ssh2";`, `import { SshUnreachableError } from "./ssh-errors";`, and add `executeCommand` to the `./ssh` import):

```ts
class FakeStream extends EventEmitter {
  stderr = new EventEmitter();
}

type Behaviour = "refuse" | "timeout" | "exec-fail" | "ok";

function fakeClient(behaviour: Behaviour, exitCode: number | null = 0): Client {
  const c = new EventEmitter() as EventEmitter & {
    connect: () => void;
    exec: (cmd: string, cb: (err: Error | undefined, s: FakeStream) => void) => void;
    end: () => void;
  };
  c.end = () => {};
  c.exec = (_cmd, cb) => {
    if (behaviour === "exec-fail") {
      cb(new Error("Channel open failure"), undefined as unknown as FakeStream);
      return;
    }
    const s = new FakeStream();
    cb(undefined, s);
    setImmediate(() => {
      s.emit("data", Buffer.from("OUT"));
      s.stderr.emit("data", Buffer.from("ERR"));
      s.emit("close", exitCode);
    });
  };
  c.connect = () => {
    setImmediate(() => {
      if (behaviour === "refuse") {
        c.emit("error", Object.assign(new Error("connect ECONNREFUSED"), { level: "client-socket" }));
      } else if (behaviour === "timeout") {
        c.emit("error", Object.assign(new Error("Timed out while waiting for handshake"), { level: "client-timeout" }));
      } else {
        c.emit("ready");
      }
    });
  };
  return c as unknown as Client;
}

describe("executeCommand error classification", () => {
  it("wraps connection refusal in SshUnreachableError with the ssh2 level", async () => {
    const err = await executeCommand("1.2.3.4", "KEY", "true", () => fakeClient("refuse")).catch((e) => e);
    expect(err).toBeInstanceOf(SshUnreachableError);
    expect(err.level).toBe("client-socket");
    expect(err.message).toContain("1.2.3.4");
  });

  it("wraps handshake timeout in SshUnreachableError", async () => {
    await expect(
      executeCommand("1.2.3.4", "KEY", "true", () => fakeClient("timeout")),
    ).rejects.toBeInstanceOf(SshUnreachableError);
  });

  it("wraps exec channel failure in SshUnreachableError", async () => {
    await expect(
      executeCommand("1.2.3.4", "KEY", "true", () => fakeClient("exec-fail")),
    ).rejects.toBeInstanceOf(SshUnreachableError);
  });

  it("resolves non-zero exit as a normal result (not an error)", async () => {
    const result = await executeCommand("1.2.3.4", "KEY", "false", () => fakeClient("ok", 3));
    expect(result).toEqual({ stdout: "OUT", stderr: "ERR", code: 3 });
  });

  it("treats a signal-killed process (null exit code) as failure code 1", async () => {
    const result = await executeCommand("1.2.3.4", "KEY", "x", () => fakeClient("ok", null));
    expect(result.code).toBe(1);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/ssh.test.ts`
Expected: FAIL — `executeCommand` does not accept a 4th argument / `SshUnreachableError` not thrown.

- [ ] **Step 4: Implement `executeCommand` wrapping**

Replace `src/lib/ssh.ts:33-82` with:

```ts
import { SshUnreachableError } from "./ssh-errors";
// (add to the existing import block at the top of the file)

/**
 * Executes a command on a remote server over SSH.
 *
 * Rejects with SshUnreachableError when the connection, handshake, auth or
 * channel open fails (nothing ran). A non-zero exit code is NOT an error here —
 * callers decide what it means. `createClient` is injectable for tests.
 */
export function executeCommand(
  host: string,
  privateKey: string,
  command: string,
  createClient: () => Client = () => new Client(),
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const conn = createClient();
    const fail = (err: Error & { level?: string }) =>
      reject(
        new SshUnreachableError(`SSH to ${host} failed: ${err.message}`, {
          cause: err,
          level: err.level,
        }),
      );

    conn
      .on("ready", () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end();
            return fail(err);
          }

          let stdout = "";
          let stderr = "";

          stream
            .on("close", (code: number | null) => {
              conn.end();
              // null = killed by signal → treat as failure, never success.
              resolve({ stdout, stderr, code: code ?? 1 });
            })
            .on("error", (e: Error) => {
              conn.end();
              fail(e);
            })
            .on("data", (data: Buffer) => {
              stdout += data.toString();
            })
            .stderr.on("data", (data: Buffer) => {
              stderr += data.toString();
            });
        });
      })
      .on("error", fail)
      .connect({
        host,
        port: 22,
        username: "root",
        privateKey,
        readyTimeout: 10000,
      });
  });
}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run src/lib/ssh.test.ts && npx tsc --noEmit`
Expected: PASS; no type errors. (`ExecFn` callers are unaffected: a function with an extra optional parameter is assignable to `ExecFn`.)

---

### Task 2: `toErrorResponse` mapping helper

**Files:**
- Create: `src/lib/api-errors.ts`
- Test: `src/lib/api-errors.test.ts`

**Interfaces:**
- Consumes: `SshUnreachableError`, `CliError` from `./ssh-errors`.
- Produces:
  - `type ApiErrorCode = "ssh_unreachable" | "cli_error" | "config_invalid" | "invalid_channel" | "invalid_code" | "internal"`
  - `const API_ERROR_CODES: readonly ApiErrorCode[]`, `isApiErrorCode(x: unknown): x is ApiErrorCode`
  - `class ConfigInvalidError extends Error { detail: string }`
  - `class InvalidInputError extends Error { code: "invalid_channel" | "invalid_code" }`
  - `stderrTail(text: string, max = 500): string`
  - `toErrorResponse(err: unknown): { status: number; body: { error: string; code: ApiErrorCode; detail?: string } }`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/api-errors.test.ts
import { describe, it, expect } from "vitest";
import {
  toErrorResponse,
  stderrTail,
  ConfigInvalidError,
  InvalidInputError,
  isApiErrorCode,
} from "./api-errors";
import { SshUnreachableError, CliError } from "./ssh-errors";

describe("toErrorResponse", () => {
  it("maps SshUnreachableError to 502 ssh_unreachable", () => {
    const res = toErrorResponse(new SshUnreachableError("SSH to 1.2.3.4 failed: ECONNREFUSED"));
    expect(res.status).toBe(502);
    expect(res.body.code).toBe("ssh_unreachable");
    expect(res.body.detail).toBeUndefined();
  });

  it("maps CliError to 500 cli_error with stderr tail as detail", () => {
    const res = toErrorResponse(
      new CliError("openclaw failed", { code: 1, stdout: "", stderr: "Error: boom\n" }),
    );
    expect(res.status).toBe(500);
    expect(res.body.code).toBe("cli_error");
    expect(res.body.detail).toBe("Error: boom");
  });

  it("falls back to stdout when stderr is empty", () => {
    const res = toErrorResponse(
      new CliError("x", { code: 1, stdout: "printed to stdout", stderr: "" }),
    );
    expect(res.body.detail).toBe("printed to stdout");
  });

  it("maps ConfigInvalidError to 409 config_invalid", () => {
    const res = toErrorResponse(new ConfigInvalidError("retired key ui.assistant"));
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: "OpenClaw config is invalid",
      code: "config_invalid",
      detail: "retired key ui.assistant",
    });
  });

  it("maps InvalidInputError to 400 with its code", () => {
    const res = toErrorResponse(new InvalidInputError("invalid_channel", "Unsupported channel"));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("invalid_channel");
    expect(res.body.error).toBe("Unsupported channel");
  });

  it("maps unknown errors to 500 internal without leaking the message", () => {
    const res = toErrorResponse(new Error("secret db string"));
    expect(res.status).toBe(500);
    expect(res.body.code).toBe("internal");
    expect(res.body.error).not.toContain("secret");
  });
});

describe("stderrTail", () => {
  it("returns the trimmed last N characters", () => {
    expect(stderrTail("a".repeat(600) + "END\n", 5)).toBe("aaEND");
  });
});

describe("isApiErrorCode", () => {
  it("accepts known codes and rejects others", () => {
    expect(isApiErrorCode("cli_error")).toBe(true);
    expect(isApiErrorCode("no_capacity")).toBe(false);
    expect(isApiErrorCode(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/api-errors.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/api-errors.ts
/**
 * Maps thrown errors from SSH/CLI helpers to a stable HTTP response shape.
 * The UI localizes by `code`; `error` stays English (server convention).
 * Relative imports only — this module is unit-tested and imported by client code.
 */
import { SshUnreachableError, CliError } from "./ssh-errors";

export const API_ERROR_CODES = [
  "ssh_unreachable",
  "cli_error",
  "config_invalid",
  "invalid_channel",
  "invalid_code",
  "internal",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return (
    typeof value === "string" &&
    (API_ERROR_CODES as readonly string[]).includes(value)
  );
}

export interface ApiErrorBody {
  error: string;
  code: ApiErrorCode;
  detail?: string;
}

/** `openclaw config validate` failed before or after a change. */
export class ConfigInvalidError extends Error {
  readonly detail: string;
  constructor(detail: string) {
    super("OpenClaw config is invalid");
    this.name = "ConfigInvalidError";
    this.detail = detail;
  }
}

/** Request input rejected before touching the VPS. */
export class InvalidInputError extends Error {
  readonly code: "invalid_channel" | "invalid_code";
  constructor(code: "invalid_channel" | "invalid_code", message: string) {
    super(message);
    this.name = "InvalidInputError";
    this.code = code;
  }
}

/** Last `max` characters of a CLI stream, trimmed. */
export function stderrTail(text: string, max = 500): string {
  const trimmed = text.trim();
  return trimmed.length > max ? trimmed.slice(-max) : trimmed;
}

export function toErrorResponse(err: unknown): {
  status: number;
  body: ApiErrorBody;
} {
  if (err instanceof SshUnreachableError) {
    return {
      status: 502,
      body: { error: "Could not reach the instance over SSH", code: "ssh_unreachable" },
    };
  }
  if (err instanceof ConfigInvalidError) {
    return {
      status: 409,
      body: { error: err.message, code: "config_invalid", detail: err.detail },
    };
  }
  if (err instanceof CliError) {
    const detail = stderrTail(err.stderr) || stderrTail(err.stdout);
    return {
      status: 500,
      body: {
        error: "OpenClaw command failed on the instance",
        code: "cli_error",
        ...(detail ? { detail } : {}),
      },
    };
  }
  if (err instanceof InvalidInputError) {
    return { status: 400, body: { error: err.message, code: err.code } };
  }
  return {
    status: 500,
    body: { error: "Internal error", code: "internal" },
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/api-errors.test.ts`
Expected: PASS (8 tests).

---

### Task 3: Pairing via `openclaw pairing list --json` + channel/code validation

**Files:**
- Create: `src/lib/pairing.ts`
- Modify: `src/lib/ssh.ts:104-185` (`PairingRequest`, `listPairingRequests`, `approvePairingRequest`)
- Modify: `src/app/api/instances/[id]/pairing/route.ts`
- Test: `src/lib/pairing.test.ts` (new), `src/lib/ssh.test.ts` (append)

**Interfaces:**
- Produces:
  - `PAIRING_CHANNELS = ["telegram","whatsapp"] as const`, `type PairingChannel`
  - `assertPairingChannel(value: unknown): PairingChannel` (throws `InvalidInputError("invalid_channel")`)
  - `assertPairingCode(value: unknown): string` (throws `InvalidInputError("invalid_code")`)
  - `parsePairingListOutput(stdout: string): PairingRequest[]` (throws `CliError` on bad shape)
  - `listPairingRequests(host, key, channel: PairingChannel, exec?: ExecFn): Promise<PairingRequest[]>` (throws `SshUnreachableError | CliError`)
  - `approvePairingRequest(host, key, code: string, channel: PairingChannel, exec?: ExecFn): Promise<void>` (throws)
  - `PairingRequest` moves to `src/lib/pairing.ts` (re-exported from `ssh.ts` for existing imports).

- [ ] **Step 1: Write failing tests for the pure helpers**

```ts
// src/lib/pairing.test.ts
import { describe, it, expect } from "vitest";
import {
  assertPairingChannel,
  assertPairingCode,
  parsePairingListOutput,
} from "./pairing";
import { InvalidInputError } from "./api-errors";
import { CliError } from "./ssh-errors";

describe("assertPairingChannel", () => {
  it("accepts telegram and whatsapp", () => {
    expect(assertPairingChannel("telegram")).toBe("telegram");
    expect(assertPairingChannel("whatsapp")).toBe("whatsapp");
  });

  it("rejects shell metacharacters and unknown channels", () => {
    for (const bad of ["telegram; rm -rf /", "$(id)", "discord", "", undefined, 3]) {
      const err = (() => {
        try {
          assertPairingChannel(bad);
          return null;
        } catch (e) {
          return e;
        }
      })();
      expect(err).toBeInstanceOf(InvalidInputError);
      expect((err as InvalidInputError).code).toBe("invalid_channel");
    }
  });
});

describe("assertPairingCode", () => {
  it("accepts alphanumeric codes with dashes/underscores", () => {
    expect(assertPairingCode("AB12-cd_34")).toBe("AB12-cd_34");
  });

  it("rejects spaces, quotes and empty", () => {
    for (const bad of ["a b", "x'y", "", "$(id)", "a".repeat(65)]) {
      expect(() => assertPairingCode(bad)).toThrow(InvalidInputError);
    }
  });
});

describe("parsePairingListOutput", () => {
  it("maps the 2026.9 CLI shape", () => {
    const stdout = JSON.stringify({
      channel: "telegram",
      requests: [
        {
          id: "123456",
          code: "K7Q2ZP",
          createdAt: "2026-09-17T10:00:00.000Z",
          lastSeenAt: "2026-09-17T10:00:05.000Z",
          meta: { senderId: "123456", firstName: "Ana", username: "ana_dev", accountId: "default" },
        },
        { id: "999", code: "ZZZZZZ", createdAt: "2026-09-17T11:00:00.000Z", lastSeenAt: "2026-09-17T11:00:00.000Z" },
      ],
    });
    expect(parsePairingListOutput(stdout)).toEqual([
      { code: "K7Q2ZP", senderId: "123456", senderName: "Ana", timestamp: "2026-09-17T10:00:00.000Z" },
      { code: "ZZZZZZ", senderId: "999", senderName: null, timestamp: "2026-09-17T11:00:00.000Z" },
    ]);
  });

  it("prefers firstName, then username, else null", () => {
    const one = (meta: Record<string, string>) =>
      parsePairingListOutput(
        JSON.stringify({ channel: "telegram", requests: [{ id: "1", code: "C", createdAt: "t", lastSeenAt: "t", meta }] }),
      )[0].senderName;
    expect(one({ firstName: "Ana", username: "ana" })).toBe("Ana");
    expect(one({ username: "ana" })).toBe("ana");
    expect(one({})).toBeNull();
  });

  it("returns [] for an empty requests array", () => {
    expect(parsePairingListOutput('{"channel":"telegram","requests":[]}')).toEqual([]);
  });

  it("throws CliError on non-JSON or wrong shape instead of swallowing", () => {
    expect(() => parsePairingListOutput("No pending telegram pairing requests.")).toThrow(CliError);
    expect(() => parsePairingListOutput('{"channel":"telegram"}')).toThrow(CliError);
    expect(() => parsePairingListOutput("[]")).toThrow(CliError);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/pairing.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/pairing.ts`**

```ts
// src/lib/pairing.ts
/**
 * Pure helpers for OpenClaw DM pairing (OpenClaw ≥2026.4.29 stores pairing in
 * SQLite; the CLI is the contract). No I/O here — see ssh.ts for the SSH calls.
 */
import { InvalidInputError } from "./api-errors";
import { CliError } from "./ssh-errors";

export const PAIRING_CHANNELS = ["telegram", "whatsapp"] as const;
export type PairingChannel = (typeof PAIRING_CHANNELS)[number];

export interface PairingRequest {
  code: string;
  senderId: string;
  senderName: string | null;
  timestamp: string;
}

/** Whitelists the channel before it is interpolated into a shell command. */
export function assertPairingChannel(value: unknown): PairingChannel {
  if (
    typeof value === "string" &&
    (PAIRING_CHANNELS as readonly string[]).includes(value)
  ) {
    return value as PairingChannel;
  }
  throw new InvalidInputError(
    "invalid_channel",
    `Unsupported pairing channel. Expected one of: ${PAIRING_CHANNELS.join(", ")}`,
  );
}

const PAIRING_CODE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Whitelists a pairing code before it is interpolated into a shell command. */
export function assertPairingCode(value: unknown): string {
  if (typeof value === "string" && PAIRING_CODE_PATTERN.test(value)) {
    return value;
  }
  throw new InvalidInputError("invalid_code", "Invalid pairing code");
}

/** Shape printed by `openclaw pairing list <channel> --json` (v2026.9.4). */
interface RawPairingListOutput {
  channel?: string;
  requests?: Array<{
    id?: string | number;
    code?: string;
    createdAt?: string;
    lastSeenAt?: string;
    meta?: Record<string, string | undefined>;
  }>;
}

export function parsePairingListOutput(stdout: string): PairingRequest[] {
  let raw: unknown;
  try {
    raw = JSON.parse(stdout.trim());
  } catch {
    throw new CliError("openclaw pairing list printed non-JSON output", {
      code: 0,
      stdout,
      stderr: "",
    });
  }

  const requests = (raw as RawPairingListOutput | null)?.requests;
  if (!raw || typeof raw !== "object" || !Array.isArray(requests)) {
    throw new CliError("openclaw pairing list printed an unexpected shape", {
      code: 0,
      stdout,
      stderr: "",
    });
  }

  return requests.map((entry) => ({
    code: entry.code ?? "",
    senderId: String(entry.meta?.senderId ?? entry.id ?? ""),
    senderName: entry.meta?.firstName || entry.meta?.username || null,
    timestamp: entry.createdAt ?? new Date().toISOString(),
  }));
}
```

- [ ] **Step 4: Run pure tests**

Run: `npx vitest run src/lib/pairing.test.ts`
Expected: PASS.

- [ ] **Step 5: Write failing tests for the SSH helpers**

Append to `src/lib/ssh.test.ts` (add `listPairingRequests`, `approvePairingRequest` to the `./ssh` import; import `CliError` from `./ssh-errors`):

```ts
describe("listPairingRequests", () => {
  it("runs `openclaw pairing list <channel> --json` under OPENCLAW_ENV and parses", async () => {
    const calls: string[] = [];
    const exec: ExecFn = async (_h, _k, command) => {
      calls.push(command);
      return {
        stdout: '{"channel":"telegram","requests":[{"id":"1","code":"ABC","createdAt":"t","lastSeenAt":"t","meta":{"senderId":"1","firstName":"Ana"}}]}',
        stderr: "",
        code: 0,
      };
    };
    const result = await listPairingRequests("1.2.3.4", "KEY", "telegram", exec);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("XDG_RUNTIME_DIR=/run/user/0");
    expect(calls[0]).toContain("openclaw pairing list telegram --json");
    expect(result).toEqual([{ code: "ABC", senderId: "1", senderName: "Ana", timestamp: "t" }]);
  });

  it("throws CliError with stderr on non-zero exit", async () => {
    const exec: ExecFn = async () => ({ stdout: "", stderr: "Channel \"x\" does not support pairing", code: 1 });
    const err = await listPairingRequests("1.2.3.4", "KEY", "telegram", exec).catch((e) => e);
    expect(err).toBeInstanceOf(CliError);
    expect(err.stderr).toContain("does not support pairing");
  });
});

describe("approvePairingRequest", () => {
  it("runs `openclaw pairing approve <channel> <code>` and resolves on exit 0", async () => {
    const calls: string[] = [];
    const exec: ExecFn = async (_h, _k, command) => {
      calls.push(command);
      return { stdout: "Approved telegram sender 1.", stderr: "", code: 0 };
    };
    await expect(approvePairingRequest("1.2.3.4", "KEY", "ABC", "telegram", exec)).resolves.toBeUndefined();
    expect(calls[0]).toContain("openclaw pairing approve telegram ABC");
  });

  it("throws CliError when the code is unknown", async () => {
    const exec: ExecFn = async () => ({ stdout: "", stderr: 'No pending pairing request found for code "ABC".', code: 1 });
    await expect(approvePairingRequest("1.2.3.4", "KEY", "ABC", "telegram", exec)).rejects.toBeInstanceOf(CliError);
  });
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npx vitest run src/lib/ssh.test.ts`
Expected: FAIL — signatures differ / no CliError.

- [ ] **Step 7: Rewrite the two helpers in `src/lib/ssh.ts`**

Delete `PairingRequest`, `RawPairingEntry`, old `listPairingRequests` and `approvePairingRequest` (lines 104-185). Add near the top:

```ts
import { CliError } from "./ssh-errors";
import {
  parsePairingListOutput,
  type PairingChannel,
  type PairingRequest,
} from "./pairing";

export type { PairingRequest } from "./pairing";
```

Then:

```ts
/**
 * Lists pending DM pairing requests via `openclaw pairing list <channel> --json`.
 * (OpenClaw ≥2026.4.29 keeps pairing state in SQLite; the credentials/*.json
 * file no longer exists.) Throws SshUnreachableError or CliError.
 */
export async function listPairingRequests(
  host: string,
  privateKey: string,
  channel: PairingChannel,
  exec: ExecFn = executeCommand,
): Promise<PairingRequest[]> {
  const { stdout, stderr, code } = await exec(
    host,
    privateKey,
    `${OPENCLAW_ENV}\nopenclaw pairing list ${channel} --json`,
  );
  if (code !== 0) {
    throw new CliError(`openclaw pairing list ${channel} exited ${code}`, {
      code,
      stdout,
      stderr,
    });
  }
  return parsePairingListOutput(stdout);
}

/**
 * Approves a pairing code via `openclaw pairing approve <channel> <code>`.
 * `channel` and `code` MUST be validated by assertPairingChannel/assertPairingCode
 * before calling — they are interpolated into a shell command.
 */
export async function approvePairingRequest(
  host: string,
  privateKey: string,
  code: string,
  channel: PairingChannel,
  exec: ExecFn = executeCommand,
): Promise<void> {
  const result = await exec(
    host,
    privateKey,
    `${OPENCLAW_ENV}\nopenclaw pairing approve ${channel} ${code}`,
  );
  if (result.code !== 0) {
    throw new CliError(`openclaw pairing approve exited ${result.code}`, result);
  }
}
```

- [ ] **Step 8: Run ssh tests + typecheck**

Run: `npx vitest run src/lib/ssh.test.ts && npx tsc --noEmit`
Expected: ssh tests PASS; tsc reports errors ONLY in `src/app/api/instances/[id]/pairing/route.ts` (fixed next step).

- [ ] **Step 9: Rewrite the pairing route**

Replace the two `try` blocks in `src/app/api/instances/[id]/pairing/route.ts`. Imports become:

```ts
import { listPairingRequests, approvePairingRequest } from "@/lib/ssh";
import { assertPairingChannel, assertPairingCode } from "@/lib/pairing";
import { toErrorResponse } from "@/lib/api-errors";
```

GET body after the "not ready for SSH" guard:

```ts
  try {
    const url = new URL(request.url);
    const channel = assertPairingChannel(
      url.searchParams.get("channel") ?? inst.channel.split("|")[0],
    );
    const requests = await listPairingRequests(
      inst.providerServerIp,
      inst.sshPrivateKey,
      channel,
    );
    return NextResponse.json({ requests });
  } catch (error) {
    console.error(`[pairing] list failed for instance ${id}:`, error);
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
```

POST: remove the early `if (!code || typeof code !== "string")` 400 (validation moves into the try). Body after the SSH guard:

```ts
  try {
    const channel = assertPairingChannel(
      channelParam ?? inst.channel.split("|")[0],
    );
    const pairingCode = assertPairingCode(code);
    await approvePairingRequest(
      inst.providerServerIp,
      inst.sshPrivateKey,
      pairingCode,
      channel,
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[pairing] approve failed for instance ${id}:`, error);
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
```

Update the file's doc comments: GET "by running `openclaw pairing list <channel> --json`", POST "by running `openclaw pairing approve <channel> <CODE>`".

- [ ] **Step 10: Verify**

Run: `npx tsc --noEmit && npx eslint "src/app/api/instances/[id]/pairing/route.ts" src/lib/pairing.ts src/lib/ssh.ts src/lib/api-errors.ts src/lib/ssh-errors.ts && npm test`
Expected: all clean/green.

---

### Task 4: Agents helper + route use typed errors

**Files:**
- Modify: `src/lib/ssh.ts` (`listAgents`, lines ~298-335)
- Modify: `src/app/api/instances/[id]/agents/route.ts:45-49`
- Modify: `src/components/dashboard/tabs/agents-tab.tsx:30-45` (response type) and `:192, :208-224`
- Test: `src/lib/ssh.test.ts` (append)

**Interfaces:**
- Produces: `listAgents(host, key, exec?: ExecFn): Promise<OpenClawAgent[]>` (throws `SshUnreachableError | CliError`).

- [ ] **Step 1: Failing tests**

Append to `src/lib/ssh.test.ts` (import `listAgents`):

```ts
describe("listAgents", () => {
  it("runs under OPENCLAW_ENV and returns parsed agents", async () => {
    const calls: string[] = [];
    const exec: ExecFn = async (_h, _k, command) => {
      calls.push(command);
      return { stdout: '[{"id":"main","isDefault":true}]', stderr: "", code: 0 };
    };
    const agents = await listAgents("1.2.3.4", "KEY", exec);
    expect(calls[0]).toContain("XDG_RUNTIME_DIR=/run/user/0");
    expect(calls[0]).toContain("openclaw agents list --bindings --json");
    expect(agents).toEqual([{ id: "main", isDefault: true, bindingDetails: [] }]);
  });

  it("throws CliError on non-zero exit", async () => {
    const exec: ExecFn = async () => ({ stdout: "", stderr: "Config invalid", code: 1 });
    await expect(listAgents("1.2.3.4", "KEY", exec)).rejects.toBeInstanceOf(CliError);
  });

  it("throws CliError when stdout is not a JSON array", async () => {
    const exec: ExecFn = async () => ({ stdout: "not json", stderr: "", code: 0 });
    await expect(listAgents("1.2.3.4", "KEY", exec)).rejects.toBeInstanceOf(CliError);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/ssh.test.ts -t listAgents`
Expected: FAIL.

- [ ] **Step 3: Rewrite `listAgents`**

```ts
/**
 * Lists OpenClaw agents via `openclaw agents list --bindings --json`.
 * Throws SshUnreachableError (no connection) or CliError (non-zero exit / bad output).
 */
export async function listAgents(
  host: string,
  privateKey: string,
  exec: ExecFn = executeCommand,
): Promise<OpenClawAgent[]> {
  const result = await exec(
    host,
    privateKey,
    `${OPENCLAW_ENV}\nopenclaw agents list --bindings --json`,
  );
  if (result.code !== 0) {
    throw new CliError(`openclaw agents list exited ${result.code}`, result);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(result.stdout.trim());
  } catch {
    throw new CliError("openclaw agents list printed non-JSON output", result);
  }
  if (!Array.isArray(raw)) {
    throw new CliError("openclaw agents list did not print an array", result);
  }
  return parseAgents(raw);
}
```

- [ ] **Step 4: Update the agents route**

Replace lines 45-49 of `src/app/api/instances/[id]/agents/route.ts`:

```ts
  try {
    const agents = await listAgents(inst.providerServerIp, inst.sshPrivateKey);
    return NextResponse.json({ agents });
  } catch (error) {
    console.error(`[agents] list failed for instance ${id}:`, error);
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
```

Add `import { toErrorResponse } from "@/lib/api-errors";`.

- [ ] **Step 5: Surface the code in the agents tab**

In `src/components/dashboard/tabs/agents-tab.tsx`, add `code?: string; detail?: string;` to the `AgentsResponse` interface, and change the error `CenteredMessage`:

```tsx
  if (fetchError) {
    const code = data?.code;
    const description = isApiErrorCode(code)
      ? t(`errors.${code}`)
      : t("agents.errorDescription");
    return (
      <CenteredMessage
        icon={<AlertCircle className="h-8 w-8 text-destructive/70" />}
        title={t("agents.errorTitle")}
        description={
          data?.detail ? `${description} — ${data.detail}` : description
        }
        action={/* unchanged RefreshButton */}
      />
    );
  }
```

Import: `import { isApiErrorCode } from "@/lib/api-errors";`. (The `errors.*` keys are added in Task 6; until then `tsc` passes but the runtime key is missing — do Task 6 before manual testing.)

- [ ] **Step 6: Verify**

Run: `npx vitest run src/lib/ssh.test.ts && npx tsc --noEmit && npx eslint "src/app/api/instances/[id]/agents/route.ts" src/components/dashboard/tabs/agents-tab.tsx`
Expected: clean.

---

### Task 5: Reconfigure — validate, back up, safe key passing, `restartGateway`

**Files:**
- Create: `src/lib/reconfigure-script.ts`
- Modify: `src/app/api/instances/[id]/reconfigure/route.ts:96-190`
- Test: `src/lib/reconfigure-script.test.ts`

**Interfaces:**
- Produces:
  - `RECONFIGURE_EXIT = { configInvalidBefore: 42, onboardFailed: 43, patchFailed: 44, configInvalidAfter: 45, envWriteFailed: 46 } as const`
  - `envVarNameFor(providerId: string): string` (throws on unsafe name)
  - `buildReconfigureScript(input: { provider: { id: string; authChoice: string; apiKeyFlag?: string }; primaryModel: string; apiKey: string }): string`
- Consumes: `OPENCLAW_ENV` from `./gateway-health`; `restartGateway`, `executeCommand` from `@/lib/ssh`; `computeHealth` from `@/lib/gateway-health`; `ConfigInvalidError`, `toErrorResponse` from `@/lib/api-errors`; `CliError` from `@/lib/ssh-errors`.

- [ ] **Step 1: Failing tests**

```ts
// src/lib/reconfigure-script.test.ts
import { describe, it, expect } from "vitest";
import {
  buildReconfigureScript,
  envVarNameFor,
  RECONFIGURE_EXIT,
} from "./reconfigure-script";

const apiKeyProvider = { id: "openrouter", authChoice: "openrouter-api-key", apiKeyFlag: "--openrouter-api-key" };

describe("envVarNameFor", () => {
  it("maps known providers and derives others", () => {
    expect(envVarNameFor("groq")).toBe("GROQ_API_KEY");
    expect(envVarNameFor("nvidia")).toBe("NVIDIA_API_KEY");
    expect(envVarNameFor("opencode-go")).toBe("OPENCODE_GO_API_KEY");
  });
  it("rejects names that are not a valid shell identifier", () => {
    expect(() => envVarNameFor("$(id)")).toThrow();
    expect(() => envVarNameFor("")).toThrow();
  });
});

describe("buildReconfigureScript", () => {
  const script = buildReconfigureScript({
    provider: apiKeyProvider,
    primaryModel: "openrouter/anthropic/claude-sonnet-5",
    apiKey: `sk-or-"; rm -rf / ; echo "`,
  });

  it("never interpolates the raw API key or model; passes both via base64", () => {
    expect(script).not.toContain("rm -rf");
    expect(script).toContain("KEY=$(echo '");
    expect(script).toContain("| base64 -d)");
    expect(script).toContain(Buffer.from(`sk-or-"; rm -rf / ; echo "`).toString("base64"));
    expect(script).toContain(Buffer.from("openrouter/anthropic/claude-sonnet-5").toString("base64"));
    expect(script).toContain('--openrouter-api-key "$KEY"');
    expect(script).toContain('--arg model "$MODEL"');
  });

  it("validates before touching anything, with a distinct exit code", () => {
    const validateIdx = script.indexOf("openclaw config validate");
    const cpIdx = script.indexOf("cp /root/.openclaw/openclaw.json /root/.openclaw/openclaw.json.bak");
    expect(validateIdx).toBeGreaterThan(-1);
    expect(validateIdx).toBeLessThan(cpIdx);
    expect(script).toContain(`|| exit ${RECONFIGURE_EXIT.configInvalidBefore}`);
  });

  it("backs up before onboard, restores on onboard/patch/post-validate failure", () => {
    const cpIdx = script.indexOf("openclaw.json.bak");
    const onboardIdx = script.indexOf("openclaw onboard");
    expect(cpIdx).toBeLessThan(onboardIdx);
    expect(script).toContain(`{ restore; exit ${RECONFIGURE_EXIT.onboardFailed}; }`);
    expect(script).toContain(`{ restore; exit ${RECONFIGURE_EXIT.patchFailed}; }`);
    expect(script).toContain(`{ restore; exit ${RECONFIGURE_EXIT.configInvalidAfter}; }`);
    expect(script).toContain(".agents.defaults.model.primary = $model");
    expect(script.trim().endsWith("echo RECONFIGURED")).toBe(true);
  });

  it("uses OPENCLAW_ENV, no set -e, no pkill", () => {
    expect(script).toContain("XDG_RUNTIME_DIR=/run/user/0");
    expect(script).not.toContain("set -e");
    expect(script).not.toContain("pkill");
  });

  it("writes env-var providers to /root/.openclaw/.env without sed injection", () => {
    const s = buildReconfigureScript({
      provider: { id: "groq", authChoice: "skip" },
      primaryModel: "groq/llama-3.3-70b",
      apiKey: "gsk|&\\x",
    });
    expect(s).not.toContain("sed -i");
    expect(s).toContain('grep -v "^GROQ_API_KEY="');
    expect(s).toContain(`printf '%s=%s\\n' "GROQ_API_KEY" "$KEY"`);
    expect(s).toContain("--auth-choice skip");
    expect(s).not.toContain("gsk|&");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/reconfigure-script.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/reconfigure-script.ts
/**
 * Builds the bash script that reconfigures the AI provider/model on a VPS.
 *
 * Safety: the API key and model are shipped base64-encoded and expanded into
 * shell variables; `"$KEY"` inside double quotes is never re-parsed by bash,
 * so no user-controlled bytes reach the parser. Distinct exit codes let the
 * route map "config invalid" (409) apart from other CLI failures (500).
 * No `set -e`: every step has an explicit `|| { restore; exit N; }`.
 */
import { OPENCLAW_ENV } from "./gateway-health";

export const RECONFIGURE_EXIT = {
  /** Pre-existing config is invalid; nothing was touched. */
  configInvalidBefore: 42,
  onboardFailed: 43,
  patchFailed: 44,
  /** Config invalid after patch; restored from backup. */
  configInvalidAfter: 45,
  envWriteFailed: 46,
} as const;

const CFG = "/root/.openclaw/openclaw.json";
const ENV_FILE = "/root/.openclaw/.env";
const SKIP_FLAGS =
  "--skip-channels --skip-skills --skip-daemon --skip-ui --skip-search --skip-health";

const KNOWN_ENV_VARS: Record<string, string> = {
  groq: "GROQ_API_KEY",
  nvidia: "NVIDIA_API_KEY",
};

export function envVarNameFor(providerId: string): string {
  const name =
    KNOWN_ENV_VARS[providerId] ??
    `${providerId.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}_API_KEY`;
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe env var name derived from provider "${providerId}"`);
  }
  return name;
}

export interface ReconfigureInput {
  provider: { id: string; authChoice: string; apiKeyFlag?: string };
  primaryModel: string;
  apiKey: string;
}

const b64 = (value: string) => Buffer.from(value, "utf8").toString("base64");

export function buildReconfigureScript(input: ReconfigureInput): string {
  const { provider } = input;
  const fail = (code: number) => `{ restore; exit ${code}; }`;

  const onboard: string[] =
    provider.authChoice === "skip"
      ? [
          `ENV_VAR="${envVarNameFor(provider.id)}"`,
          `{ grep -v "^${envVarNameFor(provider.id)}=" ${ENV_FILE} 2>/dev/null; printf '%s=%s\\n' "${envVarNameFor(provider.id)}" "$KEY"; } > ${ENV_FILE}.tmp || ${fail(RECONFIGURE_EXIT.envWriteFailed)}`,
          `mv ${ENV_FILE}.tmp ${ENV_FILE} || ${fail(RECONFIGURE_EXIT.envWriteFailed)}`,
          `chmod 600 ${ENV_FILE}`,
          `openclaw onboard --non-interactive --accept-risk --auth-choice skip ${SKIP_FLAGS} || ${fail(RECONFIGURE_EXIT.onboardFailed)}`,
        ]
      : [
          `openclaw onboard --non-interactive --accept-risk --auth-choice "${provider.authChoice}" ${provider.apiKeyFlag ?? "--api-key"} "$KEY" ${SKIP_FLAGS} || ${fail(RECONFIGURE_EXIT.onboardFailed)}`,
        ];

  return [
    OPENCLAW_ENV,
    `KEY=$(echo '${b64(input.apiKey)}' | base64 -d)`,
    `MODEL=$(echo '${b64(input.primaryModel)}' | base64 -d)`,
    `openclaw config validate >/dev/null 2>&1 || exit ${RECONFIGURE_EXIT.configInvalidBefore}`,
    `cp ${CFG} ${CFG}.bak || exit ${RECONFIGURE_EXIT.patchFailed}`,
    `restore() { mv -f ${CFG}.bak ${CFG}; }`,
    ...onboard,
    `jq --arg model "$MODEL" '.agents.defaults.model.primary = $model' ${CFG} > /run/oc.json || ${fail(RECONFIGURE_EXIT.patchFailed)}`,
    `mv /run/oc.json ${CFG} || ${fail(RECONFIGURE_EXIT.patchFailed)}`,
    `openclaw config validate >/dev/null 2>&1 || ${fail(RECONFIGURE_EXIT.configInvalidAfter)}`,
    `rm -f ${CFG}.bak`,
    `echo RECONFIGURED`,
  ].join("\n");
}
```

Note on `provider.apiKeyFlag`: check `src/lib/ai-config.ts` — the existing route uses `${provider.apiKeyFlag}` unconditionally for non-skip providers, so it is always defined there; the `?? "--api-key"` fallback only satisfies the optional type.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/reconfigure-script.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewrite the reconfigure route (from "Build the primary model ID" onward)**

Imports:

```ts
import { executeCommand, restartGateway } from "@/lib/ssh";
import { computeHealth } from "@/lib/gateway-health";
import { buildReconfigureScript, RECONFIGURE_EXIT } from "@/lib/reconfigure-script";
import { ConfigInvalidError, toErrorResponse, stderrTail } from "@/lib/api-errors";
import { CliError } from "@/lib/ssh-errors";
```

Replace everything after `primaryModel` is computed (from `// Build the SSH reconfiguration command` to the end of the handler):

```ts
  const script = buildReconfigureScript({
    provider: {
      id: provider.id,
      authChoice: provider.authChoice,
      apiKeyFlag: provider.apiKeyFlag,
    },
    primaryModel,
    apiKey: modelApiKey,
  });

  try {
    // Step 1: validate → backup → onboard → patch → validate (one ssh call).
    const result = await executeCommand(
      inst.providerServerIp,
      inst.sshPrivateKey,
      script,
    );

    if (
      result.code === RECONFIGURE_EXIT.configInvalidBefore ||
      result.code === RECONFIGURE_EXIT.configInvalidAfter
    ) {
      const stage =
        result.code === RECONFIGURE_EXIT.configInvalidBefore
          ? "before changes (nothing was modified)"
          : "after applying changes (restored previous config)";
      throw new ConfigInvalidError(
        `${stage}: ${stderrTail(result.stderr) || stderrTail(result.stdout)}`,
      );
    }
    if (result.code !== 0) {
      throw new CliError(`reconfigure script exited ${result.code}`, result);
    }

    // Step 2: restart the gateway and probe health (F4 helper).
    const restart = await restartGateway(
      inst.providerServerIp,
      inst.sshPrivateKey,
    );
    const { health, reason } = computeHealth({
      hetznerStatus: "running",
      probe: restart.probe,
    });

    // Step 3: persist only after the VPS accepted the config.
    await db
      .update(instance)
      .set({ model, modelApiKey })
      .where(eq(instance.id, id));

    return NextResponse.json({
      success: true,
      model: primaryModel,
      health,
      healthReason: reason,
    });
  } catch (error) {
    console.error(`[reconfigure] failed for instance ${id}:`, error);
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
```

Delete the now-unused `pathExport`, `skipFlags`, `reconfigureCmd`, `patchAndRestart`, `envVarMap` code. Update the file's doc comment to describe: validate → backup → onboard → jq patch → validate → restart; 409 `config_invalid` when validation fails.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npx eslint "src/app/api/instances/[id]/reconfigure/route.ts" src/lib/reconfigure-script.ts && npm test`
Expected: clean/green.

---

### Task 6: i18n keys + UI error mapping (pairing, approve, reconfigure)

**Files:**
- Modify: `messages/en.json`, `messages/es.json` (`InstanceDetail.errors`, `InstanceDetail.pairing`, `InstanceDetail.model`, `InstanceDetail.channels.pendingBadge` already exists)
- Modify: `src/components/dashboard/instance-detail.tsx:295-340` (fetch/approve), `src/components/dashboard/tabs/channels-tab.tsx:155-246` (pairing section), `src/components/dashboard/pairing-dialog.tsx:34-80`, `src/components/dashboard/model-provider-module.tsx:105-135`

**Interfaces:**
- Consumes: `isApiErrorCode`, `ApiErrorBody` from `@/lib/api-errors`.
- Produces: message keys below; a small local helper `apiErrorMessage(t, body)` duplicated per component (3 lines; no shared hook to avoid a new file for a one-liner).

- [ ] **Step 1: Add keys to `messages/en.json` under `InstanceDetail`**

```json
"errors": {
  "ssh_unreachable": "Could not reach your instance over SSH. It may be restarting — try again in a minute.",
  "cli_error": "OpenClaw returned an error on your instance.",
  "config_invalid": "Your OpenClaw configuration is invalid. Use Restart agent on the General tab, or contact support.",
  "invalid_channel": "Unsupported channel.",
  "invalid_code": "Invalid pairing code.",
  "internal": "Something went wrong on our side. Please try again.",
  "network": "Network error — could not reach the server."
},
"pairing": {
  "refresh": "Refresh",
  "loading": "Loading pairing requests…",
  "empty": "No pending pairing requests",
  "emptyHint": "Send a message to your Telegram bot, then press Refresh.",
  "securityNotice": "If you see pairing codes you don't recognize, ignore them — do not approve anything. This is the door to your agent.",
  "approve": "Approve",
  "approvedTitle": "Pairing approved",
  "approvedDescription": "You can now chat with your agent through Telegram.",
  "userFallback": "User {id}",
  "idLabel": "ID"
},
"model": {
  "updatedTitle": "Model updated",
  "updatedDescription": "Your instance was reconfigured and the agent restarted.",
  "updatedDegraded": "Model updated, but the agent is still having trouble: {reason}",
  "failed": "Could not update the model."
}
```

And `messages/es.json`:

```json
"errors": {
  "ssh_unreachable": "No pudimos conectar con tu instancia por SSH. Puede estar reiniciándose — inténtalo en un minuto.",
  "cli_error": "OpenClaw devolvió un error en tu instancia.",
  "config_invalid": "La configuración de OpenClaw es inválida. Usa Reiniciar agente en la pestaña General o contacta soporte.",
  "invalid_channel": "Canal no soportado.",
  "invalid_code": "Código de vinculación inválido.",
  "internal": "Algo falló de nuestro lado. Inténtalo de nuevo.",
  "network": "Error de red — no se pudo contactar al servidor."
},
"pairing": {
  "refresh": "Actualizar",
  "loading": "Cargando solicitudes de vinculación…",
  "empty": "Sin solicitudes de vinculación pendientes",
  "emptyHint": "Envía un mensaje a tu bot de Telegram y pulsa Actualizar.",
  "securityNotice": "Si ves códigos de vinculación que no reconoces, ignóralos — no apruebes nada. Esta es la puerta a tu agente.",
  "approve": "Aprobar",
  "approvedTitle": "Vinculación aprobada",
  "approvedDescription": "Ya puedes chatear con tu agente por Telegram.",
  "userFallback": "Usuario {id}",
  "idLabel": "ID"
},
"model": {
  "updatedTitle": "Modelo actualizado",
  "updatedDescription": "Tu instancia fue reconfigurada y el agente reiniciado.",
  "updatedDegraded": "Modelo actualizado, pero el agente sigue con problemas: {reason}",
  "failed": "No se pudo actualizar el modelo."
}
```

- [ ] **Step 2: Localize pairing fetch/approve in `instance-detail.tsx`**

Add `import { isApiErrorCode, type ApiErrorBody } from "@/lib/api-errors";` and inside the component (after `const t = useTranslations("InstanceDetail")`):

```ts
  const apiErrorMessage = useCallback(
    (body: Partial<ApiErrorBody>) => {
      const base = isApiErrorCode(body.code)
        ? t(`errors.${body.code}`)
        : body.error || t("errors.internal");
      return body.detail ? `${base} (${body.detail})` : base;
    },
    [t],
  );
```

Replace `fetchPairingRequests`:

```ts
  const fetchPairingRequests = useCallback(async () => {
    if (!hasTelegram) return;
    setIsPairingLoading(true);
    setPairingError(null);
    try {
      const res = await fetch(`/api/instances/${instance.id}/pairing?channel=telegram`);
      const body = (await res.json().catch(() => ({}))) as Partial<ApiErrorBody> & {
        requests?: PairingRequest[];
      };
      if (res.ok) {
        setPairingRequests(body.requests ?? []);
      } else {
        setPairingError(apiErrorMessage(body));
      }
    } catch {
      setPairingError(t("errors.network"));
    } finally {
      setIsPairingLoading(false);
    }
  }, [instance.id, hasTelegram, apiErrorMessage, t]);
```

Replace `approvePairing`:

```ts
  const approvePairing = useCallback(
    async (code: string) => {
      setApprovingCode(code);
      setPairingError(null);
      try {
        const res = await fetch(`/api/instances/${instance.id}/pairing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, channel: "telegram" }),
        });
        if (res.ok) {
          setPairingRequests((prev) => prev.filter((r) => r.code !== code));
          toast.success(t("pairing.approvedTitle"), {
            description: t("pairing.approvedDescription"),
          });
        } else {
          const body = (await res.json().catch(() => ({}))) as Partial<ApiErrorBody>;
          setPairingError(apiErrorMessage(body));
        }
      } catch {
        setPairingError(t("errors.network"));
      } finally {
        setApprovingCode(null);
      }
    },
    [instance.id, apiErrorMessage, t],
  );
```

- [ ] **Step 3: Localize the pairing section of `channels-tab.tsx` (lines 155-246 only)**

Using the existing `const t = useTranslations("InstanceDetail")` at line 72:
- Refresh button label `REFRESH` → `{t("pairing.refresh")}` (keep uppercase via existing `uppercase` class if present; otherwise add `className="... uppercase"`).
- Security notice text → `{t("pairing.securityNotice")}`.
- Error box: keep semantic tokens: `className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs font-mono text-destructive"`. Add `role="alert"`.
- Loading text → `{t("pairing.loading")}`; empty title → `{t("pairing.empty")}`; empty hint → `{t("pairing.emptyHint")}`.
- Row name fallback: `req.senderName ?? t("pairing.userFallback", { id: req.senderId })`; `ID:` label → `{t("pairing.idLabel")}:`.
- Approve button label → `{t("pairing.approve")}`.
- The `{n} PENDING` badge at ~line 102 → `{t("channels.pendingBadge", { count: n })}` (key already exists in both locales).

Do not touch the WhatsApp section or the Channels header in this task.

- [ ] **Step 4: Localize errors in `pairing-dialog.tsx`**

Add `const tErr = useTranslations("InstanceDetail");` and `import { isApiErrorCode, type ApiErrorBody } from "@/lib/api-errors";`. Replace the three `setError(data.error || "...")` / `setError("Failed to connect")` sites:

```ts
const body = (await res.json().catch(() => ({}))) as Partial<ApiErrorBody>;
setError(isApiErrorCode(body.code) ? tErr(`errors.${body.code}`) : body.error || tErr("errors.internal"));
// and in catch blocks:
setError(tErr("errors.network"));
```

- [ ] **Step 5: Localize `model-provider-module.tsx` toasts**

Add `import { useTranslations } from "next-intl";`, `import { isApiErrorCode, type ApiErrorBody } from "@/lib/api-errors";`, `const t = useTranslations("InstanceDetail");`. Replace the `res.ok` branch and error handling in `handleSave`:

```ts
      const body = (await res.json().catch(() => ({}))) as Partial<ApiErrorBody> & {
        health?: string;
        healthReason?: string | null;
      };
      if (res.ok) {
        onModelChanged(finalModelId);
        setIsEditing(false);
        resetForm();
        if (body.health === "healthy") {
          toast.success(t("model.updatedTitle"), { description: t("model.updatedDescription") });
        } else {
          toast.warning(
            t("model.updatedDegraded", {
              reason: body.healthReason
                ? t(`healthReason.${body.healthReason}`)
                : t("healthReason.gateway-unreachable"),
            }),
          );
        }
      } else {
        const base = isApiErrorCode(body.code) ? t(`errors.${body.code}`) : t("model.failed");
        toast.error(base, body.detail ? { description: body.detail } : undefined);
      }
    } catch {
      toast.error(t("errors.network"));
    }
```

Add `t` to the `useCallback` dependency array.

- [ ] **Step 6: Verify keys are parallel + lint**

Run:

```bash
node -e 'const f=k=>Object.keys(JSON.parse(require("fs").readFileSync(`messages/${k}.json`))).length;console.log(f("en"),f("es"))' \
&& node -e 'const flat=(o,p="")=>Object.entries(o).flatMap(([k,v])=>typeof v==="object"?flat(v,p+k+"."):[p+k]);const a=flat(require("./messages/en.json")),b=flat(require("./messages/es.json"));const miss=a.filter(k=>!b.includes(k)).concat(b.filter(k=>!a.includes(k)));console.log(miss.length?miss:"keys identical")' \
&& npx tsc --noEmit \
&& npx eslint src/components/dashboard/instance-detail.tsx src/components/dashboard/tabs/channels-tab.tsx src/components/dashboard/pairing-dialog.tsx src/components/dashboard/model-provider-module.tsx src/components/dashboard/tabs/agents-tab.tsx
```

Expected: "keys identical"; tsc + eslint clean.

---

### Task 7: `createServer` retry on no-capacity

**Files:**
- Modify: `src/lib/hetzner.ts:45-57` (error class), `:295-401` (`createServer`)
- Modify: `src/lib/provision-instance.ts:112-118`
- Test: `src/lib/hetzner.test.ts` (append)

**Interfaces:**
- Produces:
  - `HetznerNoCapacityError.code: "no_capacity"` (readonly)
  - `NO_CAPACITY_MAX_ATTEMPTS = 3`, `NO_CAPACITY_RETRY_DELAY_MS = 20_000`, `NO_CAPACITY_RETRY_AFTER_SECONDS = 120`
  - `interface CreateServerOptions { maxAttempts?: number; retryDelayMs?: number; sleep?: (ms: number) => Promise<void> }`
  - `createServer(name, userData, sshKeyNames?, imageId?, serverType?, options?: CreateServerOptions)` — default `maxAttempts = 1` (existing behaviour; `provisionInstance` opts in).

- [ ] **Step 1: Failing tests**

Append to `src/lib/hetzner.test.ts` inside the existing `describe("createServer location fallback")` (reuses `fetchMock`, helpers, env setup):

```ts
  it("retries the whole location walk on no-capacity, sleeping between attempts", async () => {
    const sleep = vi.fn(async () => {});
    fetchMock
      .mockResolvedValueOnce(serverTypesResponse({ hel1: false, nbg1: false, fsn1: false })) // attempt 1 pre-check
      .mockResolvedValueOnce(serverTypesResponse({ hel1: false, nbg1: false, fsn1: false })) // attempt 2 pre-check
      .mockResolvedValueOnce(serverTypesResponse({ hel1: true, nbg1: true, fsn1: true }))    // attempt 3 pre-check
      .mockResolvedValueOnce(createdResponse(77));                                         // attempt 3 POST hel1

    const server = await createServer("n", "ud", undefined, undefined, "cx23", {
      maxAttempts: 3,
      retryDelayMs: 20_000,
      sleep,
    });

    expect(server.id).toBe(77);
    expect(server.location).toBe("hel1");
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 20_000);
    expect(postCalls(fetchMock)).toHaveLength(1);
  });

  it("throws HetznerNoCapacityError with code no_capacity after maxAttempts", async () => {
    const sleep = vi.fn(async () => {});
    fetchMock
      .mockResolvedValueOnce(serverTypesResponse({ hel1: false, nbg1: false, fsn1: false }))
      .mockResolvedValueOnce(serverTypesResponse({ hel1: false, nbg1: false, fsn1: false }))
      .mockResolvedValueOnce(serverTypesResponse({ hel1: false, nbg1: false, fsn1: false }));

    const err = await createServer("n", "ud", undefined, undefined, "cx23", {
      maxAttempts: 3,
      retryDelayMs: 5,
      sleep,
    }).catch((e) => e);

    expect(err).toBeInstanceOf(HetznerNoCapacityError);
    expect(err.code).toBe("no_capacity");
    expect(err.serverType).toBe("cx23");
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-capacity errors", async () => {
    const sleep = vi.fn(async () => {});
    fetchMock
      .mockResolvedValueOnce(serverTypesResponse({ hel1: true, nbg1: true, fsn1: true }))
      .mockResolvedValueOnce(jsonResponse(403, { error: { code: "forbidden", message: "nope" } }));

    await expect(
      createServer("n", "ud", undefined, undefined, "cx23", { maxAttempts: 3, sleep }),
    ).rejects.toBeInstanceOf(HetznerApiError);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("defaults to a single attempt (no sleep) when options are omitted", async () => {
    fetchMock.mockResolvedValueOnce(serverTypesResponse({ hel1: false, nbg1: false, fsn1: false }));
    await expect(createServer("n", "ud")).rejects.toBeInstanceOf(HetznerNoCapacityError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
```

Ensure `vi`, `HetznerNoCapacityError`, `HetznerApiError` are imported in the test file (check the existing import block; `jsonResponse` already exists — confirm its signature `(status, body)`).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/hetzner.test.ts`
Expected: the 4 new tests FAIL (6th argument ignored / no `code`).

- [ ] **Step 3: Implement**

In `src/lib/hetzner.ts`, update the error class:

```ts
export class HetznerNoCapacityError extends Error {
  readonly code = "no_capacity" as const;
  readonly serverType: string;
  readonly locations: string[];

  constructor(serverType: string, locations: string[]) {
    super(
      `No Hetzner capacity for server type ${serverType} in any configured location (${locations.join(", ")}). Retry later or contact support.`,
    );
    this.name = "HetznerNoCapacityError";
    this.serverType = serverType;
    this.locations = locations;
  }
}

/** Provisioning re-walks every location this many times before giving up. */
export const NO_CAPACITY_MAX_ATTEMPTS = 3;
/** Pause between walks — Hetzner stock flickers on a minutes scale. */
export const NO_CAPACITY_RETRY_DELAY_MS = 20_000;
/** What we tell the client to wait before retrying (503 body + Retry-After). */
export const NO_CAPACITY_RETRY_AFTER_SECONDS = 120;

export interface CreateServerOptions {
  /** Total attempts of the full location walk. Default 1 (no retry). */
  maxAttempts?: number;
  retryDelayMs?: number;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
```

Rename the existing `createServer` function to `async function createServerOnce(name, userData, sshKeyNames, imageId, serverType)` (same body, not exported; keep its JSDoc as "single walk"). Then add:

```ts
/**
 * Creates a Hetzner server, walking the location preference list. When every
 * location is out of stock, the whole walk is retried up to `maxAttempts`
 * times with `retryDelayMs` between attempts, then HetznerNoCapacityError is
 * thrown. Other errors are never retried here (hetznerFetch handles network retries).
 */
export async function createServer(
  name: string,
  userData: string,
  sshKeyNames?: string[],
  imageId?: string,
  serverType: string = "cx23",
  options: CreateServerOptions = {},
): Promise<HetznerServer & { location: string }> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 1);
  const retryDelayMs = options.retryDelayMs ?? NO_CAPACITY_RETRY_DELAY_MS;
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 1; ; attempt++) {
    try {
      return await createServerOnce(name, userData, sshKeyNames, imageId, serverType);
    } catch (error) {
      if (!(error instanceof HetznerNoCapacityError) || attempt >= maxAttempts) {
        throw error;
      }
      console.warn(
        `[createServer] no capacity for ${serverType} (attempt ${attempt}/${maxAttempts}), retrying in ${retryDelayMs}ms`,
      );
      await sleep(retryDelayMs);
    }
  }
}
```

- [ ] **Step 4: Opt in from `provisionInstance`**

In `src/lib/provision-instance.ts`, import `NO_CAPACITY_MAX_ATTEMPTS, NO_CAPACITY_RETRY_DELAY_MS` from `@/lib/hetzner` and change the call:

```ts
    const server = await createServer(
      serverName,
      userData,
      [key.name],
      undefined,
      serverType,
      { maxAttempts: NO_CAPACITY_MAX_ATTEMPTS, retryDelayMs: NO_CAPACITY_RETRY_DELAY_MS },
    );
```

(Check the exact existing argument list at `provision-instance.ts:112-118` and keep it; only append the options object.)

- [ ] **Step 5: Verify**

Run: `npx vitest run src/lib/hetzner.test.ts && npx tsc --noEmit && npx eslint src/lib/hetzner.ts src/lib/provision-instance.ts`
Expected: all existing + 4 new tests PASS; clean.

---

### Task 8: 503 body with code + localized Retry toast in the deploy dialog

**Files:**
- Modify: `src/app/api/instances/route.ts:21-34`
- Modify: `src/components/dashboard/deploy-dialog.tsx:218-231`
- Modify: `messages/en.json`, `messages/es.json` (`DeployDialog.noCapacityTitle`, `noCapacityBody`, `retry`)

- [ ] **Step 1: Route**

```ts
import {
  HetznerNoCapacityError,
  NO_CAPACITY_RETRY_AFTER_SECONDS,
} from "@/lib/hetzner";

function provisionErrorResponse(err: unknown) {
  if (err instanceof HetznerNoCapacityError) {
    console.error("[instances] provisioning failed: no capacity —", err.message);
    return NextResponse.json(
      {
        error: err.message,
        code: err.code,
        serverType: err.serverType,
        retryAfterSeconds: NO_CAPACITY_RETRY_AFTER_SECONDS,
      },
      {
        status: 503,
        headers: { "Retry-After": String(NO_CAPACITY_RETRY_AFTER_SECONDS) },
      },
    );
  }
  console.error("[instances] provisioning failed:", err);
  return NextResponse.json({ error: "Failed to provision server" }, { status: 500 });
}
```

- [ ] **Step 2: Messages**

`DeployDialog` in `en.json`:

```json
"noCapacityTitle": "No servers available right now",
"noCapacityBody": "Try again in {minutes} minutes. You won't be charged twice.",
"retry": "Retry"
```

`es.json`:

```json
"noCapacityTitle": "Sin servidores disponibles ahora mismo.",
"noCapacityBody": "Reintenta en {minutes} minutos. No se te cobrará dos veces.",
"retry": "Reintentar"
```

- [ ] **Step 3: Deploy dialog toast with action**

Replace the `else` branch at `deploy-dialog.tsx:223-227`:

```ts
      } else {
        const data = (await res.json().catch(() => null)) as
          | { error?: string; code?: string; retryAfterSeconds?: number }
          | null;
        setIsSubmitting(false);
        if (data?.code === "no_capacity") {
          const minutes = Math.max(1, Math.round((data.retryAfterSeconds ?? 120) / 60));
          toast.error(t("noCapacityTitle"), {
            description: t("noCapacityBody", { minutes }),
            duration: 15000,
            action: { label: t("retry"), onClick: () => void handleSubmit() },
          });
          return;
        }
        toast.error(data?.error || t("deployError"));
      }
```

Sonner 2.0.7 supports `action: { label, onClick }` on `toast.error` (verified in `node_modules/sonner/dist/index.d.ts`). The custom `Toaster` in `src/components/ui/sonner.tsx` does not override action styling. Keep the dialog mounted (no `resetForm()` on this path) so the retry re-runs `handleSubmit` with the same form state.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx eslint src/app/api/instances/route.ts src/components/dashboard/deploy-dialog.tsx`
Expected: clean. Manual check in Task 13.

---

### Task 9: Webhook — upsert subscription from `order.paid`, link by `subscriptionId`, race-safe consume

**Files:**
- Modify: `src/app/api/webhook/polar/route.ts:242-275`

- [ ] **Step 1: Imports**

`import { eq, and, isNull } from "drizzle-orm";` (keep `desc` only if still used elsewhere in the file; remove if not).

- [ ] **Step 2: Race-safe consume**

Replace the consume update (lines ~243-256):

```ts
    // Mark consumed BEFORE provisioning. The isNull guard makes concurrent
    // deliveries of the same order lose the race instead of both provisioning.
    const [consumed] = await db
      .update(pendingInstanceConfig)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(pendingInstanceConfig.id, pendingConfigId),
          isNull(pendingInstanceConfig.consumedAt),
        ),
      )
      .returning({ id: pendingInstanceConfig.id });

    if (!consumed) {
      console.log(`[Polar Webhook] pendingConfigId ${pendingConfigId} consumed concurrently — skipping`);
      return;
    }
```

- [ ] **Step 3: Upsert + link**

Replace the `linkedSub` lookup (lines ~258-263) with:

```ts
    // Upsert the subscription from the order payload so the instance is always
    // linked, regardless of whether subscription.created has arrived yet.
    const orderSub = order.subscription;
    if (orderSub) {
      await db
        .insert(subscription)
        .values({
          id: orderSub.id,
          userId: pending.userId,
          polarCustomerId: orderSub.customerId ?? order.customer.id,
          productId: orderSub.productId ?? order.productId ?? pending.productId,
          priceId: null, // OrderSubscription carries no prices; subscription.created fills it
          planType,
          status: orderSub.status,
          currentPeriodStart: orderSub.currentPeriodStart,
          currentPeriodEnd: orderSub.currentPeriodEnd,
          cancelAtPeriodEnd: orderSub.cancelAtPeriodEnd,
        })
        .onConflictDoUpdate({
          target: subscription.id,
          set: {
            status: orderSub.status,
            planType,
            currentPeriodStart: orderSub.currentPeriodStart,
            currentPeriodEnd: orderSub.currentPeriodEnd,
            cancelAtPeriodEnd: orderSub.cancelAtPeriodEnd,
          },
        });
    } else {
      console.warn(`[Polar Webhook] order ${order.id} has no subscription payload; instance will be unlinked`);
    }
    const subscriptionId = order.subscriptionId ?? orderSub?.id ?? null;
```

And in the `provisionInstance` call: `subscriptionId,` instead of `linkedSub?.id ?? null`.

Also in `onSubscriptionCreated`'s `onConflictDoUpdate.set`, add `priceId: sub.prices?.[0]?.id ?? null,` so a row first inserted by `order.paid` gets its price later.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx eslint src/app/api/webhook/polar/route.ts`
Expected: clean. If `orderSub.currentPeriodStart` is typed `Date` (it is in `OrderSubscription`), no `new Date()` wrapping is needed; if tsc complains about `string | Date`, wrap with `new Date(...)`.

---

### Task 10: Dashboard checkout state (pending / failed banner)

**Files:**
- Create: `src/lib/checkout-state.ts`
- Test: `src/lib/checkout-state.test.ts`
- Modify: `src/app/[locale]/dashboard/page.tsx`
- Modify: `src/components/dashboard/dashboard-content.tsx` (props, banner, auto-refresh, disabled deploy)
- Modify: `messages/en.json`, `messages/es.json` (`Dashboard.checkoutPending*`, `Dashboard.checkoutFailed*`)

**Interfaces:**
- Produces:
  - `type CheckoutState = "none" | "pending" | "failed"`
  - `deriveCheckoutState(input: { pending: { consumedAt: Date | null; expiresAt: Date; createdAt: Date } | null; hasAvailableSubscription: boolean; instanceCount: number; isStaff: boolean; now?: Date }): CheckoutState`
  - `PENDING_FRESHNESS_MS = 15 * 60 * 1000`
  - `DashboardProps.checkoutState: CheckoutState`

- [ ] **Step 1: Failing tests**

```ts
// src/lib/checkout-state.test.ts
import { describe, it, expect } from "vitest";
import { deriveCheckoutState, PENDING_FRESHNESS_MS } from "./checkout-state";

const now = new Date("2026-09-17T12:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
const base = { hasAvailableSubscription: true, instanceCount: 0, isStaff: false, now };
const fresh = { consumedAt: null, expiresAt: minutesAgo(-60), createdAt: minutesAgo(2) };

describe("deriveCheckoutState", () => {
  it("is none without a pending config", () => {
    expect(deriveCheckoutState({ ...base, pending: null })).toBe("none");
  });

  it("is pending while a fresh config is unconsumed and the subscription already exists", () => {
    expect(deriveCheckoutState({ ...base, pending: fresh })).toBe("pending");
  });

  it("is none when the unconsumed config is older than the freshness window (webhook never came)", () => {
    const stale = { ...fresh, createdAt: new Date(now.getTime() - PENDING_FRESHNESS_MS - 1) };
    expect(deriveCheckoutState({ ...base, pending: stale })).toBe("none");
  });

  it("is none when unconsumed but no subscription yet (user may have abandoned checkout)", () => {
    expect(deriveCheckoutState({ ...base, pending: fresh, hasAvailableSubscription: false })).toBe("none");
  });

  it("is failed when consumed, subscription available and zero instances", () => {
    expect(deriveCheckoutState({ ...base, pending: { ...fresh, consumedAt: minutesAgo(1) } })).toBe("failed");
  });

  it("is none once an instance exists", () => {
    expect(deriveCheckoutState({ ...base, pending: { ...fresh, consumedAt: minutesAgo(1) }, instanceCount: 1 })).toBe("none");
  });

  it("is none for staff", () => {
    expect(deriveCheckoutState({ ...base, pending: fresh, isStaff: true })).toBe("none");
  });

  it("is none when the pending config expired", () => {
    expect(deriveCheckoutState({ ...base, pending: { ...fresh, expiresAt: minutesAgo(1) } })).toBe("none");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/checkout-state.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/checkout-state.ts
/**
 * Derives what the dashboard should say about a Polar checkout that has no
 * instance yet. Uses only existing columns:
 *   - pending_instance_config.consumedAt is set by the order.paid webhook right
 *     before provisioning starts; provisionInstance deletes the instance row on
 *     failure. So: consumed + subscription + no instance = provisioning failed.
 *   - unconsumed + fresh + subscription = subscription.created arrived, order.paid
 *     still in flight → "setting up", block manual deploy to avoid a double server.
 */
export type CheckoutState = "none" | "pending" | "failed";

/** How long an unconsumed pending config counts as "in flight". */
export const PENDING_FRESHNESS_MS = 15 * 60 * 1000;

export interface PendingConfigSnapshot {
  consumedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

export function deriveCheckoutState(input: {
  pending: PendingConfigSnapshot | null;
  hasAvailableSubscription: boolean;
  instanceCount: number;
  isStaff: boolean;
  now?: Date;
}): CheckoutState {
  const now = input.now ?? new Date();
  const { pending } = input;

  if (input.isStaff || !pending || input.instanceCount > 0) return "none";
  if (!input.hasAvailableSubscription) return "none";
  if (pending.expiresAt.getTime() <= now.getTime()) return "none";

  if (pending.consumedAt) return "failed";

  const ageMs = now.getTime() - pending.createdAt.getTime();
  return ageMs <= PENDING_FRESHNESS_MS ? "pending" : "none";
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/checkout-state.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Load the pending config in `page.tsx`**

Add imports `pendingInstanceConfig` (from `@/lib/schema`), `deriveCheckoutState` (from `@/lib/checkout-state`). Add to the `Promise.all`:

```ts
      db
        .select({
          consumedAt: pendingInstanceConfig.consumedAt,
          expiresAt: pendingInstanceConfig.expiresAt,
          createdAt: pendingInstanceConfig.createdAt,
        })
        .from(pendingInstanceConfig)
        .where(eq(pendingInstanceConfig.userId, ctx.user.id))
        .orderBy(desc(pendingInstanceConfig.createdAt))
        .limit(1)
        .then((rows) => rows[0] ?? null),
```

Destructure it as `latestPending`, then:

```ts
  const checkoutState = deriveCheckoutState({
    pending: latestPending,
    hasAvailableSubscription: Boolean(availableSubscription),
    instanceCount: instances.length,
    isStaff: ctx.isStaff,
  });
```

Pass `checkoutState={checkoutState}` to `<DashboardContent>`.

- [ ] **Step 6: Messages**

`Dashboard` in `en.json`:

```json
"checkoutPendingTitle": "Setting up your server…",
"checkoutPendingBody": "Payment received. Your AI employee is being created — this page refreshes automatically.",
"checkoutFailedTitle": "Payment received, but we couldn't create your server",
"checkoutFailedBody": "Servers were temporarily out of stock. Press Retry to try again — you won't be charged twice. If it keeps failing, contact support.",
"checkoutRetry": "Retry"
```

`es.json`:

```json
"checkoutPendingTitle": "Configurando tu servidor…",
"checkoutPendingBody": "Pago recibido. Tu empleado IA se está creando — esta página se actualiza sola.",
"checkoutFailedTitle": "Tu pago se recibió pero no pudimos crear tu servidor",
"checkoutFailedBody": "No había servidores disponibles en ese momento. Pulsa Reintentar para volver a intentarlo — no se te cobrará dos veces. Si sigue fallando, contacta soporte.",
"checkoutRetry": "Reintentar"
```

- [ ] **Step 7: Banner + auto-refresh + disabled deploy in `dashboard-content.tsx`**

Props: add `checkoutState: CheckoutState;` (import type from `@/lib/checkout-state`) and destructure it. Add imports `Loader2, AlertTriangle` from `lucide-react`.

Auto-refresh while pending (after the existing effects):

```ts
  useEffect(() => {
    if (checkoutState !== "pending") return;
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [checkoutState, router]);
```

Banner, rendered right before the existing "Subscription CTA Banner":

```tsx
      {checkoutState === "pending" && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-xl border border-border bg-card px-6 py-4"
        >
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">{t("checkoutPendingTitle")}</p>
            <p className="text-xs text-muted-foreground font-mono">{t("checkoutPendingBody")}</p>
          </div>
        </div>
      )}

      {checkoutState === "failed" && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{t("checkoutFailedTitle")}</p>
              <p className="text-xs text-muted-foreground font-mono">{t("checkoutFailedBody")}</p>
            </div>
          </div>
          <Button
            onClick={() => setDeployOpen(true)}
            className="bg-foreground text-background hover:bg-foreground/90 font-mono text-xs uppercase tracking-wider h-9 px-5 shrink-0"
          >
            {t("checkoutRetry")}
          </Button>
        </div>
      )}
```

Disable both deploy buttons while pending: add `disabled={checkoutState === "pending"}` to the header "Hire New" `<Button>` (~line 206) and the empty-state `<Button>` (~line 255).

- [ ] **Step 8: Verify**

Run: `npx vitest run src/lib/checkout-state.test.ts && npx tsc --noEmit && npx eslint "src/app/[locale]/dashboard/page.tsx" src/components/dashboard/dashboard-content.tsx src/lib/checkout-state.ts`
Expected: clean/green. Re-run the key-parity one-liner from Task 6 Step 6.

---

### Task 11: Capacity badge = quota semantics

**Files:**
- Modify: `src/components/capacity-badge.tsx`
- Modify: `messages/en.json`, `messages/es.json` (`Capacity`)

- [ ] **Step 1: Messages**

`en.json`:

```json
"Capacity": {
  "remaining": "{count} slots left",
  "full": "No slots left",
  "quotaHint": "Account quota — not live server stock"
}
```

`es.json`:

```json
"Capacity": {
  "remaining": "Quedan {count} cupos",
  "full": "Sin cupos disponibles",
  "quotaHint": "Cupo de la cuenta — no es stock de servidores en tiempo real"
}
```

- [ ] **Step 2: Badge**

In `capacity-badge.tsx`, add `title={t("quotaHint")}` to the root `<div>` and an `sr-only` span after the label; swap the hardcoded red/amber/green classes for semantic tokens:

```tsx
  const tone = isFull
    ? "border-destructive/30 bg-destructive/10 text-destructive"
    : isLow
      ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
      : "border-border bg-muted/40 text-muted-foreground";

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono ${tone} ${
        align === "start" ? "self-start" : ""
      } ${className ?? ""}`}
      role="status"
      aria-live="polite"
      title={t("quotaHint")}
    >
      <Server className="h-3 w-3" />
      <span>{label}</span>
      <span className="sr-only">{t("quotaHint")}</span>
    </div>
  );
```

(Amber has no semantic token in this theme; it is already used for "low" elsewhere in the dashboard, keep it.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx eslint src/components/capacity-badge.tsx` + key-parity one-liner.

---

### Task 12: Docs

**Files:**
- Modify: `docs/provisioning.md` (§5 Hetzner creation, add "Checkout states" subsection, fix the "private key stored encrypted" claim at line 19 → "stored in the database")
- Modify: `docs/channels.md:40-45` (pairing)
- Modify: `docs/api-routes.md` (error codes)

- [ ] **Step 1: `docs/provisioning.md`**

In §5 after the location-fallback paragraph, add:

```markdown
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
```

Add a new section before "Status Polling":

```markdown
## Checkout states (paid but no instance yet)

`order.paid` upserts the subscription row from the order payload and links the
instance by `order.subscriptionId`, so `subscription.created` ordering no longer
matters. The dashboard derives a `checkoutState` (`src/lib/checkout-state.ts`)
from the user's latest `pending_instance_config`:

| pending config | subscription available | instances | state | UI |
|---|---|---|---|---|
| unconsumed, < 15 min old | yes | 0 | `pending` | "Setting up…" banner, deploy disabled, page auto-refreshes |
| consumed | yes | 0 | `failed` | error banner + Retry (direct deploy, no second charge) |
| anything else | — | — | `none` | normal |

Provisioning failure inside the webhook is still only logged; the `failed`
state is what makes it visible to the user.
```

- [ ] **Step 2: `docs/channels.md`** — replace the pairing workflow bullets:

```markdown
- Pairing state lives in OpenClaw's SQLite store (`~/.openclaw/state/openclaw.sqlite`,
  OpenClaw ≥ 2026.4.29). The dashboard never reads it directly:
  1. `GET /api/instances/[id]/pairing?channel=telegram` runs
     `openclaw pairing list telegram --json` over SSH (manual Refresh only — no polling).
  2. `POST /api/instances/[id]/pairing` `{ code, channel }` runs
     `openclaw pairing approve telegram <CODE>`.
  3. `channel` is whitelisted (`telegram | whatsapp`) and `code` matched against
     `^[A-Za-z0-9_-]{1,64}$` before touching the shell.
- Codes expire after 1 hour; OpenClaw keeps at most 3 pending codes per channel.
```

- [ ] **Step 3: `docs/api-routes.md`** — add a short "Error codes" section:

```markdown
## Error codes (instance SSH/CLI routes)

`pairing`, `agents` and `reconfigure` return `{ error, code, detail? }`:

| status | code | meaning |
|---|---|---|
| 400 | `invalid_channel` / `invalid_code` | rejected before touching the VPS |
| 409 | `config_invalid` | `openclaw config validate` failed (before or after the change; config restored) |
| 500 | `cli_error` | command ran and failed; `detail` = stderr tail |
| 502 | `ssh_unreachable` | could not connect/authenticate |
| 503 | `no_capacity` | (`POST /api/instances`) Hetzner out of stock; `retryAfterSeconds` |

The UI localizes by `code` (`InstanceDetail.errors.*`).
```

---

### Task 13: End-to-end verification

- [ ] **Step 1: Full suite**

```bash
npm test && npx tsc --noEmit && npx eslint \
  src/lib/ssh.ts src/lib/ssh-errors.ts src/lib/api-errors.ts src/lib/pairing.ts \
  src/lib/reconfigure-script.ts src/lib/checkout-state.ts src/lib/hetzner.ts src/lib/provision-instance.ts \
  "src/app/api/instances/[id]/pairing/route.ts" "src/app/api/instances/[id]/agents/route.ts" \
  "src/app/api/instances/[id]/reconfigure/route.ts" src/app/api/instances/route.ts \
  src/app/api/webhook/polar/route.ts "src/app/[locale]/dashboard/page.tsx" \
  src/components/dashboard/dashboard-content.tsx src/components/dashboard/deploy-dialog.tsx \
  src/components/dashboard/instance-detail.tsx src/components/dashboard/tabs/channels-tab.tsx \
  src/components/dashboard/tabs/agents-tab.tsx src/components/dashboard/pairing-dialog.tsx \
  src/components/dashboard/model-provider-module.tsx src/components/capacity-badge.tsx
```

Expected: tests green, tsc clean, eslint clean on every listed file. Re-run the message key-parity one-liner (Task 6 Step 6) → "keys identical".

- [ ] **Step 2: Manual against a real 2026.9.4 instance** (dev env hits prod DB/Hetzner — see memory "Shared Prod Env"; use an existing test instance, do not create servers)

1. Instance detail → Channels → Refresh: with a fresh `/start` to the bot, the request appears with name + code. Approve → toast "Vinculación aprobada"; `openclaw pairing list telegram` on the VPS now empty.
2. Stop the VPS (or point at a dead IP in a temp DB row) → Refresh shows the `ssh_unreachable` message, Agents tab shows the same text, network tab shows 502 `{code:"ssh_unreachable"}`.
3. `curl -s "$APP/api/instances/<id>/pairing?channel=x"` (with session cookie) → 400 `{code:"invalid_channel"}`.
4. On a VPS, temporarily break config (`jq '.ui.assistant=1' …`), then Reconfigure → 409 toast with the `config_invalid` message; restore config; Reconfigure with a valid key → success toast; `journalctl --user -u openclaw-gateway` shows a restart; `/root/.openclaw/openclaw.json.bak` absent.
5. Find a location Hetzner reports `available: false` for the plan's server type (`GET /v1/server_types?name=cx23`, look at `locations[].available`); set `HETZNER_LOCATIONS` to only that location locally and deploy as staff → after ~40 s, toast "Sin servidores disponibles ahora mismo." with a Reintentar button; response is 503 with `Retry-After: 120`. (A made-up location like `xyz1` does NOT work: the pre-check only skips explicit `available: false`, and the create call then fails with `invalid_input`, not `resource_unavailable`.) If every location is available, rely on `src/lib/hetzner.test.ts`.
6. Badge reads "Quedan N cupos" (es) / "N slots left" (en), hover shows the quota hint.
7. Checkout banner: in a local DB, insert a `pending_instance_config` row for a test user with `consumed_at = now()`, an active unlinked subscription, zero instances → dashboard shows the red "failed" banner; click Reintentar → deploy dialog opens with no plan step (`needsCheckout=false`). Set `consumed_at = NULL`, `created_at = now()` → "Configurando tu servidor…" banner, Contratar buttons disabled, page refreshes every 5 s.

- [ ] **Step 3: Report**

State plainly what passed, what was skipped (e.g. no live VPS available for step 4), with command output.

---

## Self-review

**Spec coverage.** F6.1 whitelist + CLI source + parse errors → Task 3. F6.2 error classes + route mapping → Tasks 1, 2, 3, 4, 5. F6.3 validate/backup/restart → Task 5. F6.4 localized UI (no polling per decision) → Task 6. F6.5 tests → Tasks 1–5. Approve mapping (decision 5) → Tasks 3, 6. Reconfigure injection (decision 4) → Task 5. F1.1 retry → Task 7. F1.2 code + 503 + toast → Task 8. Webhook banner (decision 2) → Tasks 9, 10. F1.3 badge → Task 11. F1.4 docs → Task 12.

**Out of scope, noted for follow-up:** `setWhatsAppAllowedNumbers` (`ssh.ts:235`) has the same single-quote injection class; WhatsApp toasts remain hardcoded English; `instance.model_api_key` plaintext; hardcoded plan prices in `dashboard-content.tsx:192,201` contradict `deploy-dialog.tsx`.

**Type consistency.** `ExecFn` unchanged; `listPairingRequests(host,key,channel,exec?)` / `approvePairingRequest(host,key,code,channel,exec?)` / `listAgents(host,key,exec?)` used identically in Tasks 3, 4, 6. `ApiErrorBody`/`isApiErrorCode` from Task 2 used in Tasks 4, 6. `CheckoutState` from Task 10 used in page + content. `NO_CAPACITY_*` constants from Task 7 used in Tasks 7, 8, 12.
