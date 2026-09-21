/**
 * Pure helpers for the OpenClaw global env file (`/root/.openclaw/.env`).
 *
 * OpenClaw reads this file with dotenv semantics at gateway start. This module
 * owns parsing, serialization and validation so that the bash side only ever
 * moves an opaque base64 blob (see `env-vars-script.ts`) and the UI and API
 * share one validator.
 *
 * Relative imports only — imported by client components and API routes.
 */

export interface EnvVar {
  key: string;
  value: string;
}

/** OpenClaw runtime keys that would break or hijack the instance if edited.
 * Hidden from reads, rejected on writes, and preserved verbatim by the write
 * script. */
export const ENV_RESERVED_KEYS = [
  "OPENCLAW_HOME",
  "OPENCLAW_STATE_DIR",
  "OPENCLAW_CONFIG_PATH",
  "OPENCLAW_PROFILE",
  "OPENCLAW_GATEWAY_PORT",
  "OPENCLAW_GATEWAY_TOKEN",
  "OPENCLAW_GATEWAY_PASSWORD",
  "OPENCLAW_GATEWAY_URL",
] as const;

const RESERVED = new Set<string>(ENV_RESERVED_KEYS);

export const ENV_LIMITS = {
  maxVars: 100,
  maxKeyLength: 128,
  maxValueLength: 8192,
  /** The write script ships the whole file as one base64 literal inside a
   * single `sh -c` argument; Linux caps that at MAX_ARG_STRLEN (128 KiB).
   * 64 KiB of file → ~87 KiB of base64 + ~1 KiB of script. */
  maxFileBytes: 65536,
  /** The read script refuses to ship a file larger than this. */
  maxReadBytes: 1_048_576,
} as const;

/** dotenv identifier. Keys never reach the bash parser, so this is only a
 * compatibility constraint; OpenClaw's `${VAR}` substitution matches
 * uppercase names only, which the UI hints at. */
export const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const CONTROL_CHARS_RE = /[\x00-\x1f\x7f]/;

export const ENV_MANAGED_HEADER =
  "# Managed by PapayaClaw (Dashboard > SSH > Environment variables). Comments are not preserved.";

export function isReservedEnvKey(key: string): boolean {
  return RESERVED.has(key);
}

export type EnvIssue =
  | "empty_key"
  | "invalid_key"
  | "reserved_key"
  | "duplicate_key"
  | "key_too_long"
  | "value_too_long"
  | "value_control_chars"
  | "value_unrepresentable"
  | "too_many"
  | "file_too_large";

export interface EnvValidationError {
  /** Row index, or -1 for file-level issues. */
  index: number;
  key: string;
  issue: EnvIssue;
}

export interface ParsedEnvFile {
  vars: EnvVar[];
  /** Non-blank, non-comment lines that were not `KEY=value`. */
  skippedLines: number;
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

/** Value of one line after the `=`, following dotenv's quoting rules. */
function parseValue(raw: string): string {
  const v = raw.trim();
  if (v.length >= 2) {
    const q = v[0];
    if ((q === "'" || q === "`") && v.endsWith(q)) {
      return v.slice(1, -1);
    }
    if (q === '"' && v.endsWith('"')) {
      // dotenv expands \n and \r inside double quotes; nothing else.
      return v.slice(1, -1).replace(/\\n/g, "\n").replace(/\\r/g, "\r");
    }
  }
  // Unquoted: strip a trailing ` # comment`.
  return v.replace(/\s+#.*$/, "").trim();
}

/** Line-based dotenv-compatible reader. Never throws; unknown lines are
 * counted in `skippedLines`. Duplicate keys: last value wins, first position
 * is kept. Multi-line quoted values are not supported. */
export function parseEnvFile(text: string): ParsedEnvFile {
  const vars: EnvVar[] = [];
  const indexByKey = new Map<string, number>();
  let skippedLines = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;

    const body = line.startsWith("export ") ? line.slice(7).trimStart() : line;
    const eq = body.indexOf("=");
    if (eq === -1) {
      skippedLines++;
      continue;
    }
    const key = body.slice(0, eq).trim();
    if (!ENV_KEY_RE.test(key)) {
      skippedLines++;
      continue;
    }
    const value = parseValue(body.slice(eq + 1));

    const existing = indexByKey.get(key);
    if (existing === undefined) {
      indexByKey.set(key, vars.length);
      vars.push({ key, value });
    } else {
      vars[existing] = { key, value };
    }
  }

  return { vars, skippedLines };
}

// ---------------------------------------------------------------------------
// Serialize
// ---------------------------------------------------------------------------

/**
 * Picks the quoting that round-trips through `parseEnvFile` (and dotenv).
 * Returns null when no quoting can represent the value.
 *
 * Single quotes first: they keep `$`, `#`, spaces, `"` and `\` literal and
 * are skipped by dotenv-expand, so a secret never gets interpolated.
 */
function quoteValue(value: string): string | null {
  if (value === "") return "''";
  if (!value.includes("'")) return `'${value}'`;
  if (!value.includes('"') && !value.includes("\\") && !value.includes("$")) {
    return `"${value}"`;
  }
  if (!value.includes("`")) return `\`${value}\``;
  const bareSafe =
    !value.includes("#") &&
    value === value.trim() &&
    !(value.length >= 2 && value[0] === value[value.length - 1] &&
      (value[0] === "'" || value[0] === '"' || value[0] === "`"));
  return bareSafe ? value : null;
}

/** Writes `KEY=value` lines under the managed header, preserving order.
 * Throws on a value `quoteValue` cannot represent; call `validateEnvVars`
 * first to surface that as an issue instead. */
export function serializeEnvFile(vars: EnvVar[]): string {
  const lines = vars.map(({ key, value }) => {
    const quoted = quoteValue(value);
    if (quoted === null) {
      throw new Error(`Env var "${key}" has an unrepresentable value`);
    }
    return `${key}=${quoted}`;
  });
  return [ENV_MANAGED_HEADER, ...lines].join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Shared by the panel (inline messages) and the API (400). Empty = valid.
 * File-level issues are only reported when every row is valid. */
export function validateEnvVars(vars: EnvVar[]): EnvValidationError[] {
  const errors: EnvValidationError[] = [];
  const seen = new Set<string>();

  vars.forEach(({ key, value }, index) => {
    const issue = ((): EnvIssue | null => {
      if (key === "") return "empty_key";
      if (key.length > ENV_LIMITS.maxKeyLength) return "key_too_long";
      if (!ENV_KEY_RE.test(key)) return "invalid_key";
      if (isReservedEnvKey(key)) return "reserved_key";
      if (seen.has(key)) return "duplicate_key";
      if (value.length > ENV_LIMITS.maxValueLength) return "value_too_long";
      if (CONTROL_CHARS_RE.test(value)) return "value_control_chars";
      if (quoteValue(value) === null) return "value_unrepresentable";
      return null;
    })();
    seen.add(key);
    if (issue) errors.push({ index, key, issue });
  });

  if (errors.length > 0) return errors;

  if (vars.length > ENV_LIMITS.maxVars) {
    return [{ index: -1, key: "", issue: "too_many" }];
  }
  if (byteLength(serializeEnvFile(vars)) > ENV_LIMITS.maxFileBytes) {
    return [{ index: -1, key: "", issue: "file_too_large" }];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Merge (import dialog)
// ---------------------------------------------------------------------------

export interface MergeResult {
  vars: EnvVar[];
  added: number;
  updated: number;
  skippedReserved: number;
}

/** Merges pasted vars into the current list: existing keys are updated in
 * place, new keys appended, reserved keys dropped. */
export function mergeEnvVars(current: EnvVar[], incoming: EnvVar[]): MergeResult {
  const vars = current.map((v) => ({ ...v }));
  const indexByKey = new Map(vars.map((v, i) => [v.key, i] as const));
  let added = 0;
  let updated = 0;
  let skippedReserved = 0;

  for (const { key, value } of incoming) {
    if (isReservedEnvKey(key)) {
      skippedReserved++;
      continue;
    }
    const existing = indexByKey.get(key);
    if (existing === undefined) {
      indexByKey.set(key, vars.length);
      vars.push({ key, value });
      added++;
    } else if (vars[existing].value !== value) {
      vars[existing] = { key, value };
      updated++;
    }
  }

  return { vars, added, updated, skippedReserved };
}
