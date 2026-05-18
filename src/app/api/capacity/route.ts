import { NextResponse } from "next/server";
import { getCapacitySnapshot } from "@/lib/hetzner-limits";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getCapacitySnapshot();
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "public, max-age=15, stale-while-revalidate=60",
    },
  });
}
