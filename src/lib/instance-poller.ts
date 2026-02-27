/**
 * Background poller for newly-provisioned VPS instances.
 *
 * After a server is created, this module polls via SSH for sentinel files
 * written by cloud-init to determine when setup is complete.
 *
 * Sentinel files:
 *   /var/tmp/openclaw-ready  → setup succeeded → status = "running"
 *   /var/tmp/openclaw-error  → setup failed    → status = "error"
 */

import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { checkInstanceReady } from "@/lib/ssh";

const MAX_ATTEMPTS = 24; // 24 × 15s = 6 minutes max
const INTERVAL_MS = 15_000; // 15 seconds

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polls a newly-created VPS via SSH until the sentinel file appears.
 * Updates the instance status in the DB accordingly.
 *
 * Called once from POST /api/instances after server creation.
 * Runs in the background (not awaited).
 */
export async function pollInstanceUntilReady(
  instanceId: string,
  serverIp: string,
  sshPrivateKey: string,
): Promise<void> {
  console.log(
    `[instance-poller] Starting SSH polling for instance ${instanceId} at ${serverIp}`,
  );

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await sleep(INTERVAL_MS);

    const status = await checkInstanceReady(serverIp, sshPrivateKey);
    console.log(
      `[instance-poller] Attempt ${attempt}/${MAX_ATTEMPTS} for ${instanceId}: ${status}`,
    );

    if (status === "ready") {
      await db
        .update(instance)
        .set({ status: "running" })
        .where(eq(instance.id, instanceId));
      console.log(`[instance-poller] Instance ${instanceId} is now running ✓`);
      return;
    }

    if (status === "error") {
      await db
        .update(instance)
        .set({ status: "error" })
        .where(eq(instance.id, instanceId));
      console.error(
        `[instance-poller] Instance ${instanceId} reported error ✗`,
      );
      return;
    }
  }

  // Timed out — mark as error
  await db
    .update(instance)
    .set({ status: "error" })
    .where(eq(instance.id, instanceId));
  console.error(
    `[instance-poller] Instance ${instanceId} timed out after ${MAX_ATTEMPTS} attempts ✗`,
  );
}
