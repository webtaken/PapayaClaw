import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  composioConnection,
  instanceIntegration,
  integrationInvocation,
  integrationLifecycleEvent,
  instance,
} from "@/lib/schema";
import { getComposio } from "@/lib/composio";
import { TOOLKIT_SLUGS, isToolkitSlug } from "@/lib/integrations/catalog";

function slugFromAction(actionSlug: string): string | null {
  const lower = actionSlug.toLowerCase();
  for (const s of TOOLKIT_SLUGS) {
    if (lower.startsWith(s + "_")) return s;
  }
  return null;
}

export async function buildManifest({ instanceId }: { instanceId: string }) {
  const [inst] = await db
    .select()
    .from(instance)
    .where(eq(instance.id, instanceId))
    .limit(1);
  if (!inst) return [];

  const bindings = await db
    .select({
      toolkitSlug: instanceIntegration.toolkitSlug,
      selectedConnectionId: instanceIntegration.selectedConnectionId,
      enabled: instanceIntegration.enabled,
    })
    .from(instanceIntegration)
    .where(
      and(
        eq(instanceIntegration.instanceId, instanceId),
        eq(instanceIntegration.enabled, true),
      ),
    );

  const connectedSlugs: string[] = [];
  for (const b of bindings) {
    let connId = b.selectedConnectionId;
    if (!connId) {
      const [sole] = await db
        .select({ id: composioConnection.id })
        .from(composioConnection)
        .where(
          and(
            eq(composioConnection.userId, inst.userId),
            eq(composioConnection.toolkitSlug, b.toolkitSlug),
            eq(composioConnection.status, "connected"),
          ),
        )
        .limit(1);
      connId = sole?.id ?? null;
    }
    if (!connId) continue;

    const [conn] = await db
      .select({ status: composioConnection.status })
      .from(composioConnection)
      .where(eq(composioConnection.id, connId))
      .limit(1);
    if (conn?.status === "connected") {
      connectedSlugs.push(b.toolkitSlug);
    }
  }

  if (!connectedSlugs.length) return [];

  const composio = getComposio();
  try {
    const tools = await composio.tools.get(inst.userId, {
      toolkits: connectedSlugs,
    });
    return tools as unknown[];
  } catch {
    return [];
  }
}

export async function invokeAction({
  instanceId,
  actionSlug,
  arguments: args,
}: {
  instanceId: string;
  actionSlug: string;
  arguments: Record<string, unknown>;
}): Promise<{ outcome: string; result?: unknown }> {
  const toolkitSlug = slugFromAction(actionSlug);
  if (!toolkitSlug || !isToolkitSlug(toolkitSlug)) {
    return { outcome: "not_enabled" };
  }

  const [inst] = await db
    .select()
    .from(instance)
    .where(eq(instance.id, instanceId))
    .limit(1);
  if (!inst) return { outcome: "not_enabled" };

  const [binding] = await db
    .select()
    .from(instanceIntegration)
    .where(
      and(
        eq(instanceIntegration.instanceId, instanceId),
        eq(instanceIntegration.toolkitSlug, toolkitSlug),
        eq(instanceIntegration.enabled, true),
      ),
    )
    .limit(1);

  if (!binding) {
    await db.insert(integrationInvocation).values({
      instanceId,
      userId: inst.userId,
      toolkitSlug,
      actionSlug,
      outcome: "not_enabled",
    });
    return { outcome: "not_enabled" };
  }

  let connId = binding.selectedConnectionId;
  if (!connId) {
    const [sole] = await db
      .select({ id: composioConnection.id, status: composioConnection.status })
      .from(composioConnection)
      .where(
        and(
          eq(composioConnection.userId, inst.userId),
          eq(composioConnection.toolkitSlug, toolkitSlug),
          eq(composioConnection.status, "connected"),
        ),
      )
      .limit(1);
    connId = sole?.id ?? null;
  }

  if (!connId) {
    await db.insert(integrationInvocation).values({
      instanceId,
      userId: inst.userId,
      toolkitSlug,
      actionSlug,
      outcome: "not_enabled",
    });
    return { outcome: "not_enabled" };
  }

  const [conn] = await db
    .select()
    .from(composioConnection)
    .where(eq(composioConnection.id, connId))
    .limit(1);

  if (!conn || conn.status !== "connected") {
    await db.insert(integrationInvocation).values({
      instanceId,
      userId: inst.userId,
      toolkitSlug,
      actionSlug,
      outcome: "connection_unhealthy",
    });
    return { outcome: "connection_unhealthy" };
  }

  const start = Date.now();
  const composio = getComposio();

  try {
    const result = await Promise.race([
      composio.tools.execute(actionSlug, {
        userId: inst.userId,
        arguments: args,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT")), 30_000),
      ),
    ]);

    const latencyMs = Date.now() - start;
    await db.insert(integrationInvocation).values({
      instanceId,
      userId: inst.userId,
      toolkitSlug,
      actionSlug,
      outcome: "success",
      latencyMs,
    });

    return { outcome: "success", result };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const errStr = String(err);
    const isAuthError =
      errStr.includes("auth") ||
      errStr.includes("unauthorized") ||
      errStr.includes("TIMEOUT");
    const errorClass = errStr.slice(0, 200);

    if (isAuthError && !errStr.includes("TIMEOUT")) {
      await db
        .update(composioConnection)
        .set({ status: "reconnect_required" })
        .where(eq(composioConnection.id, connId));

      await db.insert(integrationLifecycleEvent).values({
        userId: inst.userId,
        connectionId: connId,
        toolkitSlug,
        eventType: "flagged_unhealthy",
        errorClass,
      });

      await db.insert(integrationInvocation).values({
        instanceId,
        userId: inst.userId,
        toolkitSlug,
        actionSlug,
        outcome: "connection_unhealthy",
        errorClass,
        latencyMs,
      });

      return { outcome: "connection_unhealthy" };
    }

    const outcome = errStr.includes("TIMEOUT") ? "provider_error" : "provider_error";
    await db.insert(integrationInvocation).values({
      instanceId,
      userId: inst.userId,
      toolkitSlug,
      actionSlug,
      outcome,
      errorClass: errStr.includes("TIMEOUT") ? "TIMEOUT" : errorClass,
      latencyMs,
    });

    return { outcome };
  }
}
