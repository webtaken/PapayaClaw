import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { restartGateway } from "@/lib/ssh";
import { computeHealth } from "@/lib/gateway-health";
import { getSessionContext, canAccessInstance } from "@/lib/auth-context";

/**
 * POST /api/instances/[id]/restart
 *
 * Restarts the OpenClaw gateway on the VPS (`openclaw gateway restart`,
 * falling back to `pkill` + systemd Restart=always), waits for it to answer,
 * then returns the fresh gateway health. Does not touch VM power state or DB.
 *
 * 502 when SSH cannot reach the VPS, 500 (with `detail`) when the command fails.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getSessionContext(await headers());

  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [inst] = await db.select().from(instance).where(eq(instance.id, id));

  if (!inst || !canAccessInstance(ctx, inst)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!inst.providerServerIp || !inst.sshPrivateKey) {
    return NextResponse.json(
      { error: "Instance has no server to restart" },
      { status: 400 },
    );
  }

  let result: Awaited<ReturnType<typeof restartGateway>>;
  try {
    result = await restartGateway(inst.providerServerIp, inst.sshPrivateKey);
  } catch (error) {
    console.error("[restart] SSH error:", error);
    return NextResponse.json(
      { error: "Failed to connect to instance via SSH" },
      { status: 502 },
    );
  }

  if (result.code !== 0) {
    console.error("[restart] Gateway restart failed:", result.stderr, result.stdout);
    return NextResponse.json(
      {
        error: "Gateway restart failed",
        detail: result.stderr || result.stdout,
      },
      { status: 500 },
    );
  }

  const { health, reason: healthReason } = computeHealth({
    hetznerStatus: "running",
    probe: result.probe,
  });

  return NextResponse.json({
    health,
    healthReason,
    gatewayUp: result.probe.gatewayUp,
    configValid: result.probe.configValid,
    errorSentinel: result.probe.errorSentinel,
  });
}
