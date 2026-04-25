import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { buildManifest } from "@/lib/integrations/invoke-service";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

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

export async function GET(
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

  const tools = await buildManifest({ instanceId: id });
  return NextResponse.json({ tools });
}
