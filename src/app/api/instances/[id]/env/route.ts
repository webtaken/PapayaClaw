import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { readEnvVars, writeEnvVars, restartGateway } from "@/lib/ssh";
import { computeHealth } from "@/lib/gateway-health";
import { InvalidInputError, toErrorResponse } from "@/lib/api-errors";
import { validateEnvVars, type EnvVar } from "@/lib/env-file";
import { getSessionContext, canAccessInstance } from "@/lib/auth-context";

/**
 * Environment variables for an instance's OpenClaw runtime.
 *
 * Source of truth is `/root/.openclaw/.env` on the VPS (OpenClaw's global env
 * file, read at gateway start). Nothing is persisted in the database.
 * Reserved `OPENCLAW_*` runtime keys are omitted from reads, rejected on
 * writes and preserved verbatim by the write script.
 */

/** Loads the instance and runs the shared auth/readiness checks. */
async function loadInstance(id: string) {
  const ctx = await getSessionContext(await headers());
  if (!ctx) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const [inst] = await db.select().from(instance).where(eq(instance.id, id));

  if (!inst || !canAccessInstance(ctx, inst)) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  if (!inst.providerServerIp || !inst.sshPrivateKey) {
    return {
      error: NextResponse.json(
        { error: "Instance not ready for SSH" },
        { status: 400 },
      ),
    };
  }

  return {
    inst: {
      ...inst,
      providerServerIp: inst.providerServerIp,
      sshPrivateKey: inst.sshPrivateKey,
    },
  };
}

/**
 * GET /api/instances/[id]/env
 *
 * Response: { vars: EnvVar[], skippedLines: number }
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const loaded = await loadInstance(id);
  if ("error" in loaded) return loaded.error;

  try {
    const result = await readEnvVars(
      loaded.inst.providerServerIp,
      loaded.inst.sshPrivateKey,
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error(`[env] read failed for instance ${id}:`, error);
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

/** Structural check only; semantic rules live in `validateEnvVars`. */
function parseBody(body: unknown): EnvVar[] | null {
  if (!body || typeof body !== "object") return null;
  const { vars } = body as { vars?: unknown };
  if (!Array.isArray(vars) || vars.length > 1000) return null;
  const out: EnvVar[] = [];
  for (const item of vars) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof (item as EnvVar).key !== "string" ||
      typeof (item as EnvVar).value !== "string"
    ) {
      return null;
    }
    out.push({ key: (item as EnvVar).key, value: (item as EnvVar).value });
  }
  return out;
}

/**
 * PUT /api/instances/[id]/env
 *
 * Replaces the whole env file, then restarts the gateway so OpenClaw picks
 * the new values up. Last writer wins.
 *
 * Body: { vars: EnvVar[] }
 * Response: { success: true, vars, health, healthReason }
 * 400 `invalid_env` carries `issues` for the panel to show inline.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let vars: EnvVar[] | null = null;
  try {
    vars = parseBody(await request.json());
  } catch {
    vars = null;
  }
  if (!vars) {
    const { status, body } = toErrorResponse(
      new InvalidInputError("invalid_env", "Body must be { vars: [{ key, value }] }"),
    );
    return NextResponse.json(body, { status });
  }

  const issues = validateEnvVars(vars);
  if (issues.length > 0) {
    const { status, body } = toErrorResponse(
      new InvalidInputError("invalid_env", "Invalid environment variables", issues),
    );
    return NextResponse.json(body, { status });
  }

  const loaded = await loadInstance(id);
  if ("error" in loaded) return loaded.error;
  const { providerServerIp, sshPrivateKey } = loaded.inst;

  try {
    await writeEnvVars(providerServerIp, sshPrivateKey, vars);

    const restart = await restartGateway(providerServerIp, sshPrivateKey);
    const { health, reason } = computeHealth({
      hetznerStatus: "running",
      probe: restart.probe,
    });

    return NextResponse.json({
      success: true,
      vars,
      health,
      healthReason: reason,
    });
  } catch (error) {
    // Never log the body — it holds secrets. The error carries only exit
    // codes and a stderr tail.
    console.error(`[env] write failed for instance ${id}:`, error);
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
