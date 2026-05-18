import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
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

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const instances = await db
    .select()
    .from(instance)
    .where(eq(instance.userId, session.user.id))
    .orderBy(desc(instance.createdAt));

  return NextResponse.json(instances);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const capacity = await assertProvisioningCapacity();
  if (!capacity.ok) {
    return NextResponse.json({ error: capacity.error }, { status: 403 });
  }

  // OSS / dev mode only: when Polar is configured the deploy flow goes
  // through the checkout server action, not this endpoint.
  if (isPolarConfigured()) {
    const subscription = await getAvailableSubscription(session.user.id);
    if (!subscription) {
      return NextResponse.json(
        {
          error:
            "No available subscription. Each subscription supports one instance. Purchase another subscription or delete an existing instance.",
        },
        { status: 403 },
      );
    }

    const body = await request.json();
    const validation = validateBody(body);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    try {
      const created = await provisionInstance({
        userId: session.user.id,
        subscriptionId: subscription.id,
        serverType: PLAN_SERVER_TYPE[subscription.planType] || "cx22",
        ...validation.data,
      });
      return NextResponse.json(created, { status: 201 });
    } catch {
      return NextResponse.json(
        { error: "Failed to provision server" },
        { status: 500 },
      );
    }
  }

  const body = await request.json();
  const validation = validateBody(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const created = await provisionInstance({
      userId: session.user.id,
      subscriptionId: null,
      serverType: "cx22",
      ...validation.data,
    });
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to provision server" },
      { status: 500 },
    );
  }
}

type ValidatedBody = {
  name: string;
  model: string;
  modelApiKey: string | null;
  channel: string;
  botToken?: string;
  channelPhone?: string | null;
};

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
    data: { name, model, modelApiKey, channel, botToken, channelPhone },
  };
}
