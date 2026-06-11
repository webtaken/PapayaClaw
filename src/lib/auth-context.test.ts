import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isStaffEmail, resolveRole, canAccessInstance } from "./auth-context";

describe("isStaffEmail", () => {
  const original = process.env.STAFF_EMAILS;
  afterEach(() => {
    process.env.STAFF_EMAILS = original;
  });

  it("returns true for an email in the allowlist (case/space-insensitive)", () => {
    process.env.STAFF_EMAILS = "alice@x.com, Bob@X.com";
    expect(isStaffEmail("alice@x.com")).toBe(true);
    expect(isStaffEmail("  ALICE@x.com ")).toBe(true);
    expect(isStaffEmail("bob@x.com")).toBe(true);
  });

  it("returns false for an email not in the allowlist", () => {
    process.env.STAFF_EMAILS = "alice@x.com";
    expect(isStaffEmail("carol@x.com")).toBe(false);
  });

  it("returns false when the allowlist is empty or unset", () => {
    process.env.STAFF_EMAILS = "";
    expect(isStaffEmail("alice@x.com")).toBe(false);
    delete process.env.STAFF_EMAILS;
    expect(isStaffEmail("alice@x.com")).toBe(false);
  });

  it("returns false for an empty or whitespace-only email", () => {
    process.env.STAFF_EMAILS = "alice@x.com";
    expect(isStaffEmail("")).toBe(false);
    expect(isStaffEmail("   ")).toBe(false);
  });
});

describe("resolveRole", () => {
  const original = process.env.STAFF_EMAILS;
  beforeEach(() => {
    process.env.STAFF_EMAILS = "alice@x.com";
  });
  afterEach(() => {
    process.env.STAFF_EMAILS = original;
  });

  it("returns 'staff' for an allowlisted email", () => {
    expect(resolveRole("alice@x.com")).toBe("staff");
  });

  it("returns 'user' for a non-allowlisted email", () => {
    expect(resolveRole("carol@x.com")).toBe("user");
  });
});

describe("canAccessInstance", () => {
  it("allows the owner", () => {
    const ctx = { user: { id: "u1" }, isStaff: false };
    expect(canAccessInstance(ctx, { userId: "u1" })).toBe(true);
  });

  it("denies a non-staff non-owner", () => {
    const ctx = { user: { id: "u1" }, isStaff: false };
    expect(canAccessInstance(ctx, { userId: "u2" })).toBe(false);
  });

  it("allows staff on any instance", () => {
    const ctx = { user: { id: "u1" }, isStaff: true };
    expect(canAccessInstance(ctx, { userId: "u2" })).toBe(true);
  });
});
