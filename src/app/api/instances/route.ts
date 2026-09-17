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
import { HetznerNoCapacityError } from "@/lib/hetzner";
import { getSessionContext } from "@/lib/auth-context";
import {
  validateInstanceInput,
  INSTANCE_INPUT_MESSAGES,
  type ValidatedInstanceInput,
} from "@/lib/instance-input";

function provisionErrorResponse(err: unknown) {
  if (err instanceof HetznerNoCapacityError) {
    console.error(
      "[instances] provisioning failed: no capacity —",
      err.message,
    );
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
  console.error("[instances] provisioning failed:", err);
  return NextResponse.json(
    { error: "Failed to provision server" },
    { status: 500 },
  );
}

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
  const validation = validateInstanceInput(body);
  if (!validation.ok) {
    return NextResponse.json(
      { error: INSTANCE_INPUT_MESSAGES[validation.error] },
      { status: 400 },
    );
  }

  // Staff bypass payment: provision directly with no subscription, using the
  // server size implied by the chosen plan tier. Capacity still applies above.
  if (ctx.isStaff) {
    // Staff who skip the plan step still get at least the basic tier (cx23),
    // not the bare OSS-dev default (cx22).
    const serverType =
      (validation.data.planType &&
        PLAN_SERVER_TYPE[validation.data.planType]) ||
      "cx23";
    try {
      const created = await provisionInstance({
        userId: ctx.user.id,
        subscriptionId: null,
        serverType,
        ...stripPlanType(validation.data),
      });
      return NextResponse.json(created, { status: 201 });
    } catch (err) {
      return provisionErrorResponse(err);
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
    } catch (err) {
      return provisionErrorResponse(err);
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
  } catch (err) {
    return provisionErrorResponse(err);
  }
}

function stripPlanType(data: ValidatedInstanceInput) {
  const rest = { ...data };
  delete rest.planType;
  return rest;
}
