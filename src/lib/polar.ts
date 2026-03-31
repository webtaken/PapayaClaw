import { db } from "./db";
import { subscription, instance } from "./schema";
import { eq, and, isNull } from "drizzle-orm";

// Product IDs from env vars (used for building checkout URLs)
export const POLAR_BASIC_PRODUCT_ID =
  process.env.NEXT_PUBLIC_POLAR_BASIC_PRODUCT_ID!;
export const POLAR_PRO_PRODUCT_ID =
  process.env.NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID!;

export type PlanType = "basic" | "pro";

/**
 * Check whether Polar payment env vars are configured.
 * When false, subscription checks are bypassed (OSS / dev mode).
 */
export function isPolarConfigured(): boolean {
  return !!(
    process.env.POLAR_ACCESS_TOKEN && process.env.POLAR_WEBHOOK_SECRET
  );
}

// Maps plan type → Hetzner server type
export const PLAN_SERVER_TYPE: Record<string, string> = {
  basic: "cx23",
  pro: "cx33",
};

/**
 * Extract plan type from Polar product metadata.
 * Products must have a `plan` key in their metadata set to "basic" or "pro".
 */
export function getPlanTypeFromMetadata(product: {
  metadata?: Record<string, unknown>;
}): PlanType | null {
  const plan = product?.metadata?.plan;
  if (plan === "basic" || plan === "pro") {
    return plan;
  }
  return null;
}

/**
 * Get the active subscription for a user.
 * Returns the most recent active/past_due subscription, or null.
 */
export async function getUserSubscription(userId: string) {
  const results = await db
    .select()
    .from(subscription)
    .where(
      and(eq(subscription.userId, userId), eq(subscription.status, "active")),
    )
    .limit(1);

  return results[0] ?? null;
}

/**
 * Check if a user has an active subscription, optionally of a specific plan.
 */
export async function hasActivePlan(
  userId: string,
  planType?: PlanType,
): Promise<boolean> {
  const sub = await getUserSubscription(userId);
  if (!sub) return false;
  if (planType) return sub.planType === planType;
  return true;
}

/**
 * Get all subscriptions for a user (any status).
 */
export async function getUserSubscriptions(userId: string) {
  return db.select().from(subscription).where(eq(subscription.userId, userId));
}

/**
 * Get the instance linked to a subscription, if any.
 */
export async function getSubscriptionInstance(subscriptionId: string) {
  const results = await db
    .select()
    .from(instance)
    .where(eq(instance.subscriptionId, subscriptionId))
    .limit(1);

  return results[0] ?? null;
}

/**
 * Get an active subscription that has no instance linked to it.
 * Used during instance creation to enforce the 1:1 rule.
 */
export async function getAvailableSubscription(userId: string) {
  const subs = await db
    .select()
    .from(subscription)
    .where(
      and(eq(subscription.userId, userId), eq(subscription.status, "active")),
    );

  for (const sub of subs) {
    const linked = await getSubscriptionInstance(sub.id);
    if (!linked) return sub;
  }

  return null;
}
