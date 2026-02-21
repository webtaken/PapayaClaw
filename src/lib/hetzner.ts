/**
 * Hetzner Cloud API client for VPS provisioning.
 *
 * Uses raw fetch() against the Hetzner Cloud REST API v1.
 * Docs: https://docs.hetzner.cloud/
 */

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

  const res = await fetch(`${HETZNER_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Hetzner API error ${res.status} on ${path}: ${body}`);
  }

  return res;
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

// ─── Server CRUD ────────────────────────────────────────────────────────────

/**
 * Creates a new Hetzner Cloud server with cloud-init user_data.
 *
 * Uses the CX22 server type (2 vCPU, 4 GB RAM, 40 GB NVMe) in Nuremberg.
 * The user_data is a cloud-init script that installs Docker + OpenClaw.
 */
export async function createServer(
  name: string,
  userData: string,
): Promise<HetznerServer> {
  const res = await hetznerFetch("/servers", {
    method: "POST",
    body: JSON.stringify({
      name,
      server_type: "cx22",
      image: "ubuntu-24.04",
      location: "nbg1", // Nuremberg, Germany
      start_after_create: true,
      user_data: userData,
      labels: {
        managed_by: "papayaclaw",
      },
    }),
  });

  const data: CreateServerResponse = await res.json();
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
