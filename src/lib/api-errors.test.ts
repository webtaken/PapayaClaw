import { describe, it, expect } from "vitest";
import {
  toErrorResponse,
  stderrTail,
  ConfigInvalidError,
  InvalidInputError,
  isApiErrorCode,
  apiErrorMessage,
} from "./api-errors";
import { SshUnreachableError, CliError } from "./ssh-errors";

describe("toErrorResponse", () => {
  it("maps SshUnreachableError to 502 ssh_unreachable", () => {
    const res = toErrorResponse(new SshUnreachableError("SSH to 1.2.3.4 failed: ECONNREFUSED"));
    expect(res.status).toBe(502);
    expect(res.body.code).toBe("ssh_unreachable");
    expect(res.body.detail).toBeUndefined();
  });

  it("maps CliError to 500 cli_error with stderr tail as detail", () => {
    const res = toErrorResponse(
      new CliError("openclaw failed", { code: 1, stdout: "", stderr: "Error: boom\n" }),
    );
    expect(res.status).toBe(500);
    expect(res.body.code).toBe("cli_error");
    expect(res.body.detail).toBe("Error: boom");
  });

  it("falls back to stdout when stderr is empty", () => {
    const res = toErrorResponse(
      new CliError("x", { code: 1, stdout: "printed to stdout", stderr: "" }),
    );
    expect(res.body.detail).toBe("printed to stdout");
  });

  it("maps ConfigInvalidError to 409 config_invalid", () => {
    const res = toErrorResponse(new ConfigInvalidError("retired key ui.assistant"));
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: "OpenClaw config is invalid",
      code: "config_invalid",
      detail: "retired key ui.assistant",
    });
  });

  it("maps InvalidInputError to 400 with its code", () => {
    const res = toErrorResponse(new InvalidInputError("invalid_channel", "Unsupported channel"));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("invalid_channel");
    expect(res.body.error).toBe("Unsupported channel");
  });

  it("maps InvalidInputError invalid_env to 400 and carries issues", () => {
    const issues = [{ index: 0, key: "1BAD", issue: "invalid_key" as const }];
    const res = toErrorResponse(new InvalidInputError("invalid_env", "Invalid env", issues));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("invalid_env");
    expect(res.body.issues).toEqual(issues);
  });

  it("maps unknown errors to 500 internal without leaking the message", () => {
    const res = toErrorResponse(new Error("secret db string"));
    expect(res.status).toBe(500);
    expect(res.body.code).toBe("internal");
    expect(res.body.error).not.toContain("secret");
  });
});

describe("stderrTail", () => {
  it("returns the trimmed last N characters", () => {
    expect(stderrTail("a".repeat(600) + "END\n", 5)).toBe("aaEND");
  });
});

describe("isApiErrorCode", () => {
  it("accepts known codes and rejects others", () => {
    expect(isApiErrorCode("cli_error")).toBe(true);
    expect(isApiErrorCode("invalid_env")).toBe(true);
    expect(isApiErrorCode("no_capacity")).toBe(false);
    expect(isApiErrorCode(undefined)).toBe(false);
  });
});

describe("apiErrorMessage", () => {
  const t = (key: string) => `t:${key}`;

  it("localizes a known code and ignores the server's English error", () => {
    expect(
      apiErrorMessage(t, { error: "Could not reach the instance over SSH", code: "ssh_unreachable" }),
    ).toBe("t:errors.ssh_unreachable");
  });

  it("falls back to the server's error string when the code is unknown/absent", () => {
    expect(apiErrorMessage(t, { error: "API key contains invalid characters" })).toBe(
      "API key contains invalid characters",
    );
    expect(apiErrorMessage(t, { error: "nope", code: "no_such_code" as never })).toBe("nope");
  });

  it("falls back to the given key when there is neither a code nor an error", () => {
    expect(apiErrorMessage(t, {})).toBe("t:errors.internal");
    expect(apiErrorMessage(t, null, "model.failed")).toBe("t:model.failed");
    expect(apiErrorMessage(t, undefined, "agents.errorDescription")).toBe(
      "t:agents.errorDescription",
    );
  });

  it("appends detail in parentheses to whichever base it picked", () => {
    expect(apiErrorMessage(t, { code: "cli_error", detail: "Error: boom" })).toBe(
      "t:errors.cli_error (Error: boom)",
    );
    expect(apiErrorMessage(t, { error: "Bad key", detail: "line 3" })).toBe("Bad key (line 3)");
  });
});
