"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pendingInstanceConfig } from "@/lib/schema";
import { headers } from "next/headers";
import { encryptJSON } from "@/lib/encryption";
import { getPolarClient } from "@/lib/polar-client";
import {
  POLAR_BASIC_PRODUCT_ID,
  POLAR_PRO_PRODUCT_ID,
  type PlanType,
} from "@/lib/polar";
import { assertProvisioningCapacity } from "@/lib/hetzner-limits";

export type CheckoutInput = {
  name: string;
  model: string;
  modelApiKey: string;
  channel: "telegram" | "whatsapp";
  botToken?: string;
  channelPhone?: string;
  planType: PlanType;
};

export type CheckoutResult = { url: string } | { error: string };

export async function createPendingCheckout(
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Unauthorized" };

  const capacity = await assertProvisioningCapacity();
  if (!capacity.ok) return { error: capacity.error };

  const name = input.name?.trim();
  const model = input.model?.trim();
  const modelApiKey = input.modelApiKey?.trim();
  const channel = input.channel;
  const botToken = input.botToken?.trim();
  const channelPhone = input.channelPhone?.trim();

  if (!name || !model || !modelApiKey || !channel) {
    return { error: "Missing required fields" };
  }
  if (channel === "telegram" && !botToken) {
    return { error: "Telegram requires a bot token" };
  }
  if (channel === "whatsapp" && !channelPhone) {
    return { error: "WhatsApp requires a phone number" };
  }

  const productId =
    input.planType === "pro" ? POLAR_PRO_PRODUCT_ID : POLAR_BASIC_PRODUCT_ID;
  if (!productId) {
    return { error: "Plan product not configured" };
  }

  const encrypted = encryptJSON({
    name,
    model,
    modelApiKey,
    channel,
    botToken: botToken ?? null,
    channelPhone: channelPhone ?? null,
  });

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [row] = await db
    .insert(pendingInstanceConfig)
    .values({
      userId: session.user.id,
      productId,
      planType: input.planType,
      payloadCiphertext: encrypted.ciphertext,
      payloadIv: encrypted.iv,
      payloadAuthTag: encrypted.authTag,
      expiresAt,
    })
    .returning({ id: pendingInstanceConfig.id });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const successUrl = `${baseUrl}/dashboard?checkout=success&co={CHECKOUT_ID}`;

  try {
    const polar = getPolarClient();
    const checkout = await polar.checkouts.create({
      products: [productId],
      externalCustomerId: session.user.id,
      customerEmail: session.user.email,
      metadata: {
        pendingConfigId: row.id,
        planType: input.planType,
      },
      allowDiscountCodes: true,
      successUrl,
    });

    return { url: checkout.url };
  } catch (err) {
    console.error("[createPendingCheckout] Polar error:", err);
    return { error: "Failed to create checkout. Please try again." };
  }
}
