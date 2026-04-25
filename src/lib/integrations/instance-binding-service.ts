import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  composioConnection,
  instance,
  instanceIntegration,
} from "@/lib/schema";
import { CATALOG, type ToolkitSlug } from "@/lib/integrations/catalog";
import { integrationError } from "@/lib/integrations/errors";

export interface AvailableConnectionSummary {
  id: string;
  accountLabel: string | null;
  status: string;
}

export interface InstanceBindingDto {
  toolkitSlug: ToolkitSlug;
  enabled: boolean;
  selectedConnectionId: string | null;
  availableConnections: AvailableConnectionSummary[];
}

export async function listBindings({
  instanceId,
  userId,
}: {
  instanceId: string;
  userId: string;
}): Promise<InstanceBindingDto[]> {
  const [inst] = await db
    .select()
    .from(instance)
    .where(and(eq(instance.id, instanceId), eq(instance.userId, userId)))
    .limit(1);
  if (!inst) return [];

  const rows = await db
    .select()
    .from(instanceIntegration)
    .where(eq(instanceIntegration.instanceId, instanceId));

  const userConns = await db
    .select()
    .from(composioConnection)
    .where(eq(composioConnection.userId, userId));

  return CATALOG.map((entry) => {
    const binding = rows.find((r) => r.toolkitSlug === entry.slug);
    const available = userConns
      .filter((c) => c.toolkitSlug === entry.slug)
      .map((c) => ({
        id: c.id,
        accountLabel: c.accountLabel,
        status: c.status,
      }));

    return {
      toolkitSlug: entry.slug,
      enabled: binding?.enabled ?? false,
      selectedConnectionId: binding?.selectedConnectionId ?? null,
      availableConnections: available,
    };
  });
}

export async function upsertBinding({
  instanceId,
  userId,
  toolkitSlug,
  enabled,
  selectedConnectionId,
}: {
  instanceId: string;
  userId: string;
  toolkitSlug: string;
  enabled: boolean;
  selectedConnectionId: string | null;
}): Promise<InstanceBindingDto> {
  const [inst] = await db
    .select()
    .from(instance)
    .where(and(eq(instance.id, instanceId), eq(instance.userId, userId)))
    .limit(1);
  if (!inst) {
    throw integrationError("CONNECTION_NOT_FOUND", "Instance not found");
  }

  const userConns = await db
    .select()
    .from(composioConnection)
    .where(
      and(
        eq(composioConnection.userId, userId),
        eq(composioConnection.toolkitSlug, toolkitSlug),
      ),
    );

  if (enabled) {
    const connected = userConns.filter((c) => c.status === "connected");
    if (!connected.length) {
      throw integrationError(
        "NO_CONNECTED_ACCOUNT",
        "No connected account for this service",
      );
    }
    if (connected.length > 1 && !selectedConnectionId) {
      throw integrationError(
        "AMBIGUOUS_ACCOUNT",
        "Multiple accounts found — specify selectedConnectionId",
      );
    }
  }

  if (selectedConnectionId) {
    const owned = userConns.find((c) => c.id === selectedConnectionId);
    if (!owned) {
      throw integrationError(
        "SELECTED_CONNECTION_NOT_OWNED",
        "Connection does not belong to you",
      );
    }
  }

  const existingRows = await db
    .select()
    .from(instanceIntegration)
    .where(
      and(
        eq(instanceIntegration.instanceId, instanceId),
        eq(instanceIntegration.toolkitSlug, toolkitSlug),
      ),
    )
    .limit(1);

  if (existingRows.length) {
    await db
      .update(instanceIntegration)
      .set({ enabled, selectedConnectionId: selectedConnectionId ?? null })
      .where(eq(instanceIntegration.id, existingRows[0].id));
  } else {
    await db.insert(instanceIntegration).values({
      instanceId,
      toolkitSlug,
      enabled,
      selectedConnectionId: selectedConnectionId ?? null,
    });
  }

  const available = userConns.map((c) => ({
    id: c.id,
    accountLabel: c.accountLabel,
    status: c.status,
  }));

  return {
    toolkitSlug: toolkitSlug as ToolkitSlug,
    enabled,
    selectedConnectionId: selectedConnectionId ?? null,
    availableConnections: available,
  };
}
