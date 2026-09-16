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
    } catch (error: any) {
      clearTimeout(timeout);

      const isNetworkError =
        error?.code === "ETIMEDOUT" ||
        error?.cause?.code === "ETIMEDOUT" ||
        error?.name === "AbortError" ||
        error?.message === "fetch failed";

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
      console.error(`  message: ${error?.message}`);
      console.error(`  code: ${error?.code}`);
      console.error(`  name: ${error?.name}`);
      if (error?.cause) {
        console.error(
          `  cause: ${error.cause.message} (code: ${error.cause.code})`,
        );
        if (error.cause.errors) {
          error.cause.errors.forEach((e: any, i: number) => {
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
  status: string;
  command: string;
  progress: number;
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
 * Creates a new Hetzner Cloud server with cloud-init user_data.
 *
 * Server type is determined by plan: Basic → cx23, Pro → cx33.
 * The user_data is a cloud-init script that provisions OpenClaw.
 *
 * Location: tries `getLocationPreference()` in order. Locations the
 * availability pre-check reports as out of stock are skipped; if
 * POST /servers still fails with `resource_unavailable`, the next location
 * is tried. Throws HetznerNoCapacityError when none has stock.
 * The returned object carries the location actually used.
 */
export async function createServer(
  name: string,
  userData: string,
  sshKeyNames?: string[],
  imageId?: string,
  serverType: string = "cx23",
): Promise<HetznerServer & { location: string }> {
  const preference = getLocationPreference();

  // Advisory pre-check: skip only locations explicitly reported unavailable.
  let availability: Record<string, boolean> = {};
  try {
    availability = await getServerTypeAvailability(serverType);
  } catch (error) {
    console.warn(
      `[createServer] availability pre-check failed for ${serverType}, trying all locations in order:`,
      error instanceof Error ? error.message : error,
    );
  }

  const candidates: string[] = [];
  for (const loc of preference) {
    if (availability[loc] === false) {
      console.warn(
        `[createServer] skipping ${loc}: ${serverType} reported unavailable (pre-check)`,
      );
    } else {
      candidates.push(loc);
    }
  }

  if (candidates.length === 0) {
    console.error(
      `[createServer] no location has stock for ${serverType} (pre-check): ${preference.join(", ")}`,
    );
    throw new HetznerNoCapacityError(serverType, preference);
  }

  let previousFailure: string | null = null;

  for (const location of candidates) {
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

    const reason =
      location === preference[0]
        ? "pre-check"
        : previousFailure
          ? `fallback after ${previousFailure}: ${STOCK_ERROR_CODE}`
          : "pre-check skipped earlier locations";

    console.log(
      `[createServer] Server ${data.server.id} created in ${location} (${reason}) — status: ${data.server.status}, action: ${data.action.status}`,
    );

    return { ...data.server, location };
  }

  console.error(
    `[createServer] every location returned ${STOCK_ERROR_CODE} for ${serverType}: ${candidates.join(", ")}`,
  );
  throw new HetznerNoCapacityError(serverType, preference);
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
