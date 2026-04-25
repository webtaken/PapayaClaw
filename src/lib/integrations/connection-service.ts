import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  composioConnection,
  instanceIntegration,
  integrationLifecycleEvent,
} from "@/lib/schema";
import { getComposio } from "@/lib/composio";
import { isToolkitSlug } from "@/lib/integrations/catalog";
import { integrationError } from "@/lib/integrations/errors";

const PENDING_TTL_MS = 15 * 60 * 1000;

function generateState(): string {
  return crypto.randomBytes(16).toString("base64url");
}

export async function initiateConnection({
  userId,
  toolkitSlug,
}: {
  userId: string;
  toolkitSlug: string;
}): Promise<{ connectionId: string; redirectUrl: string }> {
  if (!isToolkitSlug(toolkitSlug)) {
    throw integrationError("INVALID_TOOLKIT", `Unknown toolkit: ${toolkitSlug}`);
  }

  const composio = getComposio();
  let connectionRequest: Awaited<
    ReturnType<typeof composio.toolkits.authorize>
  >;

  try {
    connectionRequest = await composio.toolkits.authorize(userId, toolkitSlug);
  } catch (err) {
    throw integrationError(
      "UPSTREAM_UNAVAILABLE",
      `Failed to initiate Composio OAuth: ${String(err)}`,
    );
  }

  if (!connectionRequest.redirectUrl) {
    throw integrationError(
      "UPSTREAM_UNAVAILABLE",
      "Composio did not return a redirect URL",
    );
  }

  const state = generateState();
  const connectionId = crypto.randomUUID();

  await db.insert(composioConnection).values({
    id: connectionId,
    userId,
    toolkitSlug,
    composioConnectedAccountId: connectionRequest.id,
    initiationState: state,
    status: "pending",
  });

  await db.insert(integrationLifecycleEvent).values({
    userId,
    connectionId,
    toolkitSlug,
    eventType: "created",
  });

  return { connectionId, redirectUrl: connectionRequest.redirectUrl };
}

export async function completeConnection({
  composioConnectedAccountId,
}: {
  composioConnectedAccountId: string;
}): Promise<typeof composioConnection.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(composioConnection)
    .where(
      and(
        eq(composioConnection.composioConnectedAccountId, composioConnectedAccountId),
        eq(composioConnection.status, "pending"),
      ),
    )
    .limit(1);

  if (!row) return null;

  const ageMs = Date.now() - row.createdAt.getTime();
  if (ageMs > PENDING_TTL_MS) {
    await db.delete(composioConnection).where(eq(composioConnection.id, row.id));
    return null;
  }

  let accountLabel: string | null = null;
  try {
    const composio = getComposio();
    const account = await composio.connectedAccounts.get(composioConnectedAccountId);
    accountLabel = (account as { alias?: string | null }).alias ?? null;
  } catch {
    // label is cosmetic — proceed without it
  }

  await db
    .update(composioConnection)
    .set({
      status: "connected",
      accountLabel,
      initiationState: null,
      lastHealthCheckAt: new Date(),
    })
    .where(eq(composioConnection.id, row.id));

  await db.insert(integrationLifecycleEvent).values({
    userId: row.userId,
    connectionId: row.id,
    toolkitSlug: row.toolkitSlug,
    eventType: "completed",
  });

  return { ...row, status: "connected", accountLabel, initiationState: null };
}

export async function listConnections({
  userId,
}: {
  userId: string;
}): Promise<(typeof composioConnection.$inferSelect)[]> {
  return db
    .select()
    .from(composioConnection)
    .where(eq(composioConnection.userId, userId));
}

export async function disconnect({
  userId,
  connectionId,
}: {
  userId: string;
  connectionId: string;
}): Promise<void> {
  const [row] = await db
    .select()
    .from(composioConnection)
    .where(
      and(
        eq(composioConnection.id, connectionId),
        eq(composioConnection.userId, userId),
      ),
    )
    .limit(1);

  if (!row) {
    throw integrationError("CONNECTION_NOT_FOUND", "Connection not found");
  }

  const composio = getComposio();
  try {
    await composio.connectedAccounts.delete(row.composioConnectedAccountId);
  } catch (err) {
    throw integrationError(
      "UPSTREAM_UNAVAILABLE",
      `Failed to disconnect: ${String(err)}`,
    );
  }

  await db.insert(integrationLifecycleEvent).values({
    userId,
    connectionId,
    toolkitSlug: row.toolkitSlug,
    eventType: "disconnected",
  });

  await db.transaction(async (tx) => {
    await tx
      .update(instanceIntegration)
      .set({ selectedConnectionId: null })
      .where(eq(instanceIntegration.selectedConnectionId, connectionId));
    await tx
      .delete(composioConnection)
      .where(eq(composioConnection.id, connectionId));
  });
}

export async function reinitiate({
  userId,
  connectionId,
}: {
  userId: string;
  connectionId: string;
}): Promise<{ redirectUrl: string }> {
  const [row] = await db
    .select()
    .from(composioConnection)
    .where(
      and(
        eq(composioConnection.id, connectionId),
        eq(composioConnection.userId, userId),
      ),
    )
    .limit(1);

  if (!row) {
    throw integrationError("CONNECTION_NOT_FOUND", "Connection not found");
  }

  const composio = getComposio();
  let connectionRequest: Awaited<
    ReturnType<typeof composio.toolkits.authorize>
  >;

  try {
    connectionRequest = await composio.toolkits.authorize(userId, row.toolkitSlug);
  } catch (err) {
    throw integrationError(
      "UPSTREAM_UNAVAILABLE",
      `Failed to initiate reconnect: ${String(err)}`,
    );
  }

  if (!connectionRequest.redirectUrl) {
    throw integrationError("UPSTREAM_UNAVAILABLE", "No redirect URL returned");
  }

  const state = generateState();

  await db
    .update(composioConnection)
    .set({
      composioConnectedAccountId: connectionRequest.id,
      initiationState: state,
      status: "pending",
    })
    .where(eq(composioConnection.id, connectionId));

  return { redirectUrl: connectionRequest.redirectUrl };
}

export async function revokeAllForUser(userId: string): Promise<void> {
  const rows = await db
    .select()
    .from(composioConnection)
    .where(eq(composioConnection.userId, userId));

  const composio = getComposio();

  for (const row of rows) {
    try {
      await composio.connectedAccounts.delete(row.composioConnectedAccountId);
    } catch {
      // best-effort — log but don't abort the cascade
    }
    await db.insert(integrationLifecycleEvent).values({
      userId,
      connectionId: row.id,
      toolkitSlug: row.toolkitSlug,
      eventType: "revoked_cascade",
    });
    await db
      .delete(composioConnection)
      .where(eq(composioConnection.id, row.id));
  }
}

