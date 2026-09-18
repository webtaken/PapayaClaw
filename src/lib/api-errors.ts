/**
 * Maps thrown errors from SSH/CLI helpers to a stable HTTP response shape.
 * The UI localizes by `code`; `error` stays English (server convention).
 * Relative imports only — this module is unit-tested and imported by client code.
 */
import { SshUnreachableError, CliError } from "./ssh-errors";

export const API_ERROR_CODES = [
  "ssh_unreachable",
  "cli_error",
  "config_invalid",
  "invalid_channel",
  "invalid_code",
  "internal",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return (
    typeof value === "string" &&
    (API_ERROR_CODES as readonly string[]).includes(value)
  );
}

export interface ApiErrorBody {
  error: string;
  code: ApiErrorCode;
  detail?: string;
}

/** `openclaw config validate` failed before or after a change. */
export class ConfigInvalidError extends Error {
  readonly detail: string;
  constructor(detail: string) {
    super("OpenClaw config is invalid");
    this.name = "ConfigInvalidError";
    this.detail = detail;
  }
}

/** Request input rejected before touching the VPS. */
export class InvalidInputError extends Error {
  readonly code: "invalid_channel" | "invalid_code";
  constructor(code: "invalid_channel" | "invalid_code", message: string) {
    super(message);
    this.name = "InvalidInputError";
    this.code = code;
  }
}

/** Last `max` characters of a CLI stream, trimmed. */
export function stderrTail(text: string, max = 500): string {
  const trimmed = text.trim();
  return trimmed.length > max ? trimmed.slice(-max) : trimmed;
}

export function toErrorResponse(err: unknown): {
  status: number;
  body: ApiErrorBody;
} {
  if (err instanceof SshUnreachableError) {
    return {
      status: 502,
      body: { error: "Could not reach the instance over SSH", code: "ssh_unreachable" },
    };
  }
  if (err instanceof ConfigInvalidError) {
    return {
      status: 409,
      body: { error: err.message, code: "config_invalid", detail: err.detail },
    };
  }
  if (err instanceof CliError) {
    const detail = stderrTail(err.stderr) || stderrTail(err.stdout);
    return {
      status: 500,
      body: {
        error: "OpenClaw command failed on the instance",
        code: "cli_error",
        ...(detail ? { detail } : {}),
      },
    };
  }
  if (err instanceof InvalidInputError) {
    return { status: 400, body: { error: err.message, code: err.code } };
  }
  return {
    status: 500,
    body: { error: "Internal error", code: "internal" },
  };
}

/**
 * Localized message for an API error body: known code → t(`errors.${code}`),
 * else the server's English `error`, else the generic `fallbackKey`.
 * `detail` is appended in parentheses. Client-safe (no server imports).
 */
export function apiErrorMessage(
  t: (key: string) => string,
  body: Partial<ApiErrorBody> | null | undefined,
  fallbackKey = "errors.internal",
): string {
  const base = isApiErrorCode(body?.code)
    ? t(`errors.${body.code}`)
    : body?.error || t(fallbackKey);
  return body?.detail ? `${base} (${body.detail})` : base;
}
