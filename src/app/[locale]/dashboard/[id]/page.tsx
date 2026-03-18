import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { InstanceDetail } from "@/components/dashboard/instance-detail";
import { setRequestLocale } from "next-intl/server";

export default async function InstancePage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  setRequestLocale(locale);

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/");
  }

  const [inst] = await db
    .select()
    .from(instance)
    .where(and(eq(instance.id, id), eq(instance.userId, session.user.id)));

  if (!inst) {
    notFound();
  }

  return (
    <InstanceDetail
      initialInstance={{
        ...inst,
        createdAt: inst.createdAt,
      }}
    />
  );
}
