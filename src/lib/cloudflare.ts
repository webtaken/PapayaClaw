/**
 * Cloudflare API client for Tunnel and DNS management.
 *
 * Uses raw fetch() against the Cloudflare REST API v4.
 * Docs: https://developers.cloudflare.com/api/
 *
 * Each PapayaClaw instance gets its own Cloudflare Tunnel,
 * routing HTTPS traffic through <id>.papayaclaw.com to the
 * OpenClaw gateway on localhost:18789 inside the VPS.
 */

import dns from "node:dns";
import crypto from "node:crypto";

// Force IPv4 first — same fix as hetzner.ts
dns.setDefaultResultOrder("ipv4first");

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

function getCloudflareConfig(): {
  apiToken: string;
  accountId: string;
  zoneId: string;
} {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;

  if (!apiToken) {
    throw new Error(
      "CLOUDFLARE_API_TOKEN is not set. Add it to .env.development.local",
    );
  }
  if (!accountId) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID is not set. Add it to .env.development.local",
    );
  }
  if (!zoneId) {
    throw new Error(
      "CLOUDFLARE_ZONE_ID is not set. Add it to .env.development.local",
    );
  }

  return { apiToken, accountId, zoneId };
}

/** The domain used for tunnel subdomains. */
const TUNNEL_DOMAIN = "papayaclaw.com";

// ─── Generic Fetch ──────────────────────────────────────────────────────────

async function cfFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const { apiToken } = getCloudflareConfig();
  const method = (options.method || "GET").toUpperCase();
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch(`${CF_API_BASE}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const body = await res.text();
        console.error(
          `[cfFetch] API Error ${res.status} on ${method} ${path}:`,
          body,
        );
        throw new Error(
          `Cloudflare API error ${res.status} on ${method} ${path}: ${body}`,
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
        const delay = Math.min(attempt * 2000, 6000);
        console.warn(
          `[cfFetch] Attempt ${attempt}/${maxRetries} failed on ${method} ${path}, retrying in ${delay}ms...`,
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      console.error(
        `[cfFetch] Error on ${method} ${path} (attempt ${attempt}/${maxRetries}):`,
        error?.message,
      );
      throw error;
    }
  }

  throw new Error("Unreachable");
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CloudflareTunnel {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

export interface CloudflareDnsRecord {
  id: string;
  name: string;
  type: string;
  content: string;
}

// ─── Tunnel CRUD ────────────────────────────────────────────────────────────

/**
 * Creates a new Cloudflare Tunnel.
 * Returns the tunnel UUID and the run token for cloudflared.
 */
export async function createTunnel(name: string): Promise<{
  tunnelId: string;
  tunnelToken: string;
}> {
  const { accountId } = getCloudflareConfig();

  // Generate a random 32-byte secret (base64-encoded)
  const tunnelSecret = crypto.randomBytes(32).toString("base64");

  const res = await cfFetch(`/accounts/${accountId}/cfd_tunnel`, {
    method: "POST",
    body: JSON.stringify({
      name,
      config_src: "cloudflare",
      tunnel_secret: tunnelSecret,
    }),
  });

  const data = await res.json();
  const tunnelId = data.result.id;

  console.log(`[createTunnel] Tunnel ${tunnelId} created: ${name}`);

  // Now get the run token for cloudflared
  const tokenRes = await cfFetch(
    `/accounts/${accountId}/cfd_tunnel/${tunnelId}/token`,
  );
  const tokenData = await tokenRes.json();
  const tunnelToken = tokenData.result;

  return { tunnelId, tunnelToken };
}

/**
 * Configures a remotely-managed tunnel's ingress rules.
 * Routes the given hostname to http://localhost:18789 (OpenClaw gateway).
 */
export async function configureTunnel(
  tunnelId: string,
  hostname: string,
): Promise<void> {
  const { accountId } = getCloudflareConfig();

  await cfFetch(
    `/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`,
    {
      method: "PUT",
      body: JSON.stringify({
        config: {
          ingress: [
            {
              hostname,
              service: "http://localhost:18789",
            },
            {
              // Catch-all rule (required by Cloudflare)
              service: "http_status:404",
            },
          ],
        },
      }),
    },
  );

  console.log(
    `[configureTunnel] Tunnel ${tunnelId} configured: ${hostname} → localhost:18789`,
  );
}

/**
 * Deletes a Cloudflare Tunnel.
 * The tunnel must have no active connections; cloudflared should be stopped first.
 */
export async function deleteTunnel(tunnelId: string): Promise<void> {
  const { accountId } = getCloudflareConfig();

  // First, clean up any active connections
  try {
    await cfFetch(`/accounts/${accountId}/cfd_tunnel/${tunnelId}/connections`, {
      method: "DELETE",
    });
  } catch (error) {
    console.warn(
      `[deleteTunnel] Failed to clean connections for ${tunnelId}:`,
      error,
    );
  }

  await cfFetch(`/accounts/${accountId}/cfd_tunnel/${tunnelId}`, {
    method: "DELETE",
  });

  console.log(`[deleteTunnel] Tunnel ${tunnelId} deleted`);
}

// ─── DNS ────────────────────────────────────────────────────────────────────

/**
 * Creates a CNAME DNS record pointing a subdomain to the tunnel.
 * e.g., abc123.papayaclaw.com → <tunnelId>.cfargotunnel.com
 *
 * Returns the DNS record ID for later cleanup.
 */
export async function createDnsRecord(
  subdomain: string,
  tunnelId: string,
): Promise<{ recordId: string; hostname: string }> {
  const { zoneId } = getCloudflareConfig();
  const hostname = `${subdomain}.${TUNNEL_DOMAIN}`;

  const res = await cfFetch(`/zones/${zoneId}/dns_records`, {
    method: "POST",
    body: JSON.stringify({
      type: "CNAME",
      name: subdomain,
      content: `${tunnelId}.cfargotunnel.com`,
      proxied: true, // Must be proxied for Cloudflare Tunnel
      ttl: 1, // Auto TTL when proxied
    }),
  });

  const data = await res.json();
  const recordId = data.result.id;

  console.log(
    `[createDnsRecord] CNAME ${hostname} → ${tunnelId}.cfargotunnel.com (record: ${recordId})`,
  );

  return { recordId, hostname };
}

/**
 * Deletes a DNS record by its ID.
 */
export async function deleteDnsRecord(recordId: string): Promise<void> {
  const { zoneId } = getCloudflareConfig();

  await cfFetch(`/zones/${zoneId}/dns_records/${recordId}`, {
    method: "DELETE",
  });

  console.log(`[deleteDnsRecord] Record ${recordId} deleted`);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Generates a short, URL-safe subdomain identifier from an instance ID.
 * e.g., "a1b2c3d4-..." → "a1b2c3d4"
 */
export function instanceSubdomain(instanceId: string): string {
  return instanceId.slice(0, 8);
}
