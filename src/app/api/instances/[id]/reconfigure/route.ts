import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { executeCommand, restartGateway } from "@/lib/ssh";
import { computeHealth } from "@/lib/gateway-health";
import { buildReconfigureScript, RECONFIGURE_EXIT } from "@/lib/reconfigure-script";
import { ConfigInvalidError, toErrorResponse, stderrTail } from "@/lib/api-errors";
import { CliError } from "@/lib/ssh-errors";
import { detectProviderByModelId } from "@/lib/ai-config";
import { validateModelRef } from "@/lib/model-ref";
import { INSTANCE_INPUT_MESSAGES } from "@/lib/instance-input";
import { getSessionContext, canAccessInstance } from "@/lib/auth-context";

/**
 * POST /api/instances/[id]/reconfigure
 *
 * Reconfigures the AI model/provider on a running OpenClaw VPS instance.
 *
 * Runs one SSH command that: validates the existing config, backs it up,
 * runs `openclaw onboard` with the new auth, jq-patches the primary model,
 * then validates again — restoring the backup on any failure in between.
 * A pre- or post-patch validation failure maps to 409 `config_invalid`;
 * any other non-zero exit maps to 500 `cli_error`. On success, restarts the
 * gateway and probes health (see `restartGateway`) before persisting the
 * new model/key to the database.
 *
 * Body: { model: string, modelApiKey: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getSessionContext(await headers());

  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { model: rawModel, modelApiKey } = body;

  if (!rawModel || typeof rawModel !== "string") {
    return NextResponse.json(
      { error: "Model ID is required" },
      { status: 400 },
    );
  }

  const modelCheck = validateModelRef(rawModel);
  if (!modelCheck.ok) {
    return NextResponse.json(
      {
        error:
          INSTANCE_INPUT_MESSAGES[
            modelCheck.reason === "api-key"
              ? "invalidModelApiKey"
              : "invalidModelFormat"
          ],
      },
      { status: 400 },
    );
  }
  const model = modelCheck.model;

  if (!modelApiKey || typeof modelApiKey !== "string") {
    return NextResponse.json(
      { error: "API key is required" },
      { status: 400 },
    );
  }

  if (/[\x00-\x1f\x7f]/.test(modelApiKey)) {
    return NextResponse.json(
      { error: "API key contains invalid characters" },
      { status: 400 },
    );
  }

  const [inst] = await db
    .select()
    .from(instance)
    .where(eq(instance.id, id));

  if (!inst || !canAccessInstance(ctx, inst)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!inst.providerServerIp || !inst.sshPrivateKey) {
    return NextResponse.json(
      { error: "Instance is not ready for reconfiguration" },
      { status: 400 },
    );
  }

  const provider = detectProviderByModelId(model);
  if (!provider) {
    return NextResponse.json(
      { error: "Could not detect provider from model ID" },
      { status: 400 },
    );
  }

  if (provider.authChoice !== "skip" && !provider.apiKeyFlag) {
    return NextResponse.json(
      { error: "This provider cannot be reconfigured from the dashboard" },
      { status: 400 },
    );
  }

  // Build the primary model ID with provider prefix (as OpenClaw expects)
  let primaryModel = model;
  if (
    provider.id !== "openrouter" &&
    provider.id !== "opencode" &&
    provider.id !== "opencode-go" &&
    !model.includes("/")
  ) {
    primaryModel = `${provider.id}/${model}`;
  }

  try {
    // buildReconfigureScript can throw (e.g. an unsafe derived env var name);
    // keep it inside the try so that goes through toErrorResponse too.
    const script = buildReconfigureScript({
      provider: {
        id: provider.id,
        authChoice: provider.authChoice,
        apiKeyFlag: provider.apiKeyFlag,
      },
      primaryModel,
      apiKey: modelApiKey,
    });

    // Step 1: validate → backup → onboard → patch → validate (one ssh call).
    const result = await executeCommand(
      inst.providerServerIp,
      inst.sshPrivateKey,
      script,
    );

    if (
      result.code === RECONFIGURE_EXIT.configInvalidBefore ||
      result.code === RECONFIGURE_EXIT.configInvalidAfter
    ) {
      const stage =
        result.code === RECONFIGURE_EXIT.configInvalidBefore
          ? "before changes (nothing was modified)"
          : "after applying changes (restored previous config)";
      throw new ConfigInvalidError(
        `${stage}: ${stderrTail(result.stderr) || stderrTail(result.stdout)}`,
      );
    }
    if (result.code !== 0) {
      throw new CliError(`reconfigure script exited ${result.code}`, result);
    }

    // Step 2: restart the gateway and probe health (F4 helper).
    const restart = await restartGateway(
      inst.providerServerIp,
      inst.sshPrivateKey,
    );
    const { health, reason } = computeHealth({
      hetznerStatus: "running",
      probe: restart.probe,
    });

    // Step 3: persist only after the VPS accepted the config.
    await db
      .update(instance)
      .set({ model, modelApiKey })
      .where(eq(instance.id, id));

    return NextResponse.json({
      success: true,
      model: primaryModel,
      health,
      healthReason: reason,
    });
  } catch (error) {
    console.error(`[reconfigure] failed for instance ${id}:`, error);
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
