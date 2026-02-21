import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * Cloud-init callback endpoint.
 *
 * Called by the VPS after OpenClaw is running to update instance status.
 * Secured with a per-instance callback secret.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { instanceId, status } = body;

  const secret = request.headers.get("x-callback-secret");

  if (!instanceId || !status || !secret) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  // Verify the callback secret matches the instance
  const [target] = await db
    .select()
    .from(instance)
    .where(
      and(eq(instance.id, instanceId), eq(instance.callbackSecret, secret)),
    );

  if (!target) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Update instance status
  const [updated] = await db
    .update(instance)
    .set({ status })
    .where(eq(instance.id, instanceId))
    .returning();

  return NextResponse.json({ success: true, status: updated.status });
}
