import { db } from "@/lib/db";
import { instance, user, pendingInstanceConfig } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { getUserSubscription, getAvailableSubscription } from "@/lib/polar";
import { getCapacitySnapshot } from "@/lib/hetzner-limits";
import { setRequestLocale } from "next-intl/server";
import { getSessionContext } from "@/lib/auth-context";
import { deriveCheckoutState } from "@/lib/checkout-state";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getSessionContext(await headers());

  if (!ctx) {
    redirect("/");
  }

  // Staff see every instance with the owner's email; users see only their own.
  const instancesPromise = ctx.isStaff
    ? db
        .select()
        .from(instance)
        .leftJoin(user, eq(instance.userId, user.id))
        .orderBy(desc(instance.createdAt))
        .then((rows) =>
          rows.map((r) => ({ ...r.instance, ownerEmail: r.user?.email ?? null })),
        )
    : db
        .select()
        .from(instance)
        .where(eq(instance.userId, ctx.user.id))
        .orderBy(desc(instance.createdAt));

  const [instances, currentSubscription, availableSubscription, capacity, latestPending] =
    await Promise.all([
      instancesPromise,
      getUserSubscription(ctx.user.id),
      getAvailableSubscription(ctx.user.id),
      getCapacitySnapshot().catch(() => undefined),
      db
        .select({
          consumedAt: pendingInstanceConfig.consumedAt,
          expiresAt: pendingInstanceConfig.expiresAt,
          createdAt: pendingInstanceConfig.createdAt,
        })
        .from(pendingInstanceConfig)
        .where(eq(pendingInstanceConfig.userId, ctx.user.id))
        .orderBy(desc(pendingInstanceConfig.createdAt))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);

  const checkoutState = deriveCheckoutState({
    pending: latestPending,
    hasAvailableSubscription: Boolean(availableSubscription),
    instanceCount: instances.length,
    isStaff: ctx.isStaff,
  });

  return (
    <DashboardContent
      initialInstances={instances}
      subscription={currentSubscription}
      hasAvailableSubscription={Boolean(availableSubscription)}
      user={{ id: ctx.user.id, email: ctx.user.email }}
      isStaff={ctx.isStaff}
      capacity={capacity}
      checkoutState={checkoutState}
    />
  );
}
