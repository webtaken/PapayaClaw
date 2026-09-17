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
import {
  validateInstanceInput,
  INSTANCE_INPUT_MESSAGES,
} from "@/lib/instance-input";

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

  const validation = validateInstanceInput(input, { requireApiKey: true });
  if (!validation.ok) {
    return { error: INSTANCE_INPUT_MESSAGES[validation.error] };
  }
  const { name, model, modelApiKey, channel, botToken, channelPhone } =
    validation.data;

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
