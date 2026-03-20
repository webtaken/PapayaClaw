import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { instance, subscription } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SubscriptionsContent } from "@/components/dashboard/subscriptions-content";
import { setRequestLocale } from "next-intl/server";

export default async function SubscriptionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/");
  }

  const [subscriptions, instances] = await Promise.all([
    db
      .select()
      .from(subscription)
      .where(eq(subscription.userId, session.user.id)),
    db
      .select()
      .from(instance)
      .where(eq(instance.userId, session.user.id)),
  ]);

  // Build subscription data with linked instances
  const subscriptionsWithInstances = subscriptions.map((sub) => ({
    ...sub,
    instance: instances.find((inst) => inst.subscriptionId === sub.id) ?? null,
  }));

  // Instances not linked to any subscription (legacy)
  const unlinkedInstances = instances.filter((inst) => !inst.subscriptionId);

  return (
    <SubscriptionsContent
      subscriptions={subscriptionsWithInstances}
      unlinkedInstances={unlinkedInstances}
      user={{ id: session.user.id, email: session.user.email }}
    />
  );
}
