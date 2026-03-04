import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { deleteServer, powerOn, powerOff, deleteSSHKey } from "@/lib/hetzner";
import { deleteTunnel, deleteDnsRecord } from "@/lib/cloudflare";

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

  return NextResponse.json(inst);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { name, status } = body;

  // Fetch the current instance to get the Hetzner server ID
  const [current] = await db
    .select()
    .from(instance)
    .where(and(eq(instance.id, id), eq(instance.userId, session.user.id)));

  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Handle lifecycle actions via Hetzner API
  if (status && current.providerServerId) {
    try {
      if (status === "stopped") {
        await powerOff(current.providerServerId);
      } else if (status === "running" && current.status === "stopped") {
        await powerOn(current.providerServerId);
      }
    } catch (error) {
      console.error("Hetzner lifecycle action failed:", error);
      return NextResponse.json(
        { error: "Failed to update server state" },
        { status: 500 },
      );
    }
  }

  const updateData: Record<string, string> = {};
  if (name) updateData.name = name;
  if (status) updateData.status = status;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(instance)
    .set(updateData)
    .where(and(eq(instance.id, id), eq(instance.userId, session.user.id)))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
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

  // Fetch instance to get the Hetzner server ID
  const [current] = await db
    .select()
    .from(instance)
    .where(and(eq(instance.id, id), eq(instance.userId, session.user.id)));

  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete the Hetzner VPS first (if it exists)
  if (current.providerServerId) {
    try {
      await deleteServer(current.providerServerId);
    } catch (error) {
      console.error("Hetzner delete failed:", error);
      // Continue with DB deletion even if Hetzner fails —
      // orphaned servers can be cleaned up via the Hetzner console
    }
  }

  // Delete the Hetzner SSH key (if it exists)
  if (current.providerSshKeyId) {
    try {
      await deleteSSHKey(current.providerSshKeyId);
    } catch (error) {
      console.error("Hetzner SSH key delete failed:", error);
    }
  }

  // Delete the Cloudflare DNS record (if it exists)
  if (current.cfDnsRecordId) {
    try {
      await deleteDnsRecord(current.cfDnsRecordId);
    } catch (error) {
      console.error("Cloudflare DNS record delete failed:", error);
    }
  }

  // Delete the Cloudflare Tunnel (if it exists)
  if (current.cfTunnelId) {
    try {
      await deleteTunnel(current.cfTunnelId);
    } catch (error) {
      console.error("Cloudflare tunnel delete failed:", error);
    }
  }

  // Delete from database
  const [deleted] = await db
    .delete(instance)
    .where(and(eq(instance.id, id), eq(instance.userId, session.user.id)))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
