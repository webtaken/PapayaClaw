import { completeConnection } from "@/lib/integrations/connection-service";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const composioConnectedAccountId = searchParams.get("composioConnectedAccountId");
  const status = searchParams.get("status");
  const toolkitSlug = searchParams.get("toolkitSlug") ?? "service";

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!composioConnectedAccountId) {
    return NextResponse.redirect(
      `${baseUrl}/en/dashboard?integrationError=${encodeURIComponent(toolkitSlug)}`,
    );
  }

  if (status === "failed") {
    return NextResponse.redirect(
      `${baseUrl}/en/dashboard?integrationError=${encodeURIComponent(toolkitSlug)}`,
    );
  }

  try {
    const row = await completeConnection({ composioConnectedAccountId });
    if (!row) {
      return NextResponse.redirect(
        `${baseUrl}/en/dashboard?integrationError=${encodeURIComponent(toolkitSlug)}`,
      );
    }

    return NextResponse.redirect(
      `${baseUrl}/en/dashboard?connected=${encodeURIComponent(row.toolkitSlug)}`,
    );
  } catch {
    return NextResponse.redirect(
      `${baseUrl}/en/dashboard?integrationError=${encodeURIComponent(toolkitSlug)}`,
    );
  }
}
