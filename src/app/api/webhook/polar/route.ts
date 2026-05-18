import { Webhooks } from "@polar-sh/nextjs";
import { db } from "@/lib/db";
import { subscription, pendingInstanceConfig } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { getPlanTypeFromMetadata, PLAN_SERVER_TYPE } from "@/lib/polar";
import { decryptJSON } from "@/lib/encryption";
import { provisionInstance } from "@/lib/provision-instance";

type PendingConfigPayload = {
  name: string;
  model: string;
  modelApiKey: string;
  channel: string;
  botToken: string | null;
  channelPhone: string | null;
};

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,

  onPayload: async (payload) => {
    const data = (payload as { data?: { metadata?: Record<string, unknown> } })
      .data;
    const metadata = data?.metadata;
    console.log(
      `[Polar Webhook] event=${payload.type} ts=${new Date().toISOString()}`,
      {
        hasMetadata: typeof metadata === "object" && metadata !== null,
        metadataKeys: Object.keys(metadata ?? {}),
      },
    );
  },

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

  onOrderPaid: async (payload) => {
    const order = payload.data;
    const metadata = order.metadata as Record<string, unknown> | undefined;
    const pendingConfigId =
      typeof metadata?.pendingConfigId === "string"
        ? metadata.pendingConfigId
        : null;
    const planType =
      metadata?.planType === "basic" || metadata?.planType === "pro"
        ? metadata.planType
        : null;

    if (!pendingConfigId || !planType) {
      console.log(
        `[Polar Webhook] order.paid skip: orderId=${order.id} ` +
          `customerId=${order.customer.id} ` +
          `metadata=${JSON.stringify(metadata ?? null)}`,
      );
      return;
    }

    console.log(
      `[Polar Webhook] order.paid provisioning start: orderId=${order.id} ` +
        `pendingConfigId=${pendingConfigId} planType=${planType}`,
    );

    const [pending] = await db
      .select()
      .from(pendingInstanceConfig)
      .where(eq(pendingInstanceConfig.id, pendingConfigId))
      .limit(1);

    if (!pending) {
      console.error(
        `[Polar Webhook] pendingConfigId ${pendingConfigId} not found`,
      );
      return;
    }
    if (pending.consumedAt) {
      console.log(
        `[Polar Webhook] pendingConfigId ${pendingConfigId} already consumed — skipping`,
      );
      return;
    }

    let config: PendingConfigPayload;
    try {
      config = decryptJSON<PendingConfigPayload>({
        ciphertext: pending.payloadCiphertext,
        iv: pending.payloadIv,
        authTag: pending.payloadAuthTag,
      });
    } catch (err) {
      console.error(
        `[Polar Webhook] Failed to decrypt pendingConfig ${pendingConfigId}:`,
        err,
      );
      return;
    }

    // Mark consumed BEFORE provisioning to guarantee idempotency under retry.
    const [consumed] = await db
      .update(pendingInstanceConfig)
      .set({ consumedAt: new Date() })
      .where(
        eq(pendingInstanceConfig.id, pendingConfigId),
      )
      .returning({ id: pendingInstanceConfig.id });

    if (!consumed) {
      console.log(
        `[Polar Webhook] pendingConfigId ${pendingConfigId} consumed concurrently — skipping`,
      );
      return;
    }

    const [linkedSub] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.polarCustomerId, order.customer.id))
      .orderBy(desc(subscription.createdAt))
      .limit(1);

    try {
      await provisionInstance({
        userId: pending.userId,
        subscriptionId: linkedSub?.id ?? null,
        serverType: PLAN_SERVER_TYPE[planType] ?? "cx22",
        name: config.name,
        model: config.model,
        modelApiKey: config.modelApiKey,
        channel: config.channel,
        botToken: config.botToken ?? undefined,
        channelPhone: config.channelPhone,
      });
      console.log(
        `[Polar Webhook] Provisioned instance for user ${pending.userId} (order ${order.id})`,
      );
    } catch (err) {
      console.error(
        `[Polar Webhook] Provisioning failed for order ${order.id}:`,
        err,
      );
    }
  },
});
