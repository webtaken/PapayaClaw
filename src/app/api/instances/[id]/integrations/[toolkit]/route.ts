import { auth } from "@/lib/auth";
import { upsertBinding } from "@/lib/integrations/instance-binding-service";
import { IntegrationError, toErrorResponse } from "@/lib/integrations/errors";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const BindingUpdate = z.object({
  enabled: z.boolean(),
  selectedConnectionId: z.string().uuid().nullable(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; toolkit: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, toolkit } = await params;

  const body = BindingUpdate.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const result = await upsertBinding({
      instanceId: id,
      userId: session.user.id,
      toolkitSlug: toolkit,
      enabled: body.data.enabled,
      selectedConnectionId: body.data.selectedConnectionId,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof IntegrationError) {
      return NextResponse.json(toErrorResponse(err), { status: err.statusCode });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
