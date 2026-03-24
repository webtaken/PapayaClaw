/**
 * SSH utility for executing commands on remote OpenClaw VPS instances.
 *
 * Uses the ssh2 package to connect via the SSH private key stored
 * in the database for each instance.
 */

import { Client } from "ssh2";

interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

/**
 * Executes a command on a remote server over SSH.
 */
export function executeCommand(
  host: string,
  privateKey: string,
  command: string,
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const conn = new Client();

    conn
      .on("ready", () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end();
            return reject(err);
          }

          let stdout = "";
          let stderr = "";

          stream
            .on("close", (code: number) => {
              conn.end();
              resolve({ stdout, stderr, code: code ?? 0 });
            })
            .on("data", (data: Buffer) => {
              stdout += data.toString();
            })
            .stderr.on("data", (data: Buffer) => {
              stderr += data.toString();
            });
        });
      })
      .on("error", (err) => {
        reject(err);
      })
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

export interface PairingRequest {
  code: string;
  senderId: string;
  senderName: string | null;
  timestamp: string;
}

/**
 * Lists pending pairing requests on a remote OpenClaw instance.
 */
export async function listPairingRequests(
  host: string,
  privateKey: string,
  channel: string = "telegram",
): Promise<PairingRequest[]> {
  // Read the pairing file directly — more reliable than parsing CLI output
  const { stdout, code } = await executeCommand(
    host,
    privateKey,
    `cat /root/.openclaw/credentials/${channel}-pairing.json 2>/dev/null || echo '[]'`,
  );

  try {
    const raw = JSON.parse(stdout.trim());

    // The pairing file uses { version, requests: [...] } schema
    const requests: any[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw.requests)
        ? raw.requests
        : [];

    return requests.map((entry: any) => ({
      code: entry.code || "",
      senderId: String(entry.id || ""),
      senderName: entry.meta?.firstName || entry.meta?.username || null,
      timestamp: entry.createdAt || new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

/**
 * Approves a pairing request on a remote OpenClaw instance.
 */
export async function approvePairingRequest(
  host: string,
  privateKey: string,
  code: string,
  channel: string = "telegram",
): Promise<{ success: boolean; error?: string }> {
  const {
    stdout,
    stderr,
    code: exitCode,
  } = await executeCommand(
    host,
    privateKey,
    `export PATH="/root/.local/bin:/usr/bin:$PATH" && openclaw pairing approve ${channel} ${code}`,
  );

  if (exitCode !== 0) {
    return {
      success: false,
      error: stderr.trim() || stdout.trim() || "Failed to approve pairing",
    };
  }

  return { success: true };
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
