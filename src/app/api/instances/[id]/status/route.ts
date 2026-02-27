import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getServer } from "@/lib/hetzner";
import { checkInstanceReady } from "@/lib/ssh";

/**
 * Lightweight status endpoint for polling.
 * Returns the DB instance status + live Hetzner server status.
 *
 * When Hetzner reports "running" but the DB status is still "deploying",
 * performs a fallback SSH sentinel-file check and updates the DB if ready.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [inst] = await db
    .select()
    .from(instance)
    .where(and(eq(instance.id, id), eq(instance.userId, session.user.id)));

  if (!inst) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let hetznerStatus: string | null = null;

  if (inst.providerServerId) {
    try {
      const server = await getServer(inst.providerServerId);
      hetznerStatus = server.status;
    } catch (error) {
      console.error("[status] Failed to fetch Hetzner status:", error);
      hetznerStatus = "unknown";
    }
  }

  // Fallback: if Hetzner says "running" but DB is still "deploying",
  // SSH-check the sentinel file in case the background poller hasn't caught up.
  let instanceStatus = inst.status;

  if (
    hetznerStatus === "running" &&
    inst.status === "deploying" &&
    inst.providerServerIp &&
    inst.sshPrivateKey
  ) {
    try {
      const readiness = await checkInstanceReady(
        inst.providerServerIp,
        inst.sshPrivateKey,
      );
      if (readiness === "ready") {
        await db
          .update(instance)
          .set({ status: "running" })
          .where(eq(instance.id, inst.id));
        instanceStatus = "running";
      } else if (readiness === "error") {
        await db
          .update(instance)
          .set({ status: "error" })
          .where(eq(instance.id, inst.id));
        instanceStatus = "error";
      }
    } catch {
      // SSH not ready yet — keep polling
    }
  }

  return NextResponse.json({
    instanceStatus,
    hetznerStatus,
    serverIp: inst.providerServerIp,
  });
}
