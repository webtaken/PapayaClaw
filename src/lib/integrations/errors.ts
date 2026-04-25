export const ERROR_CODES = [
  "INVALID_TOOLKIT",
  "CONNECTION_NOT_FOUND",
  "NO_CONNECTED_ACCOUNT",
  "AMBIGUOUS_ACCOUNT",
  "SELECTED_CONNECTION_NOT_OWNED",
  "NOT_ENABLED",
  "CONNECTION_UNHEALTHY",
  "PROVIDER_ERROR",
  "UPSTREAM_UNAVAILABLE",
  "INTEGRATION_UNAVAILABLE",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class IntegrationError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;

  constructor(code: ErrorCode, message: string, statusCode = 400) {
    super(message);
    this.name = "IntegrationError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function toErrorResponse(
  err: IntegrationError,
): { error: { code: ErrorCode; message: string } } {
  return { error: { code: err.code, message: err.message } };
}

const STATUS_MAP: Partial<Record<ErrorCode, number>> = {
  CONNECTION_NOT_FOUND: 404,
  NOT_ENABLED: 400,
  CONNECTION_UNHEALTHY: 409,
  PROVIDER_ERROR: 502,
  UPSTREAM_UNAVAILABLE: 502,
  INTEGRATION_UNAVAILABLE: 502,
  NO_CONNECTED_ACCOUNT: 400,
  AMBIGUOUS_ACCOUNT: 400,
  SELECTED_CONNECTION_NOT_OWNED: 400,
  INVALID_TOOLKIT: 400,
};

export function integrationError(code: ErrorCode, message: string): IntegrationError {
  return new IntegrationError(code, message, STATUS_MAP[code] ?? 400);
}
