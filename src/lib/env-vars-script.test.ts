import { describe, it, expect } from "vitest";
import {
  ENV_FILE_PATH,
  ENV_SCRIPT_EXIT,
  buildReadEnvScript,
  buildWriteEnvScript,
  decodeReadEnvOutput,
} from "./env-vars-script";
import { ENV_LIMITS, ENV_RESERVED_KEYS } from "./env-file";

describe("buildReadEnvScript", () => {
  const script = buildReadEnvScript();

  it("tolerates an absent file and ships the content as base64", () => {
    expect(script).toContain(`F=${ENV_FILE_PATH}`);
    expect(script).toContain('if [ -f "$F" ]; then');
    expect(script).toContain('base64 -w0 "$F"');
  });

  it("refuses oversized files with a distinct exit code", () => {
    expect(script).toContain(
      `[ "$(stat -c %s "$F")" -le ${ENV_LIMITS.maxReadBytes} ] || exit ${ENV_SCRIPT_EXIT.fileTooLarge}`,
    );
    expect(script).toContain(`|| exit ${ENV_SCRIPT_EXIT.readFailed}`);
  });

  it("never calls openclaw and has no set -e", () => {
    expect(script).not.toMatch(/\bopenclaw (config|gateway|onboard)/);
    expect(script).not.toContain("set -e");
  });
});

describe("decodeReadEnvOutput", () => {
  it("returns an empty string for empty or whitespace output", () => {
    expect(decodeReadEnvOutput("")).toBe("");
    expect(decodeReadEnvOutput("\n")).toBe("");
  });

  it("decodes base64 with a trailing newline, preserving UTF-8", () => {
    const text = "A='ñ 🦎'\n";
    const b64 = Buffer.from(text, "utf8").toString("base64");
    expect(decodeReadEnvOutput(`${b64}\n`)).toBe(text);
  });
});

describe("buildWriteEnvScript", () => {
  const body = `# header\nA='x'; rm -rf / ; echo '\nB="it's"\n`;
  const script = buildWriteEnvScript(body);
  const b64 = Buffer.from(body, "utf8").toString("base64");

  it("never interpolates the raw body; ships it as one base64 literal", () => {
    expect(script).not.toContain("rm -rf");
    expect(script).not.toContain("it's");
    expect(script).toContain(`echo '${b64}' | base64 -d > "$F.tmp"`);
  });

  it("creates files under umask 077 before any write", () => {
    expect(script.indexOf("umask 077")).toBeLessThan(script.indexOf("base64 -d"));
    expect(script.indexOf("umask 077")).toBeLessThan(script.indexOf("cp "));
  });

  it("clears stale markers, backs up, and defines restore() before writing", () => {
    const stale = script.indexOf('rm -f "$F.bak" "$F.absent" "$F.tmp"');
    const backup = script.indexOf('cp "$F" "$F.bak"');
    const restore = script.indexOf("restore() {");
    const write = script.indexOf("base64 -d");
    expect(stale).toBeGreaterThan(-1);
    expect(stale).toBeLessThan(backup);
    expect(backup).toBeLessThan(restore);
    expect(restore).toBeLessThan(write);
    expect(script).toContain(
      `cp "$F" "$F.bak" || { rm -f "$F.bak"; exit ${ENV_SCRIPT_EXIT.backupFailed}; }`,
    );
    expect(script).toContain(': > "$F.absent"');
    expect(script).toContain(
      'restore() { if [ -f "$F.bak" ]; then mv -f "$F.bak" "$F"; elif [ -f "$F.absent" ]; then rm -f "$F" "$F.absent"; fi; }',
    );
  });

  it("restores on write, move and chmod failure with distinct exit codes", () => {
    expect(script).toContain(
      `|| { rm -f "$F.tmp"; restore; exit ${ENV_SCRIPT_EXIT.writeFailed}; }`,
    );
    expect(script).toContain(
      `mv -f "$F.tmp" "$F" || { rm -f "$F.tmp"; restore; exit ${ENV_SCRIPT_EXIT.moveFailed}; }`,
    );
    expect(script).toContain(
      `chmod 600 "$F" || { restore; exit ${ENV_SCRIPT_EXIT.chmodFailed}; }`,
    );
  });

  it("preserves reserved OpenClaw lines from the backup verbatim", () => {
    const alternation = ENV_RESERVED_KEYS.join("|");
    expect(script).toContain(
      `grep -E '^(export[[:space:]]+)?(${alternation})=' "$F.bak" >> "$F.tmp"`,
    );
    // grep exit 1 (no match) is fine; 2 is a real failure.
    expect(script).toContain("[ $? -le 1 ] ||");
  });

  it("cleans up markers and ends with the success sentinel", () => {
    expect(script).toContain('rm -f "$F.bak" "$F.absent"\necho ENV_WRITTEN');
    expect(script.trim().endsWith("echo ENV_WRITTEN")).toBe(true);
  });

  it("has no set -e and no pkill", () => {
    expect(script).not.toContain("set -e");
    expect(script).not.toContain("pkill");
  });

  it("rejects a body over the transport limit", () => {
    expect(() =>
      buildWriteEnvScript("x".repeat(ENV_LIMITS.maxFileBytes + 1)),
    ).toThrow(/too large/);
  });
});
