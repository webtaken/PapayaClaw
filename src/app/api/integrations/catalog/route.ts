import { auth } from "@/lib/auth";
import { CATALOG } from "@/lib/integrations/catalog";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    { services: CATALOG },
    {
      headers: {
        "Cache-Control": "private, s-maxage=3600, stale-while-revalidate=60",
      },
    },
  );
}
