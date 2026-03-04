import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createServer, uploadSSHKey } from "@/lib/hetzner";
import { getUserSubscription } from "@/lib/polar";
import {
  createTunnel,
  configureTunnel,
  deleteTunnel,
  createDnsRecord,
  deleteDnsRecord,
  instanceSubdomain,
} from "@/lib/cloudflare";
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

// Maps plan type → Hetzner server type
const PLAN_SERVER_TYPE: Record<string, string> = {
  basic: "cx23",
  pro: "cx33",
};

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Require an active subscription to deploy
  const subscription = await getUserSubscription(session.user.id);
  if (!subscription) {
    return NextResponse.json(
      {
        error:
          "An active subscription is required to deploy an instance. Please subscribe to a plan first.",
      },
      { status: 403 },
    );
  }

  const serverType = PLAN_SERVER_TYPE[subscription.planType] || "cx22";

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

  // Track Cloudflare resources for rollback
  let cfTunnelId: string | null = null;
  let cfDnsRecordId: string | null = null;
  let cfTunnelHostname: string | null = null;

  try {
    // 2. Create Cloudflare Tunnel
    const tunnelName = `papayaclaw-${newInstance.id.slice(0, 8)}`;
    const subdomain = instanceSubdomain(newInstance.id);
    const { tunnelId, tunnelToken } = await createTunnel(tunnelName);
    cfTunnelId = tunnelId;

    // 3. Configure tunnel ingress (hostname → localhost:18789)
    const hostname = `${subdomain}.papayaclaw.com`;
    await configureTunnel(tunnelId, hostname);

    // 4. Create DNS CNAME record
    const { recordId, hostname: fullHostname } = await createDnsRecord(
      subdomain,
      tunnelId,
    );
    cfDnsRecordId = recordId;
    cfTunnelHostname = fullHostname;

    // 5. Build the cloud-init script (includes cloudflared setup)
    const userData = generateCloudInit({
      instanceId: newInstance.id,
      instanceName: newInstance.name,
      model,
      modelApiKey: activeApiKey,
      channel,
      botToken,
      sshPublicKey: sshPublicKey,
      tunnelToken,
      tunnelHostname: fullHostname,
    });

    // 6. Upload SSH key to Hetzner (native injection, works without cloud-init)
    const sshKeyName = `papayaclaw-${newInstance.id.slice(0, 8)}`;
    const hetznerKey = await uploadSSHKey(sshKeyName, sshPublicKey);

    // 7. Provision the Hetzner VPS
    const serverName = `papayaclaw-${newInstance.id.slice(0, 8)}`;
    const server = await createServer(
      serverName,
      userData,
      [hetznerKey.name],
      undefined,
      serverType,
    );

    // 8. Store VPS + Cloudflare metadata
    const [updated] = await db
      .update(instance)
      .set({
        providerServerId: server.id,
        providerServerIp: server.public_net.ipv4.ip,
        providerSshKeyId: hetznerKey.id,
        sshPrivateKey: sshPrivateKey,
        cfTunnelId,
        cfDnsRecordId,
        cfTunnelHostname,
      })
      .where(eq(instance.id, newInstance.id))
      .returning();

    // 9. Fire-and-forget: poll via SSH until cloud-init finishes
    pollInstanceUntilReady(
      newInstance.id,
      server.public_net.ipv4.ip,
      sshPrivateKey,
    );

    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    // Rollback Cloudflare resources if provisioning fails
    if (cfDnsRecordId) {
      try {
        await deleteDnsRecord(cfDnsRecordId);
      } catch (e) {
        console.error("Cloudflare DNS record cleanup failed:", e);
      }
    }
    if (cfTunnelId) {
      try {
        await deleteTunnel(cfTunnelId);
      } catch (e) {
        console.error("Cloudflare tunnel cleanup failed:", e);
      }
    }

    // Remove the instance from DB
    await db.delete(instance).where(eq(instance.id, newInstance.id));

    console.error("Instance provisioning failed:", error);
    return NextResponse.json(
      {
        error: "Failed to provision server",
        instanceId: newInstance.id,
      },
      { status: 500 },
    );
  }
}
