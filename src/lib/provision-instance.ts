import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { createServer, uploadSSHKey } from "@/lib/hetzner";
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
import { assertProvisioningCapacity } from "@/lib/hetzner-limits";
import { utils as sshUtils } from "ssh2";

function generateSSHKeyPair(): { publicKey: string; privateKey: string } {
  const keys = sshUtils.generateKeyPairSync("ed25519", {
    comment: "papayaclaw",
  });
  return { publicKey: keys.public, privateKey: keys.private };
}

export type ProvisionInput = {
  userId: string;
  subscriptionId: string | null;
  serverType: string;
  name: string;
  model: string;
  modelApiKey: string | null;
  channel: string;
  botToken?: string;
  channelPhone?: string | null;
};

export async function provisionInstance(input: ProvisionInput) {
  const {
    userId,
    subscriptionId,
    serverType,
    name,
    model,
    modelApiKey,
    channel,
    botToken,
    channelPhone,
  } = input;

  const capacity = await assertProvisioningCapacity();
  if (!capacity.ok) throw new Error(capacity.error);

  const effectiveBotToken =
    channel === "whatsapp" ? crypto.randomUUID() : (botToken ?? "");

  const { publicKey: sshPublicKey, privateKey: sshPrivateKey } =
    generateSSHKeyPair();

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
      userId,
    })
    .returning();

  let cfTunnelId: string | null = null;
  let cfDnsRecordId: string | null = null;
  let cfTunnelHostname: string | null = null;

  try {
    const tunnelName = `papayaclaw-${newInstance.id.slice(0, 8)}`;
    const subdomain = instanceSubdomain(newInstance.id);
    const { tunnelId, tunnelToken } = await createTunnel(tunnelName);
    cfTunnelId = tunnelId;

    const hostname = `${subdomain}.papayaclaw.com`;
    await configureTunnel(tunnelId, hostname);

    const { recordId, hostname: fullHostname } = await createDnsRecord(
      subdomain,
      tunnelId,
    );
    cfDnsRecordId = recordId;
    cfTunnelHostname = fullHostname;

    const userData = generateCloudInit({
      instanceId: newInstance.id,
      instanceName: newInstance.name,
      model,
      modelApiKey: modelApiKey || null,
      channel,
      botToken: effectiveBotToken,
      channelPhone: channelPhone || null,
      sshPublicKey,
      tunnelToken,
      tunnelHostname: fullHostname,
    });

    const sshKeyName = `papayaclaw-${newInstance.id.slice(0, 8)}`;
    const hetznerKey = await uploadSSHKey(sshKeyName, sshPublicKey);

    const serverName = `papayaclaw-${newInstance.id.slice(0, 8)}`;
    const server = await createServer(
      serverName,
      userData,
      [hetznerKey.name],
      undefined,
      serverType,
    );

    const [updated] = await db
      .update(instance)
      .set({
        providerServerId: server.id,
        providerServerIp: server.public_net.ipv4.ip,
        providerSshKeyId: hetznerKey.id,
        sshPrivateKey,
        cfTunnelId,
        cfDnsRecordId,
        cfTunnelHostname,
      })
      .where(eq(instance.id, newInstance.id))
      .returning();

    pollInstanceUntilReady(
      newInstance.id,
      server.public_net.ipv4.ip,
      sshPrivateKey,
    );

    return updated;
  } catch (error) {
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

    await db.delete(instance).where(eq(instance.id, newInstance.id));

    console.error("Instance provisioning failed:", error);
    throw error;
  }
}
