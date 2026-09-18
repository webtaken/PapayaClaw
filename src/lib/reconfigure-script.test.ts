import { describe, it, expect } from "vitest";
import {
  buildReconfigureScript,
  envVarNameFor,
  RECONFIGURE_EXIT,
} from "./reconfigure-script";

const apiKeyProvider = { id: "openrouter", authChoice: "openrouter-api-key", apiKeyFlag: "--openrouter-api-key" };

describe("envVarNameFor", () => {
  it("maps known providers and derives others", () => {
    expect(envVarNameFor("groq")).toBe("GROQ_API_KEY");
    expect(envVarNameFor("nvidia")).toBe("NVIDIA_API_KEY");
    expect(envVarNameFor("opencode-go")).toBe("OPENCODE_GO_API_KEY");
  });
  it("rejects names that are not a valid shell identifier", () => {
    expect(() => envVarNameFor("$(id)")).toThrow();
    expect(() => envVarNameFor("")).toThrow();
  });
});

describe("buildReconfigureScript", () => {
  const script = buildReconfigureScript({
    provider: apiKeyProvider,
    primaryModel: "openrouter/anthropic/claude-sonnet-5",
    apiKey: `sk-or-"; rm -rf / ; echo "`,
  });

  it("never interpolates the raw API key or model; passes both via base64", () => {
    expect(script).not.toContain("rm -rf");
    expect(script).toContain("KEY=$(echo '");
    expect(script).toContain("| base64 -d)");
    expect(script).toContain(Buffer.from(`sk-or-"; rm -rf / ; echo "`).toString("base64"));
    expect(script).toContain(Buffer.from("openrouter/anthropic/claude-sonnet-5").toString("base64"));
    expect(script).toContain('--openrouter-api-key "$KEY"');
    expect(script).toContain('--arg model "$MODEL"');
  });

  it("validates before touching anything, with a distinct exit code", () => {
    const validateIdx = script.indexOf("openclaw config validate");
    const cpIdx = script.indexOf("cp /root/.openclaw/openclaw.json /root/.openclaw/openclaw.json.bak");
    expect(validateIdx).toBeGreaterThan(-1);
    expect(validateIdx).toBeLessThan(cpIdx);
    expect(script).toContain(
      `|| { cat /run/oc-validate.err >&2; exit ${RECONFIGURE_EXIT.configInvalidBefore}; }`,
    );
  });

  it("backs up before onboard, restores on onboard/patch/post-validate failure", () => {
    const cpIdx = script.indexOf("openclaw.json.bak");
    const onboardIdx = script.indexOf("openclaw onboard");
    expect(cpIdx).toBeLessThan(onboardIdx);
    expect(script).toContain(`{ restore; exit ${RECONFIGURE_EXIT.onboardFailed}; }`);
    expect(script).toContain(`{ restore; exit ${RECONFIGURE_EXIT.patchFailed}; }`);
    expect(script).toContain(
      `{ cat /run/oc-validate.err >&2; restore; exit ${RECONFIGURE_EXIT.configInvalidAfter}; }`,
    );
    expect(script).toContain(".agents.defaults.model.primary = $model");
    expect(script.trim().endsWith("echo RECONFIGURED")).toBe(true);
  });

  it("uses OPENCLAW_ENV, no set -e, no pkill", () => {
    expect(script).toContain("XDG_RUNTIME_DIR=/run/user/0");
    expect(script).not.toContain("set -e");
    expect(script).not.toContain("pkill");
  });

  it("writes env-var providers to /root/.openclaw/.env without sed injection", () => {
    const s = buildReconfigureScript({
      provider: { id: "groq", authChoice: "skip" },
      primaryModel: "groq/llama-3.3-70b",
      apiKey: "gsk|&\\x",
    });
    expect(s).not.toContain("sed -i");
    expect(s).toContain('grep -v "^GROQ_API_KEY="');
    expect(s).toContain(`printf '%s=%s\\n' "GROQ_API_KEY" "$KEY"`);
    expect(s).toContain("--auth-choice skip");
    expect(s).not.toContain("gsk|&");
  });

  it("backs up and restores /root/.openclaw/.env for skip providers, guarded by umask and a checked chmod", () => {
    const s = buildReconfigureScript({
      provider: { id: "groq", authChoice: "skip" },
      primaryModel: "groq/llama-3.3-70b",
      apiKey: "gsk-test",
    });

    expect(s).toContain(".env.bak");
    expect(s).toContain(".env.absent");

    const restoreIdx = s.indexOf("restore() {");
    const envBackupIdx = s.indexOf(
      "cp /root/.openclaw/.env /root/.openclaw/.env.bak",
    );
    const printfIdx = s.indexOf("printf '%s=%s\\n'");
    expect(restoreIdx).toBeGreaterThan(-1);
    expect(envBackupIdx).toBeGreaterThan(-1);
    // restore() must be defined before the .env backup line runs, and the
    // backup must happen before the key is written into the file.
    expect(restoreIdx).toBeLessThan(envBackupIdx);
    expect(envBackupIdx).toBeLessThan(printfIdx);

    // restore() rolls back both the config AND the .env file (or removes it
    // if it never existed before this reconfigure).
    expect(s).toContain(
      "if [ -f /root/.openclaw/.env.bak ]; then mv -f /root/.openclaw/.env.bak /root/.openclaw/.env; elif [ -f /root/.openclaw/.env.absent ]; then rm -f /root/.openclaw/.env /root/.openclaw/.env.absent; fi",
    );

    // A partial `cp` (e.g. ENOSPC) drops the truncated .env.bak itself before
    // calling restore(), so restore() can never mv a corrupt backup over the
    // still-intact live .env.
    expect(s).toContain(
      `cp /root/.openclaw/.env /root/.openclaw/.env.bak || { rm -f /root/.openclaw/.env.bak; restore; exit ${RECONFIGURE_EXIT.envWriteFailed}; }`,
    );

    // Secret temp file is created under a restrictive umask, and the final
    // permission fix-up is itself failure-checked.
    expect(s).toContain("umask 077");
    expect(s).toContain(
      `chmod 600 /root/.openclaw/.env || { restore; exit ${RECONFIGURE_EXIT.envWriteFailed}; }`,
    );

    // Cleanup on full success removes the .env backup markers and the
    // validate-error scratch file too.
    expect(s).toContain(
      "rm -f /root/.openclaw/openclaw.json.bak /root/.openclaw/.env.bak /root/.openclaw/.env.absent /run/oc-validate.err",
    );
  });

  it("clears stale .env.bak/.env.absent markers before restore() is defined, on both provider paths", () => {
    const apiKeyScript = buildReconfigureScript({
      provider: apiKeyProvider,
      primaryModel: "openrouter/anthropic/claude-sonnet-5",
      apiKey: "sk-or-test",
    });
    const skipScript = buildReconfigureScript({
      provider: { id: "groq", authChoice: "skip" },
      primaryModel: "groq/llama-3.3-70b",
      apiKey: "gsk-test",
    });

    for (const s of [apiKeyScript, skipScript]) {
      const staleCleanupIdx = s.indexOf(
        "rm -f /root/.openclaw/.env.bak /root/.openclaw/.env.absent",
      );
      const restoreIdx = s.indexOf("restore() {");
      expect(staleCleanupIdx).toBeGreaterThan(-1);
      expect(restoreIdx).toBeGreaterThan(-1);
      // So a marker left behind by a previous killed run — on EITHER
      // provider path, including the non-skip path that never touches
      // .env at all — can never be acted on by this run's restore().
      expect(staleCleanupIdx).toBeLessThan(restoreIdx);
    }
  });

  it("rejects an API key containing control characters", () => {
    expect(() =>
      buildReconfigureScript({
        provider: apiKeyProvider,
        primaryModel: "openrouter/anthropic/claude-sonnet-5",
        apiKey: "gsk_a\nEVIL=1",
      }),
    ).toThrow("API key contains control characters");
  });

  it("rejects a non-skip provider with no apiKeyFlag", () => {
    expect(() =>
      buildReconfigureScript({
        provider: { id: "ollama", authChoice: "ollama", apiKeyFlag: "" },
        primaryModel: "ollama/llama3",
        apiKey: "irrelevant",
      }),
    ).toThrow('Provider "ollama" cannot be reconfigured with an API key');
  });
});
