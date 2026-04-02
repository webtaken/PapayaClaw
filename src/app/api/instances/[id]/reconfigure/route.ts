import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { instance } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { executeCommand } from "@/lib/ssh";
import { detectProviderByModelId } from "@/lib/ai-config";

/**
 * POST /api/instances/[id]/reconfigure
 *
 * Reconfigures the AI model/provider on a running OpenClaw VPS instance.
 * Updates the database record and runs SSH commands to reconfigure OpenClaw.
 *
 * Body: { model: string, modelApiKey: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { model, modelApiKey } = body;

  if (!model || typeof model !== "string") {
    return NextResponse.json(
      { error: "Model ID is required" },
      { status: 400 },
    );
  }

  if (!modelApiKey || typeof modelApiKey !== "string") {
    return NextResponse.json(
      { error: "API key is required" },
      { status: 400 },
    );
  }

  const [inst] = await db
    .select()
    .from(instance)
    .where(and(eq(instance.id, id), eq(instance.userId, session.user.id)));

  if (!inst) {
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

  // Build the SSH reconfiguration command
  const pathExport =
    'export PATH="/root/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"';
  const skipFlags =
    "--skip-channels --skip-skills --skip-daemon --skip-ui --skip-search --skip-health";

  let reconfigureCmd: string;

  if (provider.authChoice === "skip") {
    // Env-var based providers (Groq, NVIDIA) — write env var and use --auth-choice skip
    const envVarMap: Record<string, string> = {
      groq: "GROQ_API_KEY",
      nvidia: "NVIDIA_API_KEY",
    };
    const envVar = envVarMap[provider.id] || `${provider.id.toUpperCase()}_API_KEY`;

    reconfigureCmd = [
      pathExport,
      // Write to OpenClaw's env file (overwrite if exists, append if not)
      `grep -q '^${envVar}=' /root/.openclaw/.env 2>/dev/null && sed -i 's|^${envVar}=.*|${envVar}=${modelApiKey}|' /root/.openclaw/.env || echo '${envVar}=${modelApiKey}' >> /root/.openclaw/.env`,
      // Run onboard with skip auth
      `openclaw onboard --non-interactive --accept-risk --auth-choice skip ${skipFlags}`,
    ].join(" && ");
  } else {
    // Standard API key providers
    reconfigureCmd = [
      pathExport,
      `openclaw onboard --non-interactive --accept-risk --auth-choice "${provider.authChoice}" ${provider.apiKeyFlag} "${modelApiKey}" ${skipFlags}`,
    ].join(" && ");
  }

  // Patch the model in config and restart gateway
  const patchAndRestart = [
    pathExport,
    `jq --arg model "${primaryModel}" '.agents.defaults.model.primary = $model' /root/.openclaw/openclaw.json > /run/oc.json && mv /run/oc.json /root/.openclaw/openclaw.json`,
    `pkill -f "openclaw gateway" || true`,
  ].join(" && ");

  try {
    // Step 1: Run onboard to reconfigure auth
    const onboardResult = await executeCommand(
      inst.providerServerIp,
      inst.sshPrivateKey,
      reconfigureCmd,
    );

    if (onboardResult.code !== 0) {
      console.error(
        "Reconfigure onboard failed:",
        onboardResult.stderr,
        onboardResult.stdout,
      );
      return NextResponse.json(
        {
          error: "Failed to reconfigure provider auth on VPS",
          detail: onboardResult.stderr || onboardResult.stdout,
        },
        { status: 500 },
      );
    }

    // Step 2: Patch model in config and restart gateway
    const patchResult = await executeCommand(
      inst.providerServerIp,
      inst.sshPrivateKey,
      patchAndRestart,
    );

    if (patchResult.code !== 0) {
      console.error(
        "Reconfigure patch failed:",
        patchResult.stderr,
        patchResult.stdout,
      );
      return NextResponse.json(
        {
          error: "Failed to update model config on VPS",
          detail: patchResult.stderr || patchResult.stdout,
        },
        { status: 500 },
      );
    }

    // Step 3: Update DB record
    await db
      .update(instance)
      .set({ model, modelApiKey })
      .where(and(eq(instance.id, id), eq(instance.userId, session.user.id)));

    return NextResponse.json({ success: true, model: primaryModel });
  } catch (error) {
    console.error("Reconfigure SSH error:", error);
    return NextResponse.json(
      { error: "Failed to connect to instance via SSH" },
      { status: 500 },
    );
  }
}
