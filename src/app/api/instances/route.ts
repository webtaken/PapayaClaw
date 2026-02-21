import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createServer } from "@/lib/hetzner";
import { generateCloudInit } from "@/lib/cloud-init";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const instances = await db
    .select()
    .from(instance)
    .where(eq(instance.userId, session.user.id))
    .orderBy(desc(instance.createdAt));

  return NextResponse.json(instances);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, model, modelApiKey, channel, botToken } = body;

  if (!name || !model || !channel || !botToken) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  // Generate a secret for the cloud-init callback
  const callbackSecret = crypto.randomUUID();

  // 1. Insert instance record with "deploying" status
  const [newInstance] = await db
    .insert(instance)
    .values({
      name,
      model,
      modelApiKey: modelApiKey || null,
      channel,
      botToken,
      status: "deploying",
      provider: "hetzner",
      callbackSecret,
      userId: session.user.id,
    })
    .returning();

  // 2. Build the callback URL for cloud-init
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const callbackUrl = `${protocol}://${host}/api/instances/callback`;

  // 3. Generate cloud-init script
  const userData = generateCloudInit({
    instanceId: newInstance.id,
    model,
    modelApiKey: modelApiKey || null,
    channel,
    botToken,
    callbackUrl,
    callbackSecret,
  });

  try {
    // 4. Provision the Hetzner VPS
    const serverName = `papayaclaw-${newInstance.id.slice(0, 8)}`;
    const server = await createServer(serverName, userData);

    // 5. Store VPS metadata
    const [updated] = await db
      .update(instance)
      .set({
        providerServerId: server.id,
        providerServerIp: server.public_net.ipv4.ip,
      })
      .where(eq(instance.id, newInstance.id))
      .returning();

    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    // If provisioning fails, mark the instance as errored
    await db
      .update(instance)
      .set({ status: "error" })
      .where(eq(instance.id, newInstance.id));

    console.error("Hetzner provisioning failed:", error);
    return NextResponse.json(
      {
        error: "Failed to provision server",
        instanceId: newInstance.id,
      },
      { status: 500 },
    );
  }
}
