import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createServer, uploadSSHKey } from "@/lib/hetzner";
import {
  getAvailableSubscription,
  isPolarConfigured,
  PLAN_SERVER_TYPE,
} from "@/lib/polar";
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
import { utils as sshUtils } from "ssh2";

/**
 * Generates an ed25519 SSH keypair in OpenSSH format using ssh2.
 * No system dependency on ssh-keygen required.
 */
function generateSSHKeyPair(): { publicKey: string; privateKey: string } {
  const keys = sshUtils.generateKeyPairSync("ed25519", {
    comment: "papayaclaw",
  });

  return { publicKey: keys.public, privateKey: keys.private };
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

  // When Polar is configured, enforce 1:1 subscription-to-instance rule.
  // When Polar is not configured (OSS / dev mode), skip the check entirely.
  let subscriptionId: string | null = null;
  let serverType = "cx22";

  if (isPolarConfigured()) {
    const subscription = await getAvailableSubscription(session.user.id);
    if (!subscription) {
      return NextResponse.json(
        {
          error:
            "No available subscription. Each subscription supports one instance. Purchase another subscription or delete an existing instance.",
        },
        { status: 403 },
      );
    }
    subscriptionId = subscription.id;
    serverType = PLAN_SERVER_TYPE[subscription.planType] || "cx22";
  }

  const body = await request.json();
  const { name, model, modelApiKey, channel, botToken, channelPhone } = body;

  if (!name || !model || !channel) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  if (channel === "telegram" && !botToken) {
    return NextResponse.json(
      { error: "Telegram requires a bot token" },
      { status: 400 },
    );
  }

  if (channel === "whatsapp" && !channelPhone) {
    return NextResponse.json(
      { error: "WhatsApp requires a phone number" },
      { status: 400 },
    );
  }

  // For WhatsApp, generate a gateway auth token (no bot token needed)
  const effectiveBotToken =
    channel === "whatsapp" ? crypto.randomUUID() : botToken;

  // Generate SSH keypair for remote pairing management
  const { publicKey: sshPublicKey, privateKey: sshPrivateKey } =
    generateSSHKeyPair();

  // Use provided API key directly
  const activeApiKey = modelApiKey || null;

  // 1. Insert instance record with "deploying" status
  // Note: We still save modelApiKey into the DB as exactly what was requested
  const [newInstance] = await db
    .insert(instance)
    .values({
      name,
      model,
      modelApiKey: modelApiKey || null,
      channel,
      botToken: effectiveBotToken,
      channelPhone: channelPhone || null,
      status: "deploying",
      provider: "hetzner",
      subscriptionId,
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
      botToken: effectiveBotToken,
      channelPhone: channelPhone || null,
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
