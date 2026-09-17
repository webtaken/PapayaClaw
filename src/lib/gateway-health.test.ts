import { describe, it, expect } from "vitest";
import {
  PROBE_SCRIPT,
  parseProbeOutput,
  computeHealth,
} from "./gateway-health";

describe("PROBE_SCRIPT", () => {
  it("sets systemd --user env and probes gateway, config, sentinel", () => {
    expect(PROBE_SCRIPT).toContain("XDG_RUNTIME_DIR=/run/user/0");
    expect(PROBE_SCRIPT).toContain("/root/.local/bin");
    expect(PROBE_SCRIPT).toContain("http://127.0.0.1:18789/");
    expect(PROBE_SCRIPT).toContain("openclaw config validate");
    expect(PROBE_SCRIPT).toContain("/var/tmp/openclaw-error");
    // Must never abort on first failure: every line is a signal
    expect(PROBE_SCRIPT).not.toContain("set -e");
  });
});

describe("parseProbeOutput", () => {
  it("parses a fully healthy probe", () => {
    expect(
      parseProbeOutput("GATEWAY=200\nCONFIG=0\nSENTINEL=none\n"),
    ).toEqual({ gatewayUp: true, configValid: true, errorSentinel: null });
  });

  it("treats any HTTP response (even 401) as gateway up", () => {
    expect(parseProbeOutput("GATEWAY=401\nCONFIG=0\nSENTINEL=none").gatewayUp)
      .toBe(true);
  });

  it("treats curl code 000 as gateway down", () => {
    expect(parseProbeOutput("GATEWAY=000\nCONFIG=0\nSENTINEL=none").gatewayUp)
      .toBe(false);
  });

  it("reports config invalid on nonzero validate exit", () => {
    expect(parseProbeOutput("GATEWAY=200\nCONFIG=1\nSENTINEL=none").configValid)
      .toBe(false);
  });

  it("passes sentinel text through and maps numeric trap codes too", () => {
    expect(
      parseProbeOutput("GATEWAY=000\nCONFIG=1\nSENTINEL=config-invalid")
        .errorSentinel,
    ).toBe("config-invalid");
    expect(
      parseProbeOutput("GATEWAY=000\nCONFIG=0\nSENTINEL=1").errorSentinel,
    ).toBe("1");
  });

  it("is tolerant of missing lines and stray whitespace", () => {
    expect(parseProbeOutput("  GATEWAY=200 \n")).toEqual({
      gatewayUp: true,
      configValid: false,
      errorSentinel: null,
    });
    expect(parseProbeOutput("")).toEqual({
      gatewayUp: false,
      configValid: false,
      errorSentinel: null,
    });
  });
});

describe("computeHealth", () => {
  const ok = { gatewayUp: true, configValid: true, errorSentinel: null };

  it("is unknown when Hetzner API failed", () => {
    expect(computeHealth({ hetznerStatus: "unknown", probe: ok })).toEqual({
      health: "unknown",
      reason: "hetzner-unknown",
    });
  });

  it("is down when VM is not running, regardless of probe", () => {
    for (const s of ["off", "starting", "initializing", "stopping"]) {
      expect(computeHealth({ hetznerStatus: s, probe: ok })).toEqual({
        health: "down",
        reason: "vm-off",
      });
    }
    expect(computeHealth({ hetznerStatus: null, probe: null })).toEqual({
      health: "down",
      reason: "vm-off",
    });
  });

  it("is unknown when VM runs but SSH probe failed", () => {
    expect(computeHealth({ hetznerStatus: "running", probe: null })).toEqual({
      health: "unknown",
      reason: "ssh-unreachable",
    });
  });

  it("is degraded with config-invalid winning over gateway-unreachable", () => {
    expect(
      computeHealth({
        hetznerStatus: "running",
        probe: { gatewayUp: false, configValid: false, errorSentinel: null },
      }),
    ).toEqual({ health: "degraded", reason: "config-invalid" });
    expect(
      computeHealth({
        hetznerStatus: "running",
        probe: { gatewayUp: true, configValid: false, errorSentinel: null },
      }),
    ).toEqual({ health: "degraded", reason: "config-invalid" });
  });

  it("is degraded with gateway-unreachable when config valid but no HTTP answer", () => {
    expect(
      computeHealth({
        hetznerStatus: "running",
        probe: { gatewayUp: false, configValid: true, errorSentinel: "1" },
      }),
    ).toEqual({ health: "degraded", reason: "gateway-unreachable" });
  });

  it("is healthy when VM runs, gateway answers and config valid — sentinel ignored", () => {
    expect(
      computeHealth({
        hetznerStatus: "running",
        probe: { ...ok, errorSentinel: "config-invalid" },
      }),
    ).toEqual({ health: "healthy", reason: null });
  });
});
