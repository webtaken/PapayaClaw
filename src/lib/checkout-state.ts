/**
 * Derives what the dashboard should say about a Polar checkout that has no
 * instance yet. Uses only existing columns:
 *   - pending_instance_config.consumedAt is set by the order.paid webhook right
 *     before provisioning starts; provisionInstance deletes the instance row on
 *     failure. So: consumed + subscription + no instance = provisioning failed.
 *     This holds regardless of expiresAt — a failed provision doesn't stop being
 *     failed just because the pending config's TTL later lapses, so the
 *     consumedAt check runs before the expiry check. The consumed verdict is
 *     age-bounded on both sides, because "no instance row" is ambiguous:
 *       * younger than FAILED_GRACE_MS → provisioning is probably still running
 *         and has not inserted the instance row yet → "pending", not "failed".
 *       * older than FAILED_MAX_AGE_MS → the user most likely deleted a server
 *         that did get created days ago → "none", not a permanent error banner.
 *   - unconsumed + fresh + subscription = subscription.created arrived, order.paid
 *     still in flight → "setting up", block manual deploy to avoid a double server.
 *     expiresAt (and then the freshness window) only gates this unconsumed path.
 */
export type CheckoutState = "none" | "pending" | "failed";

/** How long an unconsumed pending config counts as "in flight". */
export const PENDING_FRESHNESS_MS = 15 * 60 * 1000;

/** Provisioning window after consumption: still "pending", not yet "failed". */
export const FAILED_GRACE_MS = 2 * 60 * 1000;

/** Past this, a consumed config with no instance is stale, not a fresh failure. */
export const FAILED_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface PendingConfigSnapshot {
  consumedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

export function deriveCheckoutState(input: {
  pending: PendingConfigSnapshot | null;
  hasAvailableSubscription: boolean;
  instanceCount: number;
  isStaff: boolean;
  now?: Date;
}): CheckoutState {
  const now = input.now ?? new Date();
  const { pending } = input;

  if (input.isStaff || !pending || input.instanceCount > 0) return "none";
  if (!input.hasAvailableSubscription) return "none";

  if (pending.consumedAt) {
    const sinceConsumedMs = now.getTime() - pending.consumedAt.getTime();
    if (sinceConsumedMs < FAILED_GRACE_MS) return "pending";
    if (sinceConsumedMs <= FAILED_MAX_AGE_MS) return "failed";
    return "none";
  }

  if (pending.expiresAt.getTime() <= now.getTime()) return "none";

  const ageMs = now.getTime() - pending.createdAt.getTime();
  return ageMs <= PENDING_FRESHNESS_MS ? "pending" : "none";
}
