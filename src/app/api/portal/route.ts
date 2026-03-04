import { CustomerPortal } from "@polar-sh/nextjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { subscription } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import { NextRequest } from "next/server";

export const GET = CustomerPortal({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  getCustomerId: async (req: NextRequest) => {
    // Authenticate the user via better-auth session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    // Look up the Polar customer ID from the subscription table
    const result = await db
      .select({ polarCustomerId: subscription.polarCustomerId })
      .from(subscription)
      .where(eq(subscription.userId, session.user.id))
      .limit(1);

    const polarCustomerId = result[0]?.polarCustomerId;

    if (!polarCustomerId) {
      throw new Error("No Polar customer found for this user");
    }

    return polarCustomerId;
  },
  server: (process.env.POLAR_SERVER as "sandbox" | "production") || "sandbox",
});
