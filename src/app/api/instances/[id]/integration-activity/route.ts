import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { instance, integrationInvocation } from "@/lib/schema";
import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [inst] = await db
    .select()
    .from(instance)
    .where(and(eq(instance.id, id), eq(instance.userId, session.user.id)))
    .limit(1);

  if (!inst) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const invocations = await db
    .select()
    .from(integrationInvocation)
    .where(eq(integrationInvocation.instanceId, id))
    .orderBy(desc(integrationInvocation.occurredAt))
    .limit(50);

  return NextResponse.json({ invocations });
}
