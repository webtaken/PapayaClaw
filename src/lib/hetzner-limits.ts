import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { count } from "drizzle-orm";

export const HETZNER_SERVER_LIMIT = Number(
  process.env.HETZNER_SERVER_LIMIT ?? 5,
);

export async function countProvisionedInstances(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(instance);
  return Number(row?.value ?? 0);
}

export type CapacitySnapshot = {
  used: number;
  limit: number;
  remaining: number;
};

export async function getCapacitySnapshot(): Promise<CapacitySnapshot> {
  const used = await countProvisionedInstances();
  const limit = HETZNER_SERVER_LIMIT;
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

export type CapacityCheck =
  | { ok: true }
  | { ok: false; error: string; current: number; limit: number };

export async function assertProvisioningCapacity(): Promise<CapacityCheck> {
  const current = await countProvisionedInstances();
  if (current >= HETZNER_SERVER_LIMIT) {
    return {
      ok: false,
      current,
      limit: HETZNER_SERVER_LIMIT,
      error: `Provisioning capacity reached (${current}/${HETZNER_SERVER_LIMIT}). Try again later or contact support.`,
    };
  }
  return { ok: true };
}
