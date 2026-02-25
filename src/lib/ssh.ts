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

export interface PairingRequest {
  code: string;
  senderId: string;
  senderName: string | null;
  timestamp: string;
}

/**
 * Lists pending Telegram pairing requests on a remote OpenClaw instance.
 */
export async function listPairingRequests(
  host: string,
  privateKey: string,
): Promise<PairingRequest[]> {
  // Read the pairing file directly — more reliable than parsing CLI output
  const { stdout, code } = await executeCommand(
    host,
    privateKey,
    "cat /root/.openclaw/credentials/telegram-pairing.json 2>/dev/null || echo '[]'",
  );

  try {
    const raw = JSON.parse(stdout.trim());
    // The pairing file is typically an array of objects or keyed by code
    if (Array.isArray(raw)) {
      return raw.map((entry: any) => ({
        code: entry.code || "",
        senderId: String(entry.senderId || entry.from?.id || ""),
        senderName: entry.senderName || entry.from?.first_name || null,
        timestamp:
          entry.timestamp || entry.createdAt || new Date().toISOString(),
      }));
    }
    // If it's an object keyed by code
    return Object.entries(raw).map(([code, entry]: [string, any]) => ({
      code,
      senderId: String(entry.senderId || entry.from?.id || ""),
      senderName: entry.senderName || entry.from?.first_name || null,
      timestamp: entry.timestamp || entry.createdAt || new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

/**
 * Approves a Telegram pairing request on a remote OpenClaw instance.
 */
export async function approvePairingRequest(
  host: string,
  privateKey: string,
  code: string,
): Promise<{ success: boolean; error?: string }> {
  const {
    stdout,
    stderr,
    code: exitCode,
  } = await executeCommand(
    host,
    privateKey,
    `export PATH="/root/.local/bin:/usr/bin:$PATH" && openclaw pairing approve telegram ${code}`,
  );

  if (exitCode !== 0) {
    return {
      success: false,
      error: stderr.trim() || stdout.trim() || "Failed to approve pairing",
    };
  }

  return { success: true };
}
