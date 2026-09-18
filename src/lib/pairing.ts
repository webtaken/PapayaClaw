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
