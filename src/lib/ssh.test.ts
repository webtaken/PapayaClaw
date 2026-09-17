import { describe, it, expect } from "vitest";
import {
  parseAgents,
  checkGatewayHealth,
  restartGateway,
  type ExecFn,
} from "./ssh";

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

describe("checkGatewayHealth", () => {
  it("runs the probe in a single ssh command and parses it", async () => {
    const calls: string[] = [];
    const exec: ExecFn = async (_host, _key, command) => {
      calls.push(command);
      return { stdout: "GATEWAY=401\nCONFIG=0\nSENTINEL=none\n", stderr: "", code: 0 };
    };

    const probe = await checkGatewayHealth("1.2.3.4", "KEY", exec);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("XDG_RUNTIME_DIR=/run/user/0");
    expect(calls[0]).toContain("curl");
    expect(calls[0]).toContain("openclaw config validate");
    expect(calls[0]).toContain("/var/tmp/openclaw-error");
    expect(probe).toEqual({ gatewayUp: true, configValid: true, errorSentinel: null });
  });

  it("propagates SSH connection failures", async () => {
    const exec: ExecFn = async () => {
      throw new Error("ECONNREFUSED");
    };
    await expect(checkGatewayHealth("1.2.3.4", "KEY", exec)).rejects.toThrow(
      "ECONNREFUSED",
    );
  });
});

describe("restartGateway", () => {
  it("restarts via openclaw with pkill fallback, waits, then probes — one ssh command", async () => {
    const calls: string[] = [];
    const exec: ExecFn = async (_host, _key, command) => {
      calls.push(command);
      return { stdout: "GATEWAY=200\nCONFIG=0\nSENTINEL=none\n", stderr: "", code: 0 };
    };

    const result = await restartGateway("1.2.3.4", "KEY", exec);

    expect(calls).toHaveLength(1);
    const cmd = calls[0];
    expect(cmd).toContain("XDG_RUNTIME_DIR=/run/user/0");
    expect(cmd).toContain('openclaw gateway restart || pkill -f "openclaw gateway"');
    // wait loop before the probe so a booting gateway is not reported dead
    expect(cmd.indexOf("sleep")).toBeGreaterThan(-1);
    expect(cmd.indexOf("sleep")).toBeLessThan(cmd.indexOf("CONFIG="));
    // stale cloud-init sentinel is cleared once the gateway answers
    expect(cmd).toContain("rm -f /var/tmp/openclaw-error");
    expect(result).toEqual({
      code: 0,
      stderr: "",
      stdout: "GATEWAY=200\nCONFIG=0\nSENTINEL=none\n",
      probe: { gatewayUp: true, configValid: true, errorSentinel: null },
    });
  });

  it("passes through a nonzero exit code and stderr", async () => {
    const exec: ExecFn = async () => ({
      stdout: "GATEWAY=000\nCONFIG=1\nSENTINEL=config-invalid\n",
      stderr: "boom",
      code: 1,
    });

    const result = await restartGateway("1.2.3.4", "KEY", exec);

    expect(result.code).toBe(1);
    expect(result.stderr).toBe("boom");
    expect(result.probe).toEqual({
      gatewayUp: false,
      configValid: false,
      errorSentinel: "config-invalid",
    });
  });
});
