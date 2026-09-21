/**
 * Hetzner Cloud API client for VPS provisioning.
 *
 * Uses raw fetch() against the Hetzner Cloud REST API v1.
 * Docs: https://docs.hetzner.cloud/
 */

import dns from "node:dns";

// Force IPv4 first — Node's fetch tries IPv6 by default, which times out
// on networks without IPv6 connectivity (ETIMEDOUT / AggregateError).
dns.setDefaultResultOrder("ipv4first");

const HETZNER_API_BASE = "https://api.hetzner.cloud/v1";

const DEFAULT_LOCATIONS = ["hel1", "nbg1", "fsn1"];

/** Hetzner error code returned (HTTP 412) when a location is out of stock. */
const STOCK_ERROR_CODE = "resource_unavailable";

/**
 * Non-2xx response from the Hetzner API. `code` is the machine-readable
 * `error.code` from the response body (null if the body wasn't JSON).
 */
export class HetznerApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly apiMessage: string | null;

  constructor(
    message: string,
    status: number,
    code: string | null,
    apiMessage: string | null,
  ) {
    super(message);
    this.name = "HetznerApiError";
    this.status = status;
    this.code = code;
    this.apiMessage = apiMessage;
  }
}

/** Thrown when no configured location has stock for the requested server type. */
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
  /** How long to wait for the async create_server action (default 90 s). */
  actionTimeoutMs?: number;
  actionPollMs?: number;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Location preference order for server creation.
 * Reads HETZNER_LOCATIONS (comma-separated) at call time; defaults to hel1,nbg1,fsn1.
 */
export function getLocationPreference(): string[] {
  const raw = process.env.HETZNER_LOCATIONS;
  if (!raw) return [...DEFAULT_LOCATIONS];
  const parsed = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parsed.length ? parsed : [...DEFAULT_LOCATIONS];
}

export function getApiToken(): string {
  const token = process.env.HETZNER_API_TOKEN;
  if (!token) {
    throw new Error(
      "HETZNER_API_TOKEN is not set. Add it to .env.development.local",
    );
  }
  return token;
}

/**
 * Shape of the `code`/`cause`/`name`/`message` fields we read off whatever
 * `fetch()` throws (Node/undici network errors, `AbortError`, etc). These
 * errors aren't a fixed class, so we narrow with a runtime check instead of
 * trusting a cast.
 */
interface FetchErrorLike {
  code?: string;
  name?: string;
  message?: string;
  cause?: {
    code?: string;
    message?: string;
    errors?: Array<{
      message?: string;
      code?: string;
      syscall?: string;
      address?: string;
    }>;
  };
}

function asFetchErrorLike(error: unknown): FetchErrorLike {
  return typeof error === "object" && error !== null
    ? (error as FetchErrorLike)
    : {};
}

async function hetznerFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getApiToken();
  const method = (options.method || "GET").toUpperCase();
  // Retry all methods — network timeouts (ETIMEDOUT/ENETUNREACH) mean the
  // request never reached Hetzner, so there's no risk of creating duplicates.
  // Even if a POST somehow did go through, Hetzner returns 409 for duplicates.
  const maxRetries = 4;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    // 30s timeout — generous for Peru → Europe on mobile (Entel 4G)
    const timeout = setTimeout(() => controller.abort(), 40_000);

    try {
      const res = await fetch(`${HETZNER_API_BASE}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const body = await res.text();
        console.error(
          `[hetznerFetch] API Error ${res.status} on ${method} ${path}:`,
          body,
        );
        let code: string | null = null;
        let apiMessage: string | null = null;
        try {
          const parsed = JSON.parse(body);
          code =
            typeof parsed?.error?.code === "string" ? parsed.error.code : null;
          apiMessage =
            typeof parsed?.error?.message === "string"
              ? parsed.error.message
              : null;
        } catch {
          // non-JSON body (e.g. HTML from a proxy) — leave code null
        }
        throw new HetznerApiError(
          `Hetzner API error ${res.status} on ${method} ${path}: ${body}`,
          res.status,
          code,
          apiMessage,
        );
      }

      return res;
    } catch (error) {
      clearTimeout(timeout);

      const err = asFetchErrorLike(error);

      const isNetworkError =
        err.code === "ETIMEDOUT" ||
        err.cause?.code === "ETIMEDOUT" ||
        err.name === "AbortError" ||
        err.message === "fetch failed";

      if (isNetworkError && attempt < maxRetries) {
        const delay = Math.min(attempt * 2000, 8000); // 2s, 4s, 8s (capped)
        console.warn(
          `[hetznerFetch] Attempt ${attempt}/${maxRetries} failed on ${method} ${path}, retrying in ${delay}ms...`,
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      console.error(
        `[hetznerFetch] Network/Fetch Error on ${method} ${path} (attempt ${attempt}/${maxRetries}):`,
      );
      console.error(`  message: ${err.message}`);
      console.error(`  code: ${err.code}`);
      console.error(`  name: ${err.name}`);
      if (err.cause) {
        console.error(
          `  cause: ${err.cause.message} (code: ${err.cause.code})`,
        );
        if (err.cause.errors) {
          err.cause.errors.forEach((e, i) => {
            console.error(
              `    sub-error[${i}]: ${e.message} (code: ${e.code}, syscall: ${e.syscall}, address: ${e.address})`,
            );
          });
        }
      }
      throw error;
    }
  }

  // TypeScript needs this — unreachable in practice
  throw new Error("Unreachable");
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface HetznerAction {
  id: number;
  status: string; // "running" | "success" | "error"
  command: string;
  progress: number;
  error?: { code: string; message: string } | null;
}

export interface HetznerServer {
  id: number;
  name: string;
  status: string;
  public_net: {
    ipv4: {
      ip: string;
    };
    ipv6: {
      ip: string;
    };
  };
  server_type: {
    name: string;
    description: string;
  };
  created: string;
}

interface CreateServerResponse {
  server: HetznerServer;
  action: { id: number; status: string };
}

interface GetServerResponse {
  server: HetznerServer;
}

export interface ActionResponse {
  action: HetznerAction;
}

interface SSHKeyResponse {
  ssh_key: { id: number; name: string; public_key: string };
}

interface ServerTypesResponse {
  server_types: Array<{
    id: number;
    name: string;
    locations?: Array<{ id: number; name: string; available: boolean }>;
  }>;
}

// ─── Availability ───────────────────────────────────────────────────────────

/**
 * Per-location stock for a server type, from GET /server_types?name=<type>
 * (`server_types[].locations[].available`). Locations Hetzner doesn't list
 * are absent from the map. Empty map if the type is unknown.
 *
 * DIAGNOSTICS / UI ONLY. This flag MUST NEVER gate or order provisioning.
 * On 2026-09-21 it reported cx23 unavailable in hel1, nbg1 and fsn1 while
 * `POST /servers` succeeded in all three within a second; using it as a
 * pre-check in `createServerOnce` blocked every production provision for
 * ~30 minutes. `POST /servers` returning 412 `resource_unavailable` is the
 * only trustworthy stock signal.
 */
export async function getServerTypeAvailability(
  serverType: string,
): Promise<Record<string, boolean>> {
  const res = await hetznerFetch(
    `/server_types?name=${encodeURIComponent(serverType)}`,
  );
  const data: ServerTypesResponse = await res.json();
  const type = data.server_types.find((t) => t.name === serverType);
  const result: Record<string, boolean> = {};
  for (const loc of type?.locations ?? []) {
    result[loc.name] = loc.available;
  }
  return result;
}

// ─── SSH Keys ───────────────────────────────────────────────────────────────

/**
 * Uploads a public SSH key to Hetzner Cloud.
 * Returns the key name (used as reference in server creation).
 */
export async function uploadSSHKey(
  name: string,
  publicKey: string,
): Promise<{ id: number; name: string }> {
  const res = await hetznerFetch("/ssh_keys", {
    method: "POST",
    body: JSON.stringify({
      name,
      public_key: publicKey,
      labels: { managed_by: "papayaclaw" },
    }),
  });

  const data: SSHKeyResponse = await res.json();
  return { id: data.ssh_key.id, name: data.ssh_key.name };
}

/**
 * Deletes an SSH key from Hetzner Cloud.
 */
export async function deleteSSHKey(keyId: number): Promise<void> {
  await hetznerFetch(`/ssh_keys/${keyId}`, { method: "DELETE" });
}

// ─── Server CRUD ────────────────────────────────────────────────────────────

/**
 * Creates a new Hetzner Cloud server with cloud-init user_data — single walk.
 *
 * Server type is determined by plan: Basic → cx23, Pro → cx33.
 * The user_data is a cloud-init script that provisions OpenClaw.
 *
 * Location: walks `getLocationPreference()` in order and calls POST /servers
 * for each. A 412 `resource_unavailable` answer is the ONLY signal to move to
 * the next location; any other error is rethrown. Throws
 * HetznerNoCapacityError once every location has answered 412.
 *
 * There is deliberately NO availability pre-check (`GET /server_types`,
 * `locations[].available`) here. That flag is unreliable: on 2026-09-21 it
 * reported cx23 out of stock in every configured location while POST /servers
 * succeeded in all of them, and gating on it blocked all provisioning.
 * The returned object carries the location actually used.
 */
/** How long to wait for Hetzner's async `create_server` action to settle. */
export const CREATE_ACTION_TIMEOUT_MS = 90_000;
export const CREATE_ACTION_POLL_MS = 2_000;

type CreateOnceOptions = {
  sleep: (ms: number) => Promise<void>;
  actionTimeoutMs: number;
  actionPollMs: number;
};

/**
 * Waits for the `create_server` action to leave "running". Returns the final
 * action. A 201 from POST /servers is NOT a created server: on 2026-09-21 the
 * action failed 22 s later with `resource_unavailable` and Hetzner removed the
 * server, leaving a DB row pointing at a phantom. If the action is still
 * running after `actionTimeoutMs`, we give up waiting and let the SSH poller
 * decide — better than holding the request forever.
 */
async function waitForCreateAction(
  action: { id: number; status: string },
  opts: CreateOnceOptions,
): Promise<HetznerAction> {
  let current: HetznerAction = { ...action, command: "create_server", progress: 0 };
  const deadline = Date.now() + opts.actionTimeoutMs;
  while (current.status === "running") {
    if (Date.now() >= deadline) {
      console.warn(
        `[createServer] action ${action.id} still running after ${opts.actionTimeoutMs}ms, proceeding without confirmation`,
      );
      return current;
    }
    await opts.sleep(opts.actionPollMs);
    current = await getAction(action.id);
  }
  return current;
}

async function createServerOnce(
  name: string,
  userData: string,
  sshKeyNames?: string[],
  imageId?: string,
  serverType: string = "cx23",
  opts: CreateOnceOptions = {
    sleep: defaultSleep,
    actionTimeoutMs: CREATE_ACTION_TIMEOUT_MS,
    actionPollMs: CREATE_ACTION_POLL_MS,
  },
): Promise<HetznerServer & { location: string }> {
  const preference = getLocationPreference();
  let previousFailure: string | null = null;

  for (const location of preference) {
    const body: Record<string, unknown> = {
      name,
      server_type: serverType,
      image: imageId || "ubuntu-24.04",
      location,
      start_after_create: true,
      user_data: userData,
      labels: {
        managed_by: "papayaclaw",
      },
      public_net: {
        enable_ipv4: true,
        enable_ipv6: false,
      },
    };

    if (sshKeyNames?.length) {
      body.ssh_keys = sshKeyNames;
    }

    let res: Response;
    try {
      res = await hetznerFetch("/servers", {
        method: "POST",
        body: JSON.stringify(body),
      });
    } catch (error) {
      if (error instanceof HetznerApiError && error.code === STOCK_ERROR_CODE) {
        console.warn(
          `[createServer] ${location} out of stock for ${serverType} (${STOCK_ERROR_CODE}), trying next location`,
        );
        previousFailure = location;
        continue;
      }
      throw error;
    }

    const data: CreateServerResponse = await res.json();

    // 201 only means "accepted". Wait for the async create_server action.
    const action = await waitForCreateAction(data.action, opts);
    if (action.status === "error") {
      const code = action.error?.code ?? "unknown";
      console.warn(
        `[createServer] ${location}: create_server action ${action.id} for server ${data.server.id} failed (${code}: ${action.error?.message ?? ""}), cleaning up and trying next location`,
      );
      try {
        await deleteServer(data.server.id);
      } catch (error) {
        if (!(error instanceof HetznerApiError && error.status === 404)) {
          console.error(
            `[createServer] failed to delete phantom server ${data.server.id}:`,
            error instanceof Error ? error.message : error,
          );
        }
      }
      previousFailure = `${location} (action ${code})`;
      continue;
    }

    const reason = previousFailure
      ? `fallback after ${previousFailure}`
      : "first preference";

    console.log(
      `[createServer] Server ${data.server.id} created in ${location} (${reason}) — status: ${data.server.status}, action: ${action.status}`,
    );

    return { ...data.server, location };
  }

  console.error(
    `[createServer] every location refused ${serverType} (412 ${STOCK_ERROR_CODE} or failed create action): ${preference.join(", ")}`,
  );
  throw new HetznerNoCapacityError(serverType, preference);
}

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
      return await createServerOnce(name, userData, sshKeyNames, imageId, serverType, {
        sleep,
        actionTimeoutMs: options.actionTimeoutMs ?? CREATE_ACTION_TIMEOUT_MS,
        actionPollMs: options.actionPollMs ?? CREATE_ACTION_POLL_MS,
      });
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

/**
 * Gets the current state of a Hetzner server.
 */
export async function getServer(serverId: number): Promise<HetznerServer> {
  const res = await hetznerFetch(`/servers/${serverId}`);
  const data: GetServerResponse = await res.json();
  return data.server;
}

/**
 * Deletes a Hetzner server permanently.
 * This is irreversible and stops billing immediately.
 */
export async function deleteServer(serverId: number): Promise<void> {
  await hetznerFetch(`/servers/${serverId}`, {
    method: "DELETE",
  });
}

/**
 * Powers on a stopped Hetzner server.
 */
export async function powerOn(serverId: number): Promise<void> {
  await hetznerFetch(`/servers/${serverId}/actions/poweron`, {
    method: "POST",
  });
}

/**
 * Powers off a running Hetzner server (hard shutdown).
 */
export async function powerOff(serverId: number): Promise<void> {
  await hetznerFetch(`/servers/${serverId}/actions/poweroff`, {
    method: "POST",
  });
}

/**
 * Gracefully shuts down a Hetzner server via ACPI signal.
 * Preferred over powerOff when the OS is responsive.
 */
export async function shutdown(serverId: number): Promise<ActionResponse> {
  const res = await hetznerFetch(`/servers/${serverId}/actions/shutdown`, {
    method: "POST",
  });
  return res.json();
}

/**
 * Creates a snapshot image of a Hetzner server.
 */
export async function createImage(
  serverId: number,
  description: string,
): Promise<{ image: { id: number; name: string }; action: HetznerAction }> {
  const res = await hetznerFetch(`/servers/${serverId}/actions/create_image`, {
    method: "POST",
    body: JSON.stringify({
      type: "snapshot",
      description,
      labels: { managed_by: "papayaclaw", type: "base-image" },
    }),
  });
  return res.json();
}

/**
 * Gets the status of an action.
 */
export async function getAction(actionId: number): Promise<HetznerAction> {
  const res = await hetznerFetch(`/actions/${actionId}`);
  const data: ActionResponse = await res.json();
  return data.action;
}
