import { auth } from "@/lib/auth";
import {
  disconnect,
  reinitiate,
} from "@/lib/integrations/connection-service";
import { IntegrationError, toErrorResponse } from "@/lib/integrations/errors";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await disconnect({ userId: session.user.id, connectionId: id });
    return new NextResponse(null, { status: 204 });
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

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const result = await reinitiate({ userId: session.user.id, connectionId: id });
    return NextResponse.json({ redirectUrl: result.redirectUrl });
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
