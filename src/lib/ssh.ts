/**
 * SSH utility for executing commands on remote OpenClaw VPS instances.
 *
 * Uses the ssh2 package to connect via the SSH private key stored
 * in the database for each instance.
 */

import { Client } from "ssh2";
import {
  GATEWAY_URL,
  OPENCLAW_ENV,
  PROBE_SCRIPT,
  parseProbeOutput,
  type GatewayProbe,
} from "./gateway-health";
import { SshUnreachableError, CliError } from "./ssh-errors";
import {
  parsePairingListOutput,
  type PairingChannel,
  type PairingRequest,
} from "./pairing";

export type { PairingRequest } from "./pairing";

interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

/** Signature of `executeCommand`; injectable for tests. */
export type ExecFn = (
  host: string,
  privateKey: string,
  command: string,
) => Promise<ExecResult>;

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

/**
 * Checks if the OpenClaw setup on a remote VPS has finished
 * by looking for sentinel files written by cloud-init.
 *
 * Returns "ready", "error", or "pending".
 */
export async function checkInstanceReady(
  host: string,
  privateKey: string,
): Promise<"ready" | "error" | "pending"> {
  try {
    const { stdout } = await executeCommand(
      host,
      privateKey,
      "test -f /var/tmp/openclaw-ready && echo READY || (test -f /var/tmp/openclaw-error && echo ERROR || echo PENDING)",
    );
    const status = stdout.trim();
    if (status === "READY") return "ready";
    if (status === "ERROR") return "error";
    return "pending";
  } catch {
    // SSH not up yet or connection refused
    return "pending";
  }
}

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

/**
 * Fetches the list of configured channels from a remote OpenClaw instance
 * by running `openclaw config get channels --json` and reading top-level keys.
 */
export async function getInstanceChannels(
  host: string,
  privateKey: string,
): Promise<string[]> {
  try {
    const { stdout, code } = await executeCommand(
      host,
      privateKey,
      'export PATH="/root/.local/bin:/usr/bin:$PATH" && openclaw config get channels --json',
    );
    if (code !== 0) return [];
    return Object.keys(JSON.parse(stdout.trim()));
  } catch {
    return [];
  }
}

/**
 * Fetches the WhatsApp allowFrom numbers from a remote OpenClaw instance
 * by running `openclaw config get channels.whatsapp.allowFrom --json`.
 */
export async function getWhatsAppAllowedNumbers(
  host: string,
  privateKey: string,
): Promise<string[]> {
  try {
    const { stdout, code } = await executeCommand(
      host,
      privateKey,
      'export PATH="/root/.local/bin:/usr/bin:$PATH" && openclaw config get channels.whatsapp.allowFrom --json',
    );
    if (code !== 0) return [];
    const parsed = JSON.parse(stdout.trim());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Sets the WhatsApp allowFrom numbers on a remote OpenClaw instance
 * by running `openclaw config set channels.whatsapp.allowFrom '<json>' --strict-json`.
 */
export async function setWhatsAppAllowedNumbers(
  host: string,
  privateKey: string,
  numbers: string[],
): Promise<{ success: boolean; error?: string }> {
  const jsonArray = JSON.stringify(numbers);
  const { stdout, stderr, code } = await executeCommand(
    host,
    privateKey,
    `export PATH="/root/.local/bin:/usr/bin:$PATH" && openclaw config set channels.whatsapp.allowFrom '${jsonArray}' --strict-json`,
  );

  if (code !== 0) {
    return {
      success: false,
      error: stderr.trim() || stdout.trim() || "Failed to update allowed numbers",
    };
  }

  return { success: true };
}

/**
 * One OpenClaw agent as exposed to the UI. Optional fields are `undefined`
 * when OpenClaw did not report them; consumers fall back to `id`.
 */
export interface OpenClawAgent {
  id: string;
  identityName?: string;
  identityEmoji?: string;
  model?: string;
  isDefault: boolean;
  bindingDetails: string[];
}

/**
 * Maps raw `openclaw agents list --bindings --json` output to the UI contract,
 * stripping unused fields and coercing optionals. Pure + unit-tested.
 * Expects an array (validated upstream); defensively returns [] otherwise.
 */
export function parseAgents(raw: unknown): OpenClawAgent[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry: Record<string, unknown> | null | undefined) => ({
    id: String(entry?.id ?? ""),
    identityName:
      typeof entry?.identityName === "string" && entry.identityName
        ? entry.identityName
        : undefined,
    identityEmoji:
      typeof entry?.identityEmoji === "string" && entry.identityEmoji
        ? entry.identityEmoji
        : undefined,
    model:
      typeof entry?.model === "string" && entry.model ? entry.model : undefined,
    isDefault: Boolean(entry?.isDefault),
    bindingDetails: Array.isArray(entry?.bindingDetails)
      ? entry.bindingDetails.map(String)
      : [],
  }));
}

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

/**
 * Checks if WhatsApp is linked on a remote OpenClaw instance
 * by looking for credential files.
 */
export async function checkWhatsAppLinked(
  host: string,
  privateKey: string,
): Promise<boolean> {
  const { stdout, code } = await executeCommand(
    host,
    privateKey,
    "ls /root/.openclaw/credentials/whatsapp/*/creds.json 2>/dev/null",
  );
  return code === 0 && stdout.trim().length > 0;
}

/**
 * Probes gateway health on a running VPS in ONE ssh round-trip:
 * HTTP answer on 127.0.0.1:18789, `openclaw config validate` exit code,
 * and the cloud-init error sentinel. Rejects if SSH itself fails.
 */
export async function checkGatewayHealth(
  host: string,
  privateKey: string,
  exec: ExecFn = executeCommand,
): Promise<GatewayProbe> {
  const { stdout } = await exec(host, privateKey, PROBE_SCRIPT);
  return parseProbeOutput(stdout);
}

/**
 * Restarts the OpenClaw gateway (systemd --user unit) and waits up to ~20s
 * for it to answer HTTP before probing health — all in ONE ssh command.
 * Clears the stale cloud-init error sentinel once the gateway answers.
 */
export async function restartGateway(
  host: string,
  privateKey: string,
  exec: ExecFn = executeCommand,
): Promise<ExecResult & { probe: GatewayProbe }> {
  const command = [
    OPENCLAW_ENV,
    '(openclaw gateway restart || pkill -f "openclaw gateway" || true) 2>&1',
    "for i in $(seq 1 20); do",
    `  code=$(curl -s -o /dev/null -m 2 -w '%{http_code}' ${GATEWAY_URL} 2>/dev/null || echo 000)`,
    '  if [ "$code" != "000" ]; then rm -f /var/tmp/openclaw-error; break; fi',
    "  sleep 1",
    "done",
    PROBE_SCRIPT,
  ].join("\n");

  const result = await exec(host, privateKey, command);
  return { ...result, probe: parseProbeOutput(result.stdout) };
}
