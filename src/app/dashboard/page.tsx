import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { getUserSubscription } from "@/lib/polar";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/");
  }

  const [instances, currentSubscription] = await Promise.all([
    db
      .select()
      .from(instance)
      .where(eq(instance.userId, session.user.id))
      .orderBy(desc(instance.createdAt)),
    getUserSubscription(session.user.id),
  ]);

  return (
    <DashboardContent
      initialInstances={instances}
      subscription={currentSubscription}
      user={{ id: session.user.id, email: session.user.email }}
    />
  );
}
