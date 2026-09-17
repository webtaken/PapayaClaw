import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getServer } from "@/lib/hetzner";
import {
  checkGatewayHealth,
  checkInstanceReady,
  getInstanceChannels,
  getWhatsAppAllowedNumbers,
} from "@/lib/ssh";
import { getSessionContext, canAccessInstance } from "@/lib/auth-context";
import { computeHealth, type GatewayProbe } from "@/lib/gateway-health";

/**
 * Lightweight status endpoint for polling.
 * Returns the DB instance status + live Hetzner server status.
 *
 * When Hetzner reports "running" but the DB status is still "deploying",
 * performs a fallback SSH sentinel-file check and updates the DB if ready.
 *
 * Once the VM is running and no longer deploying, also probes the OpenClaw
 * gateway over SSH (HTTP answer + config validity) and reports an ephemeral
 * `health` — VM power state alone does not prove the agent is alive.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getSessionContext(await headers());

  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [inst] = await db
    .select()
    .from(instance)
    .where(eq(instance.id, id));

  if (!inst || !canAccessInstance(ctx, inst)) {
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

  // Live data from the VPS. All SSH calls run in parallel (one round-trip wall time).
  let channels: string[] = inst.channel.split("|");
  let whatsappNumbers: string[] = [];
  let probe: GatewayProbe | null = null;

  const canSsh = Boolean(inst.providerServerIp && inst.sshPrivateKey);
  // Channels/numbers only make sense once setup finished.
  const fetchChannels = canSsh && instanceStatus === "running";
  // Health is probed whenever the VM is up and setup is no longer in flight —
  // including DB status "error", so a config-invalid instance can be recovered.
  const probeHealth =
    canSsh && hetznerStatus === "running" && instanceStatus !== "deploying";

  if (canSsh && (fetchChannels || probeHealth)) {
    const ip = inst.providerServerIp!;
    const key = inst.sshPrivateKey!;

    const [liveChannels, liveNumbers, liveProbe] = await Promise.all([
      fetchChannels ? getInstanceChannels(ip, key) : Promise.resolve([]),
      fetchChannels ? getWhatsAppAllowedNumbers(ip, key) : Promise.resolve([]),
      probeHealth
        ? checkGatewayHealth(ip, key).catch((error: unknown) => {
            console.error("[status] Gateway health probe failed:", error);
            return null;
          })
        : Promise.resolve(null),
    ]);

    if (liveChannels.length > 0) {
      channels = liveChannels;
      const newChannelValue = liveChannels.join("|");
      if (newChannelValue !== inst.channel) {
        await db
          .update(instance)
          .set({ channel: newChannelValue })
          .where(eq(instance.id, inst.id));
      }
    }

    whatsappNumbers = liveNumbers;
    probe = liveProbe;
  }

  const { health, reason: healthReason } = computeHealth({
    hetznerStatus,
    probe,
  });

  return NextResponse.json({
    instanceStatus,
    hetznerStatus,
    serverIp: inst.providerServerIp,
    gatewayToken: inst.botToken,
    channels,
    whatsappNumbers,
    health,
    healthReason,
    gatewayUp: probe?.gatewayUp ?? null,
    configValid: probe?.configValid ?? null,
    errorSentinel: probe?.errorSentinel ?? null,
  });
}
