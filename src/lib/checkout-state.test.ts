import { describe, it, expect } from "vitest";
import {
  deriveCheckoutState,
  PENDING_FRESHNESS_MS,
  FAILED_GRACE_MS,
  FAILED_MAX_AGE_MS,
} from "./checkout-state";

const now = new Date("2026-09-17T12:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
const base = { hasAvailableSubscription: true, instanceCount: 0, isStaff: false, now };
const fresh = { consumedAt: null, expiresAt: minutesAgo(-60), createdAt: minutesAgo(2) };

describe("deriveCheckoutState", () => {
  it("is none without a pending config", () => {
    expect(deriveCheckoutState({ ...base, pending: null })).toBe("none");
  });

  it("is pending while a fresh config is unconsumed and the subscription already exists", () => {
    expect(deriveCheckoutState({ ...base, pending: fresh })).toBe("pending");
  });

  it("is none when the unconsumed config is older than the freshness window (webhook never came)", () => {
    const stale = { ...fresh, createdAt: new Date(now.getTime() - PENDING_FRESHNESS_MS - 1) };
    expect(deriveCheckoutState({ ...base, pending: stale })).toBe("none");
  });

  it("is none when unconsumed but no subscription yet (user may have abandoned checkout)", () => {
    expect(deriveCheckoutState({ ...base, pending: fresh, hasAvailableSubscription: false })).toBe("none");
  });

  it("is failed when consumed, subscription available and zero instances", () => {
    expect(deriveCheckoutState({ ...base, pending: { ...fresh, consumedAt: minutesAgo(5) } })).toBe("failed");
  });

  it("is pending while still inside the post-consume provisioning grace window", () => {
    const justConsumed = { ...fresh, consumedAt: new Date(now.getTime() - 30_000) };
    expect(deriveCheckoutState({ ...base, pending: justConsumed })).toBe("pending");
  });

  it("is none when the consumed config is older than the failure window (server deleted later)", () => {
    const stale = { ...fresh, consumedAt: new Date(now.getTime() - 25 * 60 * 60 * 1000) };
    expect(deriveCheckoutState({ ...base, pending: stale })).toBe("none");
  });

  it("switches from pending to failed at the grace boundary and to none past the max age", () => {
    const atGrace = { ...fresh, consumedAt: new Date(now.getTime() - FAILED_GRACE_MS) };
    expect(deriveCheckoutState({ ...base, pending: atGrace })).toBe("failed");

    const atMaxAge = { ...fresh, consumedAt: new Date(now.getTime() - FAILED_MAX_AGE_MS) };
    expect(deriveCheckoutState({ ...base, pending: atMaxAge })).toBe("failed");

    const pastMaxAge = { ...fresh, consumedAt: new Date(now.getTime() - FAILED_MAX_AGE_MS - 1) };
    expect(deriveCheckoutState({ ...base, pending: pastMaxAge })).toBe("none");
  });

  it("is none once an instance exists", () => {
    expect(deriveCheckoutState({ ...base, pending: { ...fresh, consumedAt: minutesAgo(1) }, instanceCount: 1 })).toBe("none");
  });

  it("is none for staff", () => {
    expect(deriveCheckoutState({ ...base, pending: fresh, isStaff: true })).toBe("none");
  });

  it("is none when the pending config expired", () => {
    expect(deriveCheckoutState({ ...base, pending: { ...fresh, expiresAt: minutesAgo(1) } })).toBe("none");
  });

  it("is failed even when the pending config has expired", () => {
    const expired = { consumedAt: minutesAgo(5), expiresAt: minutesAgo(1), createdAt: minutesAgo(60) };
    expect(deriveCheckoutState({ ...base, pending: expired })).toBe("failed");
  });

  it("is pending at exactly the freshness boundary and none one ms past it", () => {
    const atBoundary = { ...fresh, createdAt: new Date(now.getTime() - PENDING_FRESHNESS_MS) };
    expect(deriveCheckoutState({ ...base, pending: atBoundary })).toBe("pending");

    const pastBoundary = { ...fresh, createdAt: new Date(now.getTime() - PENDING_FRESHNESS_MS - 1) };
    expect(deriveCheckoutState({ ...base, pending: pastBoundary })).toBe("none");
  });
});
