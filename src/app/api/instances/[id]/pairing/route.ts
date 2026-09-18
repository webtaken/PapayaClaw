import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { listPairingRequests, approvePairingRequest } from "@/lib/ssh";
import { assertPairingChannel, assertPairingCode } from "@/lib/pairing";
import { toErrorResponse } from "@/lib/api-errors";
import { getSessionContext, canAccessInstance } from "@/lib/auth-context";

/**
 * GET /api/instances/[id]/pairing
 *
 * Lists pending DM pairing requests by running
 * `openclaw pairing list <channel> --json` over SSH.
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
    const channel = assertPairingChannel(
      url.searchParams.get("channel") ?? inst.channel.split("|")[0],
    );
    const requests = await listPairingRequests(
      inst.providerServerIp,
      inst.sshPrivateKey,
      channel,
    );
    return NextResponse.json({ requests });
  } catch (error) {
    console.error(`[pairing] list failed for instance ${id}:`, error);
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

/**
 * POST /api/instances/[id]/pairing
 *
 * Approves a pending DM pairing request by running
 * `openclaw pairing approve <channel> <CODE>` over SSH.
 *
 * Body: { code: string, channel?: string }
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
    const channel = assertPairingChannel(
      channelParam ?? inst.channel.split("|")[0],
    );
    const pairingCode = assertPairingCode(code);
    await approvePairingRequest(
      inst.providerServerIp,
      inst.sshPrivateKey,
      pairingCode,
      channel,
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[pairing] approve failed for instance ${id}:`, error);
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
