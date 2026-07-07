import { describe, expect, it } from "vitest";
import { isSafeSlug } from "./safe-slug";

describe("isSafeSlug", () => {
  it.each(["formula-100k", "soul-md"])("accepts %s", (value) => {
    expect(isSafeSlug(value)).toBe(true);
  });

  it.each(["../x", "a/b", "A-Upper", ".hidden", "", "a_b"])("rejects %s", (value) => {
    expect(isSafeSlug(value)).toBe(false);
  });
});
