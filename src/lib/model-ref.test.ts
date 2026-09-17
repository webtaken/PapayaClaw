import { describe, it, expect } from "vitest";
import {
  normalizeModelRef,
  looksLikeApiKey,
  validateModelRef,
} from "./model-ref";

describe("normalizeModelRef", () => {
  it("collapses a duplicated provider prefix", () => {
    expect(normalizeModelRef("openrouter/openrouter/auto")).toBe(
      "openrouter/auto",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeModelRef("  openrouter/anthropic/claude-haiku-4.5 ")).toBe(
      "openrouter/anthropic/claude-haiku-4.5",
    );
  });

  it("lowercases the provider segment only", () => {
    expect(normalizeModelRef("OpenRouter/minimax/MiniMax-M3")).toBe(
      "openrouter/minimax/MiniMax-M3",
    );
  });

  it("leaves an already-normalized ref untouched", () => {
    expect(normalizeModelRef("anthropic/claude-haiku-4-5")).toBe(
      "anthropic/claude-haiku-4-5",
    );
  });
});

describe("looksLikeApiKey", () => {
  it("detects OpenRouter keys", () => {
    expect(looksLikeApiKey("sk-or-v1-af3410ce88ea9d4b2fb99268d1697924")).toBe(
      true,
    );
  });

  it("detects keys even when prefixed with a provider", () => {
    expect(looksLikeApiKey("openrouter/sk-or-v1-abc")).toBe(true);
  });

  it("does not flag a normal model id", () => {
    expect(looksLikeApiKey("openrouter/anthropic/claude-haiku-4.5")).toBe(
      false,
    );
  });
});

describe("validateModelRef", () => {
  it("accepts provider/model", () => {
    expect(validateModelRef("openrouter/anthropic/claude-haiku-4.5")).toEqual({
      ok: true,
      model: "openrouter/anthropic/claude-haiku-4.5",
    });
  });

  it("rejects an API key pasted as the model", () => {
    expect(validateModelRef("openrouter/sk-or-v1-abc")).toEqual({
      ok: false,
      reason: "api-key",
    });
  });

  it("rejects whitespace inside the ref", () => {
    expect(validateModelRef("openrouter/anthropic/claude haiku")).toEqual({
      ok: false,
      reason: "format",
    });
  });

  it("rejects a ref without a provider segment", () => {
    expect(validateModelRef("claude-haiku-4.5")).toEqual({
      ok: false,
      reason: "format",
    });
  });

  it("rejects an empty model", () => {
    expect(validateModelRef("   ")).toEqual({ ok: false, reason: "empty" });
  });

  it("normalizes before validating", () => {
    expect(validateModelRef(" openrouter/openrouter/auto ")).toEqual({
      ok: true,
      model: "openrouter/auto",
    });
  });
});
