import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { listPairingRequests, approvePairingRequest } from "@/lib/ssh";
import { getSessionContext, canAccessInstance } from "@/lib/auth-context";

/**
 * GET /api/instances/[id]/pairing
 *
 * Lists pending Telegram pairing requests by SSH-ing into the VPS
 * and reading the pairing state file.
 */
export async function GET(
  request: Request,
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

  if (!inst.providerServerIp || !inst.sshPrivateKey) {
    return NextResponse.json(
      { error: "Instance not ready for SSH" },
      { status: 400 },
    );
  }

  try {
    const url = new URL(request.url);
    const channelParam = url.searchParams.get("channel") || inst.channel.split("|")[0];
    const requests = await listPairingRequests(
      inst.providerServerIp,
      inst.sshPrivateKey,
      channelParam,
    );
    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Failed to list pairing requests:", error);
    return NextResponse.json(
      { error: "Failed to connect to instance" },
      { status: 502 },
    );
  }
}

/**
 * POST /api/instances/[id]/pairing
 *
 * Approves a Telegram pairing request by SSH-ing into the VPS
 * and running `openclaw pairing approve telegram <CODE>`.
 *
 * Body: { code: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getSessionContext(await headers());

  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { code, channel: channelParam } = body;

  if (!code || typeof code !== "string") {
    return NextResponse.json(
      { error: "Missing pairing code" },
      { status: 400 },
    );
  }

  const [inst] = await db
    .select()
    .from(instance)
    .where(eq(instance.id, id));

  if (!inst || !canAccessInstance(ctx, inst)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!inst.providerServerIp || !inst.sshPrivateKey) {
    return NextResponse.json(
      { error: "Instance not ready for SSH" },
      { status: 400 },
    );
  }

  try {
    const approveChannel = channelParam || inst.channel.split("|")[0];
    const result = await approvePairingRequest(
      inst.providerServerIp,
      inst.sshPrivateKey,
      code,
      approveChannel,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to approve pairing:", error);
    return NextResponse.json(
      { error: "Failed to connect to instance" },
      { status: 502 },
    );
  }
}
