import { db } from "./db";
import { subscription } from "./schema";
import { eq, and } from "drizzle-orm";

// Product IDs from env vars (used for building checkout URLs)
export const POLAR_BASIC_PRODUCT_ID =
  process.env.NEXT_PUBLIC_POLAR_BASIC_PRODUCT_ID!;
export const POLAR_PRO_PRODUCT_ID =
  process.env.NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID!;

export type PlanType = "basic" | "pro";

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
