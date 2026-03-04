import { Webhooks } from "@polar-sh/nextjs";
import { db } from "@/lib/db";
import { subscription } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getPlanTypeFromMetadata } from "@/lib/polar";

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,

  onSubscriptionCreated: async (payload) => {
    const sub = payload.data;
    const customer = sub.customer;
    const planType = getPlanTypeFromMetadata(sub.product);

    if (!planType) {
      console.error(
        "[Polar Webhook] Unknown plan type in product metadata:",
        sub.product,
      );
      return;
    }

    // customerExternalId is our internal user ID (set during checkout)
    const userId = customer.externalId;
    if (!userId) {
      console.error(
        "[Polar Webhook] No externalId found on customer:",
        customer.id,
      );
      return;
    }

    await db
      .insert(subscription)
      .values({
        id: sub.id,
        userId,
        polarCustomerId: customer.id,
        productId: sub.product.id,
        priceId: sub.prices?.[0]?.id ?? null,
        planType,
        status: sub.status,
        currentPeriodStart: sub.currentPeriodStart
          ? new Date(sub.currentPeriodStart)
          : null,
        currentPeriodEnd: sub.currentPeriodEnd
          ? new Date(sub.currentPeriodEnd)
          : null,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? false,
      })
      .onConflictDoUpdate({
        target: subscription.id,
        set: {
          status: sub.status,
          planType,
          productId: sub.product.id,
          currentPeriodStart: sub.currentPeriodStart
            ? new Date(sub.currentPeriodStart)
            : null,
          currentPeriodEnd: sub.currentPeriodEnd
            ? new Date(sub.currentPeriodEnd)
            : null,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? false,
        },
      });

    console.log(
      `[Polar Webhook] Subscription created: ${sub.id} for user ${userId} (${planType})`,
    );
  },

  onSubscriptionUpdated: async (payload) => {
    const sub = payload.data;
    const planType = getPlanTypeFromMetadata(sub.product);

    await db
      .update(subscription)
      .set({
        status: sub.status,
        ...(planType ? { planType, productId: sub.product.id } : {}),
        currentPeriodStart: sub.currentPeriodStart
          ? new Date(sub.currentPeriodStart)
          : null,
        currentPeriodEnd: sub.currentPeriodEnd
          ? new Date(sub.currentPeriodEnd)
          : null,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? false,
      })
      .where(eq(subscription.id, sub.id));

    console.log(
      `[Polar Webhook] Subscription updated: ${sub.id} → ${sub.status}`,
    );
  },

  onSubscriptionActive: async (payload) => {
    const sub = payload.data;

    await db
      .update(subscription)
      .set({
        status: "active",
        currentPeriodStart: sub.currentPeriodStart
          ? new Date(sub.currentPeriodStart)
          : null,
        currentPeriodEnd: sub.currentPeriodEnd
          ? new Date(sub.currentPeriodEnd)
          : null,
        cancelAtPeriodEnd: false,
      })
      .where(eq(subscription.id, sub.id));

    console.log(`[Polar Webhook] Subscription active: ${sub.id}`);
  },

  onSubscriptionCanceled: async (payload) => {
    const sub = payload.data;

    await db
      .update(subscription)
      .set({
        status: sub.status,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? true,
      })
      .where(eq(subscription.id, sub.id));

    console.log(`[Polar Webhook] Subscription canceled: ${sub.id}`);
  },

  onSubscriptionRevoked: async (payload) => {
    const sub = payload.data;

    await db
      .update(subscription)
      .set({
        status: "revoked",
        cancelAtPeriodEnd: false,
      })
      .where(eq(subscription.id, sub.id));

    console.log(`[Polar Webhook] Subscription revoked: ${sub.id}`);
  },

  onSubscriptionUncanceled: async (payload) => {
    const sub = payload.data;

    await db
      .update(subscription)
      .set({
        status: "active",
        cancelAtPeriodEnd: false,
      })
      .where(eq(subscription.id, sub.id));

    console.log(`[Polar Webhook] Subscription uncanceled: ${sub.id}`);
  },
});
