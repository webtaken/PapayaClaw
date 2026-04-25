import { auth } from "@/lib/auth";
import { listBindings } from "@/lib/integrations/instance-binding-service";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const bindings = await listBindings({
    instanceId: id,
    userId: session.user.id,
  });

  if (!bindings.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ bindings });
}
