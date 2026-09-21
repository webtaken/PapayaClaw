/**
 * Builds the bash scripts that read and replace `/root/.openclaw/.env` on a
 * VPS.
 *
 * Safety model (same as `reconfigure-script.ts`, simplified): the whole file
 * body travels as ONE base64 literal, so the only user-controlled bytes in the
 * script have the alphabet `[A-Za-z0-9+/=]` and can never reach the bash
 * parser. Quoting is solved once in `env-file.ts`, where it is unit-tested.
 *
 * The read side also returns base64: `executeCommand` concatenates stdout
 * chunks with `toString()`, which could split a multi-byte UTF-8 character;
 * base64 is pure ASCII and immune to that.
 *
 * No `set -e`: every step has an explicit `|| exit N` / `|| { restore; exit N; }`.
 */
import { ENV_LIMITS, ENV_RESERVED_KEYS } from "./env-file";

export const ENV_FILE_PATH = "/root/.openclaw/.env";

export const ENV_SCRIPT_EXIT = {
  // read
  fileTooLarge: 51,
  readFailed: 52,
  // write
  backupFailed: 53,
  writeFailed: 54,
  moveFailed: 55,
  chmodFailed: 56,
} as const;

/** Prints the file as a single base64 line; prints nothing when absent. */
export function buildReadEnvScript(): string {
  return [
    `F=${ENV_FILE_PATH}`,
    'if [ -f "$F" ]; then',
    `  [ "$(stat -c %s "$F")" -le ${ENV_LIMITS.maxReadBytes} ] || exit ${ENV_SCRIPT_EXIT.fileTooLarge}`,
    `  base64 -w0 "$F" || exit ${ENV_SCRIPT_EXIT.readFailed}`,
    "fi",
    "echo",
  ].join("\n");
}

/** Decodes `buildReadEnvScript` stdout. Empty output → empty file. */
export function decodeReadEnvOutput(stdout: string): string {
  const b64 = stdout.trim();
  if (b64 === "") return "";
  return Buffer.from(b64, "base64").toString("utf8");
}

/**
 * Atomically replaces the env file with `fileBody`, re-appending any reserved
 * `OPENCLAW_*` runtime lines from the previous file verbatim so the dashboard
 * can neither read nor clobber them. Backs up first and restores on any
 * failure; `.absent` marks "there was no file" so restore() removes it.
 */
export function buildWriteEnvScript(fileBody: string): string {
  const bytes = Buffer.from(fileBody, "utf8");
  if (bytes.length > ENV_LIMITS.maxFileBytes) {
    throw new Error(
      `Env file too large (${bytes.length} bytes > ${ENV_LIMITS.maxFileBytes})`,
    );
  }
  const b64 = bytes.toString("base64");
  const reserved = ENV_RESERVED_KEYS.join("|");
  const X = ENV_SCRIPT_EXIT;

  return [
    "umask 077",
    `F=${ENV_FILE_PATH}`,
    `mkdir -p /root/.openclaw || exit ${X.backupFailed}`,
    // Drop markers a previous killed run may have left, so restore() below
    // never acts on a backup it did not create itself.
    'rm -f "$F.bak" "$F.absent" "$F.tmp"',
    // A partial `cp` (e.g. ENOSPC) drops the truncated backup itself so
    // restore() can never mv a corrupt file over the intact live one.
    `if [ -f "$F" ]; then cp "$F" "$F.bak" || { rm -f "$F.bak"; exit ${X.backupFailed}; }; else : > "$F.absent" || exit ${X.backupFailed}; fi`,
    'restore() { if [ -f "$F.bak" ]; then mv -f "$F.bak" "$F"; elif [ -f "$F.absent" ]; then rm -f "$F" "$F.absent"; fi; }',
    `echo '${b64}' | base64 -d > "$F.tmp" || { rm -f "$F.tmp"; restore; exit ${X.writeFailed}; }`,
    // grep exit 1 = no reserved lines, fine; 2 = real failure.
    `if [ -f "$F.bak" ]; then grep -E '^(export[[:space:]]+)?(${reserved})=' "$F.bak" >> "$F.tmp"; [ $? -le 1 ] || { rm -f "$F.tmp"; restore; exit ${X.writeFailed}; }; fi`,
    `mv -f "$F.tmp" "$F" || { rm -f "$F.tmp"; restore; exit ${X.moveFailed}; }`,
    `chmod 600 "$F" || { restore; exit ${X.chmodFailed}; }`,
    'rm -f "$F.bak" "$F.absent"',
    "echo ENV_WRITTEN",
  ].join("\n");
}
