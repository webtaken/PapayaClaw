import { describe, it, expect } from "vitest";
import { validateInstanceInput } from "./instance-input";

const valid = {
  name: "Bigotito",
  model: "openrouter/anthropic/claude-haiku-4.5",
  modelApiKey: "sk-or-v1-abc",
  channel: "telegram",
  botToken: "123:abc",
};

describe("validateInstanceInput", () => {
  it("accepts a valid telegram body and normalizes the model", () => {
    const r = validateInstanceInput({
      ...valid,
      model: " openrouter/openrouter/anthropic/claude-haiku-4.5 ",
    });
    expect(r).toEqual({
      ok: true,
      data: {
        name: "Bigotito",
        model: "openrouter/anthropic/claude-haiku-4.5",
        modelApiKey: "sk-or-v1-abc",
        channel: "telegram",
        botToken: "123:abc",
        channelPhone: undefined,
        planType: undefined,
      },
    });
  });

  it("rejects an API key submitted as the model", () => {
    const r = validateInstanceInput({ ...valid, model: "openrouter/sk-or-v1-abc" });
    expect(r).toEqual({ ok: false, error: "invalidModelApiKey" });
  });

  it("rejects a model without provider prefix", () => {
    const r = validateInstanceInput({ ...valid, model: "claude-haiku-4.5" });
    expect(r).toEqual({ ok: false, error: "invalidModelFormat" });
  });

  it("requires a bot token for telegram", () => {
    const r = validateInstanceInput({ ...valid, botToken: undefined });
    expect(r).toEqual({ ok: false, error: "telegramRequiresToken" });
  });

  it("requires a phone for whatsapp", () => {
    const r = validateInstanceInput({ ...valid, channel: "whatsapp" });
    expect(r).toEqual({ ok: false, error: "whatsappRequiresPhone" });
  });

  it("requires an api key only when asked", () => {
    const r = validateInstanceInput(
      { ...valid, modelApiKey: undefined },
      { requireApiKey: true },
    );
    expect(r).toEqual({ ok: false, error: "missingFields" });
    const ok = validateInstanceInput({ ...valid, modelApiKey: undefined });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.data.modelApiKey).toBeNull();
  });

  it("rejects a non-object body", () => {
    expect(validateInstanceInput(null)).toEqual({ ok: false, error: "invalidBody" });
  });

  it("keeps only known plan types", () => {
    const r = validateInstanceInput({ ...valid, planType: "enterprise" });
    expect(r.ok && r.data.planType).toBeUndefined();
    const pro = validateInstanceInput({ ...valid, planType: "pro" });
    expect(pro.ok && pro.data.planType).toBe("pro");
  });
});
