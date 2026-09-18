/**
 * Error classes that let API routes distinguish "we never reached the VPS"
 * from "the VPS answered but the command failed".
 */

/** SSH connect / handshake / auth / channel-open failure. Nothing ran. */
export class SshUnreachableError extends Error {
  /** ssh2 error level (client-socket, client-timeout, client-authentication, ...). */
  readonly level: string | undefined;

  constructor(message: string, options?: { cause?: unknown; level?: string }) {
    super(message, { cause: options?.cause });
    this.name = "SshUnreachableError";
    this.level = options?.level;
  }
}

/** The command ran on the VPS and exited non-zero (or printed garbage). */
export class CliError extends Error {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;

  constructor(
    message: string,
    details: { code: number; stdout: string; stderr: string },
  ) {
    super(message);
    this.name = "CliError";
    this.code = details.code;
    this.stdout = details.stdout;
    this.stderr = details.stderr;
  }
}
