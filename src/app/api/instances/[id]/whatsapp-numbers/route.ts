import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  getWhatsAppAllowedNumbers,
  setWhatsAppAllowedNumbers,
} from "@/lib/ssh";

/**
 * POST /api/instances/[id]/whatsapp-numbers
 *
 * Adds a phone number to the WhatsApp allowFrom list.
 * Body: { phone: string }
 */
export async function POST(
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
  const { phone } = body;

  if (!phone || typeof phone !== "string" || !/^\+\d+$/.test(phone)) {
    return NextResponse.json(
      { error: "Invalid phone number. Must start with + followed by digits." },
      { status: 400 },
    );
  }

  const [inst] = await db
    .select()
    .from(instance)
    .where(and(eq(instance.id, id), eq(instance.userId, session.user.id)));

  if (!inst) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!inst.providerServerIp || !inst.sshPrivateKey) {
    return NextResponse.json(
      { error: "Instance not ready for SSH" },
      { status: 400 },
    );
  }

  try {
    const current = await getWhatsAppAllowedNumbers(
      inst.providerServerIp,
      inst.sshPrivateKey,
    );

    if (current.includes(phone)) {
      return NextResponse.json({ numbers: current });
    }

    const updated = [...current, phone];
    const result = await setWhatsAppAllowedNumbers(
      inst.providerServerIp,
      inst.sshPrivateKey,
      updated,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ numbers: updated });
  } catch (error) {
    console.error("Failed to add WhatsApp number:", error);
    return NextResponse.json(
      { error: "Failed to connect to instance" },
      { status: 502 },
    );
  }
}

/**
 * DELETE /api/instances/[id]/whatsapp-numbers
 *
 * Removes a phone number from the WhatsApp allowFrom list.
 * Body: { phone: string }
 */
export async function DELETE(
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
  const { phone } = body;

  if (!phone || typeof phone !== "string") {
    return NextResponse.json(
      { error: "Missing phone number" },
      { status: 400 },
    );
  }

  const [inst] = await db
    .select()
    .from(instance)
    .where(and(eq(instance.id, id), eq(instance.userId, session.user.id)));

  if (!inst) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!inst.providerServerIp || !inst.sshPrivateKey) {
    return NextResponse.json(
      { error: "Instance not ready for SSH" },
      { status: 400 },
    );
  }

  try {
    const current = await getWhatsAppAllowedNumbers(
      inst.providerServerIp,
      inst.sshPrivateKey,
    );

    const updated = current.filter((n) => n !== phone);
    const result = await setWhatsAppAllowedNumbers(
      inst.providerServerIp,
      inst.sshPrivateKey,
      updated,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ numbers: updated });
  } catch (error) {
    console.error("Failed to remove WhatsApp number:", error);
    return NextResponse.json(
      { error: "Failed to connect to instance" },
      { status: 502 },
    );
  }
}
