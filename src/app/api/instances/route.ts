import { db } from "@/lib/db";
import { instance, user } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  getAvailableSubscription,
  isPolarConfigured,
  PLAN_SERVER_TYPE,
} from "@/lib/polar";
import { provisionInstance } from "@/lib/provision-instance";
import { assertProvisioningCapacity } from "@/lib/hetzner-limits";
import { getSessionContext } from "@/lib/auth-context";

export async function GET() {
  const ctx = await getSessionContext(await headers());

  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Staff see every instance with the owner's email attached; regular
  // users see only their own (ownerEmail omitted — it's always them).
  if (ctx.isStaff) {
    const rows = await db
      .select()
      .from(instance)
      .leftJoin(user, eq(instance.userId, user.id))
      .orderBy(desc(instance.createdAt));

    const instances = rows.map((r) => ({
      ...r.instance,
      ownerEmail: r.user?.email ?? null,
    }));
    return NextResponse.json(instances);
  }

  const instances = await db
    .select()
    .from(instance)
    .where(eq(instance.userId, ctx.user.id))
    .orderBy(desc(instance.createdAt));

  return NextResponse.json(instances);
}

export async function POST(request: Request) {
  const ctx = await getSessionContext(await headers());

  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const capacity = await assertProvisioningCapacity();
  if (!capacity.ok) {
    return NextResponse.json({ error: capacity.error }, { status: 403 });
  }

  const body = await request.json();
  const validation = validateBody(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Staff bypass payment: provision directly with no subscription, using the
  // server size implied by the chosen plan tier. Capacity still applies above.
  if (ctx.isStaff) {
    // Staff who skip the plan step still get at least the basic tier (cx23),
    // not the bare OSS-dev default (cx22).
    const serverType =
      (validation.data.planType && PLAN_SERVER_TYPE[validation.data.planType]) ||
      "cx23";
    try {
      const created = await provisionInstance({
        userId: ctx.user.id,
        subscriptionId: null,
        serverType,
        ...stripPlanType(validation.data),
      });
      return NextResponse.json(created, { status: 201 });
    } catch {
      return NextResponse.json(
        { error: "Failed to provision server" },
        { status: 500 },
      );
    }
  }

  // OSS / dev mode only: when Polar is configured the paying deploy flow goes
  // through the checkout server action, not this endpoint.
  if (isPolarConfigured()) {
    const subscription = await getAvailableSubscription(ctx.user.id);
    if (!subscription) {
      return NextResponse.json(
        {
          error:
            "No available subscription. Each subscription supports one instance. Purchase another subscription or delete an existing instance.",
        },
        { status: 403 },
      );
    }

    try {
      const created = await provisionInstance({
        userId: ctx.user.id,
        subscriptionId: subscription.id,
        serverType: PLAN_SERVER_TYPE[subscription.planType] || "cx22",
        ...stripPlanType(validation.data),
      });
      return NextResponse.json(created, { status: 201 });
    } catch {
      return NextResponse.json(
        { error: "Failed to provision server" },
        { status: 500 },
      );
    }
  }

  try {
    const created = await provisionInstance({
      userId: ctx.user.id,
      subscriptionId: null,
      serverType: "cx22",
      ...stripPlanType(validation.data),
    });
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to provision server" },
      { status: 500 },
    );
  }
}

type PlanType = "basic" | "pro";

type ValidatedBody = {
  name: string;
  model: string;
  modelApiKey: string | null;
  channel: string;
  botToken?: string;
  channelPhone?: string | null;
  planType?: PlanType;
};

/** Drop the staff-only planType before passing to provisionInstance. */
function stripPlanType(data: ValidatedBody) {
  const rest = { ...data };
  delete rest.planType;
  return rest;
}

function validateBody(
  body: unknown,
): { ok: true; data: ValidatedBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid body" };
  }
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const model = typeof b.model === "string" ? b.model.trim() : "";
  const channel = typeof b.channel === "string" ? b.channel : "";
  const modelApiKey =
    typeof b.modelApiKey === "string" ? b.modelApiKey : null;
  const botToken = typeof b.botToken === "string" ? b.botToken : undefined;
  const channelPhone =
    typeof b.channelPhone === "string" ? b.channelPhone : undefined;
  const planType =
    b.planType === "basic" || b.planType === "pro" ? b.planType : undefined;

  if (!name || !model || !channel) {
    return { ok: false, error: "Missing required fields" };
  }
  if (channel === "telegram" && !botToken) {
    return { ok: false, error: "Telegram requires a bot token" };
  }
  if (channel === "whatsapp" && !channelPhone) {
    return { ok: false, error: "WhatsApp requires a phone number" };
  }
  return {
    ok: true,
    data: { name, model, modelApiKey, channel, botToken, channelPhone, planType },
  };
}
