import { describe, it, expect } from "vitest";
import { parseAgents } from "./ssh";

describe("parseAgents", () => {
  it("maps a fully-populated agent", () => {
    const raw = [
      {
        id: "main",
        identityName: "Hertz",
        identityEmoji: "⚡",
        model: "zai/glm-5-turbo",
        isDefault: true,
        bindings: 1,
        bindingDetails: ["telegram accountId=default"],
        routes: ["default (no explicit rules)"],
        workspace: "/root/.openclaw/workspace",
        agentDir: "/root/.openclaw/agents/main/agent",
        identitySource: "identity",
      },
    ];

    expect(parseAgents(raw)).toEqual([
      {
        id: "main",
        identityName: "Hertz",
        identityEmoji: "⚡",
        model: "zai/glm-5-turbo",
        isDefault: true,
        bindingDetails: ["telegram accountId=default"],
      },
    ]);
  });

  it("omits optional fields when absent (undefined, not included)", () => {
    const raw = [{ id: "anon" }];
    const [agent] = parseAgents(raw);
    expect(agent).toEqual({
      id: "anon",
      identityName: undefined,
      identityEmoji: undefined,
      model: undefined,
      isDefault: false,
      bindingDetails: [],
    });
    // keys are still present so React can read agent.identityName ?? agent.id
    expect("identityName" in agent).toBe(true);
  });

  it("coerces non-string identity/model values away", () => {
    const raw = [{ id: "x", identityName: 0, identityEmoji: null, model: "" }];
    const [agent] = parseAgents(raw);
    expect(agent.identityName).toBeUndefined();
    expect(agent.identityEmoji).toBeUndefined();
    expect(agent.model).toBeUndefined();
  });

  it("defaults isDefault to false when missing", () => {
    const [, second] = parseAgents([
      { id: "a", isDefault: true },
      { id: "b" },
    ]);
    expect(second.isDefault).toBe(false);
  });

  it("coerces bindingDetails entries to strings, or [] when absent/non-array", () => {
    const [a, b, c] = parseAgents([
      { id: "a", bindingDetails: ["telegram accountId=default", 7] },
      { id: "b", bindingDetails: "nope" },
      { id: "c" },
    ]);
    expect(a.bindingDetails).toEqual(["telegram accountId=default", "7"]);
    expect(b.bindingDetails).toEqual([]);
    expect(c.bindingDetails).toEqual([]);
  });

  it("preserves order across multiple agents", () => {
    const raw = [{ id: "main" }, { id: "sofia" }, { id: "support" }];
    expect(parseAgents(raw).map((a) => a.id)).toEqual([
      "main",
      "sofia",
      "support",
    ]);
  });

  it("returns [] for non-array input (defensive)", () => {
    expect(parseAgents(undefined)).toEqual([]);
    expect(parseAgents({})).toEqual([]);
    expect(parseAgents("not an array")).toEqual([]);
  });
});
