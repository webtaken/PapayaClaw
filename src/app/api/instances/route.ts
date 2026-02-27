import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createServer, uploadSSHKey } from "@/lib/hetzner";
import { generateCloudInit } from "@/lib/cloud-init";
import { pollInstanceUntilReady } from "@/lib/instance-poller";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Generates an SSH keypair using ssh-keygen for proper OpenSSH format.
 */
function generateSSHKeyPair(): { publicKey: string; privateKey: string } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "papayaclaw-ssh-"));
  const keyPath = path.join(tmpDir, "id_ed25519");

  try {
    execSync(`ssh-keygen -t ed25519 -f "${keyPath}" -N "" -C "papayaclaw" -q`);
    const privateKey = fs.readFileSync(keyPath, "utf-8");
    const publicKey = fs.readFileSync(`${keyPath}.pub`, "utf-8").trim();
    return { publicKey, privateKey };
  } finally {
    // Clean up temp files
    try {
      fs.rmSync(tmpDir, { recursive: true });
    } catch {}
  }
}
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

  // Generate SSH keypair for remote pairing management
  const { publicKey: sshPublicKey, privateKey: sshPrivateKey } =
    generateSSHKeyPair();

  // Handle Premium Subscription Logic
  let activeApiKey = modelApiKey || null;
  if (modelApiKey === "PREMIUM_SUBSCRIPTION") {
    if (model.includes("anthropic")) {
      activeApiKey = process.env.ANTHROPIC_API_KEY || null;
      if (!activeApiKey)
        return NextResponse.json(
          { error: "Premium Anthropic service is temporarily unavailable." },
          { status: 503 },
        );
      if (model !== "anthropic/claude-sonnet-4-6")
        return NextResponse.json(
          {
            error:
              "Only Claude Sonnet 4.6 is included in the Anthropic Premium tier.",
          },
          { status: 400 },
        );
    } else if (model.includes("openai")) {
      activeApiKey = process.env.OPENAI_API_KEY || null;
      if (!activeApiKey)
        return NextResponse.json(
          { error: "Premium OpenAI service is temporarily unavailable." },
          { status: 503 },
        );
      if (model !== "openai/gpt-5.2")
        return NextResponse.json(
          { error: "Only GPT-5.2 is included in the OpenAI Premium tier." },
          { status: 400 },
        );
    } else {
      return NextResponse.json(
        { error: "Premium subscription is not supported for this provider." },
        { status: 400 },
      );
    }
  }

  // 1. Insert instance record with "deploying" status
  // Note: We still save modelApiKey into the DB as exactly what was requested (e.g., PREMIUM_SUBSCRIPTION instead of the raw root key)
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
      userId: session.user.id,
    })
    .returning();

  // 2. Build the cloud-init script (no callback — PapayaClaw polls via SSH)
  const userData = generateCloudInit({
    instanceId: newInstance.id,
    instanceName: newInstance.name,
    model,
    modelApiKey: activeApiKey,
    channel,
    botToken,
    sshPublicKey: sshPublicKey,
  });

  try {
    // 3. Upload SSH key to Hetzner (native injection, works without cloud-init)
    const sshKeyName = `papayaclaw-${newInstance.id.slice(0, 8)}`;
    const hetznerKey = await uploadSSHKey(sshKeyName, sshPublicKey);

    // 4. Provision the Hetzner VPS
    const serverName = `papayaclaw-${newInstance.id.slice(0, 8)}`;
    const server = await createServer(serverName, userData, [hetznerKey.name]);

    // 5. Store VPS metadata + SSH key
    const [updated] = await db
      .update(instance)
      .set({
        providerServerId: server.id,
        providerServerIp: server.public_net.ipv4.ip,
        providerSshKeyId: hetznerKey.id,
        sshPrivateKey: sshPrivateKey,
      })
      .where(eq(instance.id, newInstance.id))
      .returning();

    // 6. Fire-and-forget: poll via SSH until cloud-init finishes
    pollInstanceUntilReady(
      newInstance.id,
      server.public_net.ipv4.ip,
      sshPrivateKey,
    );

    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    // If provisioning fails, remove the instance
    await db.delete(instance).where(eq(instance.id, newInstance.id));

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
