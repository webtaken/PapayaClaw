import { auth } from "@/lib/auth";
import { initiateConnection } from "@/lib/integrations/connection-service";
import { IntegrationError, toErrorResponse } from "@/lib/integrations/errors";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const ConnectRequest = z.object({ toolkitSlug: z.string().min(1) });

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = ConnectRequest.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const result = await initiateConnection({
      userId: session.user.id,
      toolkitSlug: body.data.toolkitSlug,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof IntegrationError) {
      return NextResponse.json(toErrorResponse(err), { status: err.statusCode });
    }
    return NextResponse.json(
      { error: { code: "UPSTREAM_UNAVAILABLE", message: "Unexpected error" } },
      { status: 502 },
    );
  }
}
