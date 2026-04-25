import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { invokeAction } from "@/lib/integrations/invoke-service";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const InvokeRequest = z.object({
  actionSlug: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()),
});

async function resolveInstance(id: string, authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const secret = authHeader.slice(7);
  const [inst] = await db
    .select()
    .from(instance)
    .where(eq(instance.id, id))
    .limit(1);
  if (!inst || inst.callbackSecret !== secret) return null;
  return inst;
}

const OUTCOME_STATUS: Record<string, number> = {
  success: 200,
  not_enabled: 400,
  connection_unhealthy: 409,
  provider_error: 502,
  auth_denied: 401,
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const inst = await resolveInstance(
    id,
    request.headers.get("Authorization"),
  );
  if (!inst) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = InvokeRequest.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const response = await invokeAction({
    instanceId: id,
    actionSlug: body.data.actionSlug,
    arguments: body.data.arguments,
  });

  const status = OUTCOME_STATUS[response.outcome] ?? 200;
  return NextResponse.json(response, { status });
}
