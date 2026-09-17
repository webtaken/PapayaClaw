/**
 * Gateway health model for OpenClaw instances.
 *
 * Health is derived from two independent signals:
 *   1. Hetzner VM power state (from the Hetzner API)
 *   2. A single SSH probe on the VPS (gateway HTTP answer + config validity)
 *
 * Health is ephemeral — computed per request, never persisted.
 */

export type GatewayHealth = "healthy" | "degraded" | "down" | "unknown";

export type HealthReason =
  | "config-invalid"
  | "gateway-unreachable"
  | "vm-off"
  | "ssh-unreachable"
  | "hetzner-unknown";

export interface GatewayProbe {
  /** curl got any HTTP status from the gateway (even 4xx). */
  gatewayUp: boolean;
  /** `openclaw config validate` exited 0. */
  configValid: boolean;
  /** Raw contents of /var/tmp/openclaw-error, or null when absent. Display-only. */
  errorSentinel: string | null;
}

export interface HealthResult {
  health: GatewayHealth;
  reason: HealthReason | null;
}

/** Env needed for `openclaw` CLI and systemd --user under root. */
export const OPENCLAW_ENV =
  'export XDG_RUNTIME_DIR=/run/user/0 PATH="/root/.local/bin:/usr/local/bin:/usr/bin:$PATH"';

export const GATEWAY_URL = "http://127.0.0.1:18789/";

/**
 * Shell snippet that prints three lines: GATEWAY=<http code>, CONFIG=<exit>,
 * SENTINEL=<text|none>. Every command is allowed to fail; each line is a signal.
 */
export const PROBE_SCRIPT = [
  OPENCLAW_ENV,
  `echo "GATEWAY=$(curl -s -o /dev/null -m 5 -w '%{http_code}' ${GATEWAY_URL} 2>/dev/null || echo 000)"`,
  'openclaw config validate >/dev/null 2>&1; echo "CONFIG=$?"',
  'echo "SENTINEL=$(cat /var/tmp/openclaw-error 2>/dev/null || echo none)"',
].join("\n");

function readField(stdout: string, key: string): string | undefined {
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith(`${key}=`)) {
      return trimmed.slice(key.length + 1).trim();
    }
  }
  return undefined;
}

export function parseProbeOutput(stdout: string): GatewayProbe {
  const gateway = readField(stdout, "GATEWAY");
  const config = readField(stdout, "CONFIG");
  const sentinel = readField(stdout, "SENTINEL");

  return {
    gatewayUp: gateway !== undefined && gateway !== "000",
    configValid: config === "0",
    errorSentinel:
      sentinel === undefined || sentinel === "" || sentinel === "none"
        ? null
        : sentinel,
  };
}

export function computeHealth({
  hetznerStatus,
  probe,
}: {
  hetznerStatus: string | null;
  probe: GatewayProbe | null;
}): HealthResult {
  if (hetznerStatus === "unknown") {
    return { health: "unknown", reason: "hetzner-unknown" };
  }
  if (hetznerStatus !== "running") {
    return { health: "down", reason: "vm-off" };
  }
  if (!probe) {
    return { health: "unknown", reason: "ssh-unreachable" };
  }
  if (!probe.configValid) {
    return { health: "degraded", reason: "config-invalid" };
  }
  if (!probe.gatewayUp) {
    return { health: "degraded", reason: "gateway-unreachable" };
  }
  return { health: "healthy", reason: null };
}
