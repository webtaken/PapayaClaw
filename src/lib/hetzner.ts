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

function getApiToken(): string {
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
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

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
          `[hetznerFetch] API Error ${res.status} on ${path}:`,
          body,
        );
        throw new Error(`Hetzner API error ${res.status} on ${path}: ${body}`);
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
        const delay = attempt * 2000; // 2s, 4s backoff
        console.warn(
          `[hetznerFetch] Attempt ${attempt}/${maxRetries} failed on ${path}, retrying in ${delay}ms...`,
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      console.error(
        `[hetznerFetch] Network/Fetch Error on ${path} (attempt ${attempt}/${maxRetries}):`,
        error,
      );
      throw error;
    }
  }

  // TypeScript needs this — unreachable in practice
  throw new Error("Unreachable");
}

// ─── Types ──────────────────────────────────────────────────────────────────

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

interface ActionResponse {
  action: { id: number; status: string };
}

interface SSHKeyResponse {
  ssh_key: { id: number; name: string; public_key: string };
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
 * Uses CX23 (2 vCPU, 4 GB RAM, 40 GB NVMe) in Nuremberg.
 * The user_data is a cloud-init script that provisions OpenClaw.
 */
export async function createServer(
  name: string,
  userData: string,
  sshKeyNames?: string[],
): Promise<HetznerServer> {
  const body: Record<string, unknown> = {
    name,
    server_type: "cx23",
    image: "ubuntu-24.04",
    location: "nbg1",
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

  const res = await hetznerFetch("/servers", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const data: CreateServerResponse = await res.json();

  console.log(
    `[createServer] Server ${data.server.id} created — status: ${data.server.status}, action: ${data.action.status}`,
  );

  return data.server;
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
export async function shutdown(serverId: number): Promise<void> {
  await hetznerFetch(`/servers/${serverId}/actions/shutdown`, {
    method: "POST",
  });
}
