import { describe, it, expect } from "vitest";
import { EventEmitter } from "node:events";
import type { Client } from "ssh2";
import {
  parseAgents,
  checkGatewayHealth,
  restartGateway,
  executeCommand,
  listPairingRequests,
  approvePairingRequest,
  listAgents,
  type ExecFn,
} from "./ssh";
import { SshUnreachableError, CliError } from "./ssh-errors";

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

class FakeStream extends EventEmitter {
  stderr = new EventEmitter();
}

type Behaviour = "refuse" | "timeout" | "exec-fail" | "ok";

function fakeClient(behaviour: Behaviour, exitCode: number | null = 0): Client {
  const c = new EventEmitter() as EventEmitter & {
    connect: () => void;
    exec: (cmd: string, cb: (err: Error | undefined, s: FakeStream) => void) => void;
    end: () => void;
  };
  c.end = () => {};
  c.exec = (_cmd, cb) => {
    if (behaviour === "exec-fail") {
      cb(new Error("Channel open failure"), undefined as unknown as FakeStream);
      return;
    }
    const s = new FakeStream();
    cb(undefined, s);
    setImmediate(() => {
      s.emit("data", Buffer.from("OUT"));
      s.stderr.emit("data", Buffer.from("ERR"));
      s.emit("close", exitCode);
    });
  };
  c.connect = () => {
    setImmediate(() => {
      if (behaviour === "refuse") {
        c.emit("error", Object.assign(new Error("connect ECONNREFUSED"), { level: "client-socket" }));
      } else if (behaviour === "timeout") {
        c.emit("error", Object.assign(new Error("Timed out while waiting for handshake"), { level: "client-timeout" }));
      } else {
        c.emit("ready");
      }
    });
  };
  return c as unknown as Client;
}

describe("executeCommand error classification", () => {
  it("wraps connection refusal in SshUnreachableError with the ssh2 level", async () => {
    const err = await executeCommand("1.2.3.4", "KEY", "true", () => fakeClient("refuse")).catch((e) => e);
    expect(err).toBeInstanceOf(SshUnreachableError);
    expect(err.level).toBe("client-socket");
    expect(err.message).toContain("1.2.3.4");
  });

  it("wraps handshake timeout in SshUnreachableError", async () => {
    await expect(
      executeCommand("1.2.3.4", "KEY", "true", () => fakeClient("timeout")),
    ).rejects.toBeInstanceOf(SshUnreachableError);
  });

  it("wraps exec channel failure in SshUnreachableError", async () => {
    await expect(
      executeCommand("1.2.3.4", "KEY", "true", () => fakeClient("exec-fail")),
    ).rejects.toBeInstanceOf(SshUnreachableError);
  });

  it("resolves non-zero exit as a normal result (not an error)", async () => {
    const result = await executeCommand("1.2.3.4", "KEY", "false", () => fakeClient("ok", 3));
    expect(result).toEqual({ stdout: "OUT", stderr: "ERR", code: 3 });
  });

  it("treats a signal-killed process (null exit code) as failure code 1", async () => {
    const result = await executeCommand("1.2.3.4", "KEY", "x", () => fakeClient("ok", null));
    expect(result.code).toBe(1);
  });
});

describe("listPairingRequests", () => {
  it("runs `openclaw pairing list <channel> --json` under OPENCLAW_ENV and parses", async () => {
    const calls: string[] = [];
    const exec: ExecFn = async (_h, _k, command) => {
      calls.push(command);
      return {
        stdout: '{"channel":"telegram","requests":[{"id":"1","code":"ABC","createdAt":"t","lastSeenAt":"t","meta":{"senderId":"1","firstName":"Ana"}}]}',
        stderr: "",
        code: 0,
      };
    };
    const result = await listPairingRequests("1.2.3.4", "KEY", "telegram", exec);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("XDG_RUNTIME_DIR=/run/user/0");
    expect(calls[0]).toContain("openclaw pairing list telegram --json");
    expect(result).toEqual([{ code: "ABC", senderId: "1", senderName: "Ana", timestamp: "t" }]);
  });

  it("throws CliError with stderr on non-zero exit", async () => {
    const exec: ExecFn = async () => ({ stdout: "", stderr: "Channel \"x\" does not support pairing", code: 1 });
    const err = await listPairingRequests("1.2.3.4", "KEY", "telegram", exec).catch((e) => e);
    expect(err).toBeInstanceOf(CliError);
    expect(err.stderr).toContain("does not support pairing");
  });
});

describe("approvePairingRequest", () => {
  it("runs `openclaw pairing approve <channel> <code>` and resolves on exit 0", async () => {
    const calls: string[] = [];
    const exec: ExecFn = async (_h, _k, command) => {
      calls.push(command);
      return { stdout: "Approved telegram sender 1.", stderr: "", code: 0 };
    };
    await expect(approvePairingRequest("1.2.3.4", "KEY", "ABC", "telegram", exec)).resolves.toBeUndefined();
    expect(calls[0]).toContain("openclaw pairing approve telegram ABC");
  });

  it("throws CliError when the code is unknown", async () => {
    const exec: ExecFn = async () => ({ stdout: "", stderr: 'No pending pairing request found for code "ABC".', code: 1 });
    await expect(approvePairingRequest("1.2.3.4", "KEY", "ABC", "telegram", exec)).rejects.toBeInstanceOf(CliError);
  });
});

describe("listAgents", () => {
  it("runs under OPENCLAW_ENV and returns parsed agents", async () => {
    const calls: string[] = [];
    const exec: ExecFn = async (_h, _k, command) => {
      calls.push(command);
      return { stdout: '[{"id":"main","isDefault":true}]', stderr: "", code: 0 };
    };
    const agents = await listAgents("1.2.3.4", "KEY", exec);
    expect(calls[0]).toContain("XDG_RUNTIME_DIR=/run/user/0");
    expect(calls[0]).toContain("openclaw agents list --bindings --json");
    expect(agents).toEqual([{ id: "main", isDefault: true, bindingDetails: [] }]);
  });

  it("throws CliError on non-zero exit", async () => {
    const exec: ExecFn = async () => ({ stdout: "", stderr: "Config invalid", code: 1 });
    await expect(listAgents("1.2.3.4", "KEY", exec)).rejects.toBeInstanceOf(CliError);
  });

  it("throws CliError when stdout is not a JSON array", async () => {
    const exec: ExecFn = async () => ({ stdout: "not json", stderr: "", code: 0 });
    await expect(listAgents("1.2.3.4", "KEY", exec)).rejects.toBeInstanceOf(CliError);
  });
});
