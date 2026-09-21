import { describe, it, expect } from "vitest";
import {
  ENV_LIMITS,
  ENV_MANAGED_HEADER,
  ENV_RESERVED_KEYS,
  isReservedEnvKey,
  mergeEnvVars,
  parseEnvFile,
  serializeEnvFile,
  validateEnvVars,
  type EnvVar,
} from "./env-file";

describe("parseEnvFile", () => {
  it("skips blank lines and comments", () => {
    const { vars, skippedLines } = parseEnvFile("\n# hello\n  \nA=1\n");
    expect(vars).toEqual([{ key: "A", value: "1" }]);
    expect(skippedLines).toBe(0);
  });

  it("strips an `export` prefix", () => {
    expect(parseEnvFile("export FOO=bar").vars).toEqual([
      { key: "FOO", value: "bar" },
    ]);
  });

  it("reads reconfigure-style unquoted values and trims trailing inline comments", () => {
    expect(parseEnvFile("GROQ_API_KEY=gsk_abc").vars).toEqual([
      { key: "GROQ_API_KEY", value: "gsk_abc" },
    ]);
    expect(parseEnvFile("A=hello world # note").vars).toEqual([
      { key: "A", value: "hello world" },
    ]);
  });

  it("keeps single-quoted values literal", () => {
    expect(parseEnvFile(`A='$x # "q" \\n'`).vars).toEqual([
      { key: "A", value: `$x # "q" \\n` },
    ]);
  });

  it("expands \\n in double-quoted values but keeps other escapes", () => {
    expect(parseEnvFile(`A="line1\\nline2 \\" x"`).vars).toEqual([
      { key: "A", value: `line1\nline2 \\" x` },
    ]);
  });

  it("keeps backtick-quoted values literal", () => {
    expect(parseEnvFile("A=`it's \"x\" $y`").vars).toEqual([
      { key: "A", value: `it's "x" $y` },
    ]);
  });

  it("reads an empty value", () => {
    expect(parseEnvFile("A=").vars).toEqual([{ key: "A", value: "" }]);
    expect(parseEnvFile("A=''").vars).toEqual([{ key: "A", value: "" }]);
  });

  it("counts lines with a bad key or no `=` as skipped", () => {
    const { vars, skippedLines } = parseEnvFile(
      "1BAD=x\nnoequals\nOK=1\nweird-key=2",
    );
    expect(vars).toEqual([{ key: "OK", value: "1" }]);
    expect(skippedLines).toBe(3);
  });

  it("lets the last duplicate win, keeping the first position", () => {
    expect(parseEnvFile("A=1\nB=2\nA=3").vars).toEqual([
      { key: "A", value: "3" },
      { key: "B", value: "2" },
    ]);
  });

  it("tolerates CRLF line endings", () => {
    expect(parseEnvFile("A=1\r\nB=2\r\n").vars).toEqual([
      { key: "A", value: "1" },
      { key: "B", value: "2" },
    ]);
  });

  it("does not count the managed header as a skipped line", () => {
    expect(parseEnvFile(`${ENV_MANAGED_HEADER}\nA=1\n`).skippedLines).toBe(0);
  });
});

describe("serializeEnvFile", () => {
  it("starts with the managed header and ends with a newline", () => {
    const out = serializeEnvFile([{ key: "A", value: "1" }]);
    expect(out.startsWith(`${ENV_MANAGED_HEADER}\n`)).toBe(true);
    expect(out.endsWith("\n")).toBe(true);
  });

  it("writes an empty value as KEY=''", () => {
    expect(serializeEnvFile([{ key: "A", value: "" }])).toContain("A=''");
  });

  it("prefers single quotes so $, #, spaces and double quotes stay literal", () => {
    expect(serializeEnvFile([{ key: "A", value: `a b$c#d"e\\f` }])).toContain(
      `A='a b$c#d"e\\f'`,
    );
  });

  it("falls back to double quotes when the value has a single quote", () => {
    expect(serializeEnvFile([{ key: "A", value: "it's" }])).toContain(
      `A="it's"`,
    );
  });

  it("falls back to backticks when the value has both quote kinds", () => {
    expect(serializeEnvFile([{ key: "A", value: `it's "x"` }])).toContain(
      "A=`it's \"x\"`",
    );
  });

  it("writes bare when all three quote chars appear and it is bare-safe", () => {
    expect(serializeEnvFile([{ key: "A", value: "'\"`" }])).toContain(
      "A='\"`",
    );
  });

  it("throws on an unrepresentable value", () => {
    expect(() =>
      serializeEnvFile([{ key: "A", value: "'\"` #" }]),
    ).toThrow(/unrepresentable/);
  });

  it("preserves order", () => {
    const out = serializeEnvFile([
      { key: "Z", value: "1" },
      { key: "A", value: "2" },
    ]);
    expect(out.indexOf("Z=")).toBeLessThan(out.indexOf("A="));
  });

  it("round-trips every representable value", () => {
    const fixtures: EnvVar[] = [
      { key: "PLAIN", value: "abc" },
      { key: "SPACES", value: "  padded  " },
      { key: "DOLLAR", value: "$HOME and ${X}" },
      { key: "HASH", value: "a # b" },
      { key: "EQUALS", value: "a=b=c" },
      { key: "UNICODE", value: "ñ 🦎 日本" },
      { key: "SQUOTE", value: "it's" },
      { key: "DQUOTE", value: 'say "hi"' },
      { key: "BOTH", value: `it's "x"` },
      { key: "BACKSLASH", value: "a\\nb\\\\c" },
      { key: "TRIPLE", value: "'\"`" },
      { key: "EMPTY", value: "" },
      { key: "lower_case", value: "ok" },
    ];
    const { vars, skippedLines } = parseEnvFile(serializeEnvFile(fixtures));
    expect(vars).toEqual(fixtures);
    expect(skippedLines).toBe(0);
  });
});

describe("validateEnvVars", () => {
  const ok = (vars: EnvVar[]) => expect(validateEnvVars(vars)).toEqual([]);

  it("accepts a valid list, including lowercase keys", () => {
    ok([
      { key: "BRAVE_API_KEY", value: "x" },
      { key: "_under", value: "" },
    ]);
  });

  it("flags empty_key", () => {
    expect(validateEnvVars([{ key: "", value: "x" }])).toEqual([
      { index: 0, key: "", issue: "empty_key" },
    ]);
  });

  it("flags key_too_long before invalid_key", () => {
    const key = "A".repeat(ENV_LIMITS.maxKeyLength + 1) + "-";
    expect(validateEnvVars([{ key, value: "" }])[0].issue).toBe("key_too_long");
  });

  it("flags invalid_key", () => {
    expect(validateEnvVars([{ key: "1ABC", value: "" }])[0].issue).toBe(
      "invalid_key",
    );
    expect(validateEnvVars([{ key: "A-B", value: "" }])[0].issue).toBe(
      "invalid_key",
    );
  });

  it("flags reserved_key, case-sensitively", () => {
    for (const key of ENV_RESERVED_KEYS) {
      expect(validateEnvVars([{ key, value: "" }])[0].issue).toBe(
        "reserved_key",
      );
    }
    ok([{ key: "openclaw_gateway_token", value: "" }]);
  });

  it("flags later duplicates only", () => {
    expect(
      validateEnvVars([
        { key: "A", value: "1" },
        { key: "A", value: "2" },
        { key: "A", value: "3" },
      ]),
    ).toEqual([
      { index: 1, key: "A", issue: "duplicate_key" },
      { index: 2, key: "A", issue: "duplicate_key" },
    ]);
  });

  it("flags value_too_long", () => {
    const value = "v".repeat(ENV_LIMITS.maxValueLength + 1);
    expect(validateEnvVars([{ key: "A", value }])[0].issue).toBe(
      "value_too_long",
    );
  });

  it("flags value_control_chars for tab, LF and DEL", () => {
    for (const value of ["a\tb", "a\nb", "a\x7fb"]) {
      expect(validateEnvVars([{ key: "A", value }])[0].issue).toBe(
        "value_control_chars",
      );
    }
  });

  it("flags value_unrepresentable", () => {
    expect(validateEnvVars([{ key: "A", value: "'\"` #" }])[0].issue).toBe(
      "value_unrepresentable",
    );
  });

  it("flags too_many at the file level", () => {
    const vars = Array.from({ length: ENV_LIMITS.maxVars + 1 }, (_, i) => ({
      key: `K${i}`,
      value: "",
    }));
    expect(validateEnvVars(vars)).toEqual([
      { index: -1, key: "", issue: "too_many" },
    ]);
  });

  it("flags file_too_large at the file level", () => {
    const vars = Array.from({ length: 9 }, (_, i) => ({
      key: `K${i}`,
      value: "v".repeat(ENV_LIMITS.maxValueLength),
    }));
    expect(validateEnvVars(vars)).toEqual([
      { index: -1, key: "", issue: "file_too_large" },
    ]);
  });

  it("reports row issues only, not file-level ones, when rows are broken", () => {
    const vars = Array.from({ length: 9 }, (_, i) => ({
      key: i === 0 ? "" : `K${i}`,
      value: "v".repeat(ENV_LIMITS.maxValueLength),
    }));
    expect(validateEnvVars(vars)).toEqual([
      { index: 0, key: "", issue: "empty_key" },
    ]);
  });
});

describe("isReservedEnvKey", () => {
  it("matches only the exact reserved names", () => {
    expect(isReservedEnvKey("OPENCLAW_GATEWAY_TOKEN")).toBe(true);
    expect(isReservedEnvKey("OPENCLAW_LOG_LEVEL")).toBe(false);
  });
});

describe("mergeEnvVars", () => {
  it("updates existing keys in place, appends new ones, skips reserved", () => {
    const result = mergeEnvVars(
      [
        { key: "A", value: "1" },
        { key: "B", value: "2" },
      ],
      [
        { key: "B", value: "20" },
        { key: "C", value: "3" },
        { key: "OPENCLAW_GATEWAY_TOKEN", value: "x" },
      ],
    );
    expect(result).toEqual({
      vars: [
        { key: "A", value: "1" },
        { key: "B", value: "20" },
        { key: "C", value: "3" },
      ],
      added: 1,
      updated: 1,
      skippedReserved: 1,
    });
  });

  it("does not count an identical value as updated", () => {
    const result = mergeEnvVars(
      [{ key: "A", value: "1" }],
      [{ key: "A", value: "1" }],
    );
    expect(result.updated).toBe(0);
    expect(result.vars).toEqual([{ key: "A", value: "1" }]);
  });
});
