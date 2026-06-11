import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { InstanceDetail } from "@/components/dashboard/instance-detail";
import { setRequestLocale } from "next-intl/server";
import { getSessionContext, canAccessInstance } from "@/lib/auth-context";

export default async function InstancePage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  setRequestLocale(locale);

  const ctx = await getSessionContext(await headers());

  if (!ctx) {
    redirect("/");
  }

  const [inst] = await db.select().from(instance).where(eq(instance.id, id));

  if (!inst || !canAccessInstance(ctx, inst)) {
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
