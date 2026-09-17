import { describe, it, expect } from "vitest";
import { generateCloudInit, DEFAULT_OPENCLAW_VERSION } from "./cloud-init";

const base = {
  instanceId: "116e0c34-9b34-4d36-9107-358d59c8d6f8",
  instanceName: "Agente de Contenido",
  model: "openrouter/anthropic/claude-haiku-4.5",
  modelApiKey: "sk-or-v1-secret",
  channel: "telegram",
  botToken: "8948466095:AAHISDybLGJOOpyfaCJxEZlJebrcuke7rvA",
  channelPhone: null,
  sshPublicKey: "ssh-ed25519 AAAA",
  tunnelToken: "tunnel-token",
  tunnelHostname: "116e0c34.papayaclaw.com",
};

describe("generateCloudInit — OpenClaw 2026.9 schema", () => {
  const out = generateCloudInit(base);

  it("pins the OpenClaw installer version", () => {
    expect(out).toContain(`--version ${DEFAULT_OPENCLAW_VERSION}`);
  });

  it("honors OPENCLAW_VERSION override", () => {
    const pinned = generateCloudInit({ ...base, openclawVersion: "2026.9.5" });
    expect(pinned).toContain("--version 2026.9.5");
  });

  it("no longer writes retired keys", () => {
    expect(out).not.toContain("ui.assistant");
    expect(out).not.toContain("dangerouslyDisableDeviceAuth");
  });

  it("writes the agent name under agents.entries.main.identity", () => {
    expect(out).toContain(".agents.entries.main.identity.name = $name");
  });

  it("disables OpenAI-backed memory search", () => {
    expect(out).toContain('.memory.search.provider = "none"');
  });

  it("denies the blocking ask_user tool", () => {
    expect(out).toContain('.tools.deny = ["ask_user"]');
  });

  it("turns thinking off for OpenRouter models", () => {
    expect(out).toContain('.agents.defaults.thinkingDefault = "off"');
  });

  it("keeps thinking default for native providers", () => {
    const native = generateCloudInit({
      ...base,
      model: "claude-haiku-4-5",
    });
    expect(native).not.toContain("thinkingDefault");
  });

  it("validates config after patching and fails the setup on error", () => {
    expect(out).toMatch(
      /openclaw config validate[\s\S]*openclaw-error[\s\S]*exit 1/,
    );
  });

  it("restarts via openclaw gateway restart with pkill fallback", () => {
    expect(out).toContain('openclaw gateway restart || pkill -f "openclaw gateway"');
  });

  it("fails setup when the gateway never comes up", () => {
    expect(out).toMatch(/gateway-timeout[\s\S]*openclaw-error/);
  });

  it("does not echo secrets into the setup log", () => {
    // onboard (api key + gateway token) and jq (bot token) run with xtrace off
    const onboardIdx = out.indexOf("openclaw onboard");
    const setPlusX = out.lastIndexOf("set +x", onboardIdx);
    expect(setPlusX).toBeGreaterThan(-1);
    const jqTokenIdx = out.indexOf("jq --arg token");
    const reenable = out.indexOf("set -x", jqTokenIdx);
    expect(reenable).toBeGreaterThan(jqTokenIdx);
  });

  it("collapses a duplicated openrouter prefix", () => {
    const dup = generateCloudInit({ ...base, model: "openrouter/openrouter/auto" });
    expect(dup).toContain('MODEL_ID="openrouter/auto"');
  });
});
