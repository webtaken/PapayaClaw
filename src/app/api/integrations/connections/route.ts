import { auth } from "@/lib/auth";
import { listConnections } from "@/lib/integrations/connection-service";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connections = await listConnections({ userId: session.user.id });
  return NextResponse.json({ connections });
}
