import { describe, it, expect } from "vitest";
import {
  assertPairingChannel,
  assertPairingCode,
  parsePairingListOutput,
} from "./pairing";
import { InvalidInputError } from "./api-errors";
import { CliError } from "./ssh-errors";

describe("assertPairingChannel", () => {
  it("accepts telegram and whatsapp", () => {
    expect(assertPairingChannel("telegram")).toBe("telegram");
    expect(assertPairingChannel("whatsapp")).toBe("whatsapp");
  });

  it("rejects shell metacharacters and unknown channels", () => {
    for (const bad of ["telegram; rm -rf /", "$(id)", "discord", "", undefined, 3]) {
      const err = (() => {
        try {
          assertPairingChannel(bad);
          return null;
        } catch (e) {
          return e;
        }
      })();
      expect(err).toBeInstanceOf(InvalidInputError);
      expect((err as InvalidInputError).code).toBe("invalid_channel");
    }
  });
});

describe("assertPairingCode", () => {
  it("accepts alphanumeric codes with dashes/underscores", () => {
    expect(assertPairingCode("AB12-cd_34")).toBe("AB12-cd_34");
  });

  it("rejects spaces, quotes and empty", () => {
    for (const bad of ["a b", "x'y", "", "$(id)", "a".repeat(65)]) {
      expect(() => assertPairingCode(bad)).toThrow(InvalidInputError);
    }
  });
});

describe("parsePairingListOutput", () => {
  it("maps the 2026.9 CLI shape", () => {
    const stdout = JSON.stringify({
      channel: "telegram",
      requests: [
        {
          id: "123456",
          code: "K7Q2ZP",
          createdAt: "2026-09-17T10:00:00.000Z",
          lastSeenAt: "2026-09-17T10:00:05.000Z",
          meta: { senderId: "123456", firstName: "Ana", username: "ana_dev", accountId: "default" },
        },
        { id: "999", code: "ZZZZZZ", createdAt: "2026-09-17T11:00:00.000Z", lastSeenAt: "2026-09-17T11:00:00.000Z" },
      ],
    });
    expect(parsePairingListOutput(stdout)).toEqual([
      { code: "K7Q2ZP", senderId: "123456", senderName: "Ana", timestamp: "2026-09-17T10:00:00.000Z" },
      { code: "ZZZZZZ", senderId: "999", senderName: null, timestamp: "2026-09-17T11:00:00.000Z" },
    ]);
  });

  it("prefers firstName, then username, else null", () => {
    const one = (meta: Record<string, string>) =>
      parsePairingListOutput(
        JSON.stringify({ channel: "telegram", requests: [{ id: "1", code: "C", createdAt: "t", lastSeenAt: "t", meta }] }),
      )[0].senderName;
    expect(one({ firstName: "Ana", username: "ana" })).toBe("Ana");
    expect(one({ username: "ana" })).toBe("ana");
    expect(one({})).toBeNull();
  });

  it("returns [] for an empty requests array", () => {
    expect(parsePairingListOutput('{"channel":"telegram","requests":[]}')).toEqual([]);
  });

  it("throws CliError on non-JSON or wrong shape instead of swallowing", () => {
    expect(() => parsePairingListOutput("No pending telegram pairing requests.")).toThrow(CliError);
    expect(() => parsePairingListOutput('{"channel":"telegram"}')).toThrow(CliError);
    expect(() => parsePairingListOutput("[]")).toThrow(CliError);
  });
});
