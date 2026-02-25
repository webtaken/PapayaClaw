import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getServer } from "@/lib/hetzner";

/**
 * Lightweight status endpoint for polling.
 * Returns the DB instance status + live Hetzner server status.
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

  return NextResponse.json({
    instanceStatus: inst.status,
    hetznerStatus,
    serverIp: inst.providerServerIp,
  });
}
