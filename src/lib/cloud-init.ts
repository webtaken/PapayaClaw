/**
 * Cloud-init user data generator for OpenClaw VPS provisioning.
 *
 * Generates a cloud-init YAML script that:
 * 1. Installs jq and OpenClaw from scratch on a fresh Ubuntu 24.04 VPS
 * 2. Runs `openclaw onboard` to bootstrap the gateway + systemd daemon
 * 3. Patches the OpenClaw config via `jq` (Telegram channel, model, UI, session)
 * 4. Restarts the gateway and waits for it to come up
 * 5. Writes a sentinel file so PapayaClaw can detect readiness via SSH
 *
 * Uses the official install path from https://docs.openclaw.ai/install
 * instead of Docker.
 *
 * Status detection: PapayaClaw polls via SSH for sentinel files:
 *   /var/tmp/openclaw-ready  → setup succeeded
 *   /var/tmp/openclaw-error  → setup failed
 */

export interface OpenClawConfig {
  instanceId: string;
  instanceName: string;
  model: string;
  modelApiKey: string | null;
  channel: string;
  botToken: string;
  sshPublicKey: string;
}

/**
 * Generates the cloud-init user_data YAML script that installs OpenClaw
 * from scratch on a fresh Ubuntu 24.04 VPS.
 *
 * Performs a full install (jq, OpenClaw CLI via install.sh), then runs
 * `openclaw onboard` to configure the system and starts the gateway.
 */
export function generateCloudInit(config: OpenClawConfig): string {
  console.log("config", config);
  const key = config.modelApiKey || "YOUR_API_KEY";
  let authChoice = "openai-api-key";
  let apiKeyFlag = "--openai-api-key";
  let primaryModel = config.model;
  let customModelsJson = "";

  if (config.model.startsWith("claude")) {
    authChoice = "apiKey";
    apiKeyFlag = "--anthropic-api-key";
    primaryModel = `anthropic/${config.model}`;
  } else if (
    config.model.startsWith("gpt-") ||
    config.model.startsWith("o1-") ||
    config.model.startsWith("o3-")
  ) {
    authChoice = "openai-api-key";
    apiKeyFlag = "--openai-api-key";
    primaryModel = `openai/${config.model.replace("openai/", "")}`;
  } else if (config.model.startsWith("glm-")) {
    authChoice = "zai-api-key";
    apiKeyFlag = "--zai-api-key";
    primaryModel = `zai/${config.model}`;
  } else if (config.model.startsWith("mistral")) {
    authChoice = "mistral-api-key";
    apiKeyFlag = "--mistral-api-key";
    primaryModel = `mistral/${config.model}`;
  } else if (
    config.model.startsWith("MiniMax") ||
    config.model.startsWith("minimax")
  ) {
    authChoice = "minimax-api";
    apiKeyFlag = "--minimax-api-key";
    primaryModel = `minimax/${config.model}`;
    // MiniMax requires a custom models block per OpenClaw docs:
    // https://docs.openclaw.ai/providers/minimax
    customModelsJson = JSON.stringify({
      mode: "merge",
      providers: {
        minimax: {
          baseUrl: "https://api.minimax.io/anthropic",
          apiKey: "${MINIMAX_API_KEY}",
          api: "anthropic-messages",
          models: [
            {
              id: "MiniMax-M2.1",
              name: "MiniMax M2.1",
              reasoning: false,
              input: ["text"],
              cost: { input: 15, output: 60, cacheRead: 2, cacheWrite: 10 },
              contextWindow: 200000,
              maxTokens: 8192,
            },
          ],
        },
      },
    });
  } else if (config.model.startsWith("openrouter/")) {
    authChoice = "openrouter-api-key";
    apiKeyFlag = "--openrouter-api-key";
  } else if (config.model.startsWith("opencode/")) {
    authChoice = "opencode-zen";
    apiKeyFlag = "--opencode-zen-api-key";
  } else {
    // Fallback
    authChoice = "openai-api-key";
    apiKeyFlag = "--openai-api-key";
    if (!primaryModel.includes("/")) {
      primaryModel = `openai/${config.model.replace("openai/", "")}`;
    }
  }

  const customModelsB64 = customModelsJson
    ? Buffer.from(customModelsJson).toString("base64")
    : "";
  const botTokenB64 = Buffer.from(config.botToken).toString("base64");
  const instanceNameB64 = Buffer.from(config.instanceName).toString("base64");

  return `#cloud-config
package_update: true
package_upgrade: false

runcmd:
  - |
    bash -c '
    set -euxo pipefail
    exec > /var/log/openclaw-setup.log 2>&1
    export HOME=/root

    # On any error, write sentinel error file
    trap "echo \\\\$? > /var/tmp/openclaw-error" ERR

    # 0) Install dependencies from scratch
    apt-get install -y jq
    curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard

    # Export DBUS and systemd vars to guarantee daemon installation hooks flawlessly
    export XDG_RUNTIME_DIR=/run/user/0
    export DBUS_SESSION_BUS_ADDRESS=unix:path=${"$"}{XDG_RUNTIME_DIR}/bus
    
    # Pre-emptively enable linger for root so systemd user instances stay active
    loginctl enable-linger root || true

    # Create workspace so openclaw knows where to put it
    mkdir -p /root/.openclaw/workspace

    export PATH=/root/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH

    # 1) Run the official OpenClaw CLI to bootstrap the gateway and systemd daemon
    openclaw onboard --non-interactive --mode local --auth-choice "${authChoice}" ${apiKeyFlag} "${key}" --gateway-port 18789 --gateway-bind loopback --gateway-auth token --gateway-token "${config.botToken}" --tailscale serve --install-daemon --daemon-runtime node --skip-skills --accept-risk

    # 2) Patch the generated config with jq (Telegram channel, model, UI, session)
    export BOT_TOKEN_B64="${botTokenB64}"
    export INSTANCE_NAME_B64="${instanceNameB64}"
    export CUSTOM_MODELS_B64="${customModelsB64}"
    export MODEL_ID="${primaryModel}"

    BOT_TOKEN=$(echo "$BOT_TOKEN_B64" | base64 -d)
    INSTANCE_NAME=$(echo "$INSTANCE_NAME_B64" | base64 -d)

    # 2a) Patch Telegram channel
    jq --arg token "$BOT_TOKEN" '.channels.telegram = { enabled: true, botToken: $token, dmPolicy: "pairing", groups: { "*": { requireMention: true } } }' /root/.openclaw/openclaw.json > /tmp/oc.json && mv /tmp/oc.json /root/.openclaw/openclaw.json

    # 2b) Patch model, UI, session, cron, browser
    jq --arg model "$MODEL_ID" --arg name "$INSTANCE_NAME" '.agents.defaults.model.primary = $model | .ui.assistant.name = $name | .ui.seamColor = "#FF4500" | .session.dmScope = "per-channel-peer" | .session.threadBindings.enabled = true | .session.reset.mode = "daily" | .cron.enabled = true | .browser = { enabled: true, evaluateEnabled: true }' /root/.openclaw/openclaw.json > /tmp/oc.json && mv /tmp/oc.json /root/.openclaw/openclaw.json

    # 2c) Patch MiniMax custom models (only if CUSTOM_MODELS_B64 is set)
    if [ -n "$CUSTOM_MODELS_B64" ]; then
      echo "$CUSTOM_MODELS_B64" | base64 -d > /tmp/custom_models.json
      jq -s ".[0] * { models: .[1] }" /root/.openclaw/openclaw.json /tmp/custom_models.json > /tmp/oc.json && mv /tmp/oc.json /root/.openclaw/openclaw.json
      rm /tmp/custom_models.json
    fi

    # 3) Restart the gateway daemon by killing process, systemd Restart=always will kick in
    pkill -f "openclaw gateway" || true

    # 4) Wait for gateway up
    for i in $(seq 1 12); do
      if curl -sf http://127.0.0.1:18789/ > /dev/null 2>&1; then
        break
      fi
      sleep 5
    done

    # 5) Write sentinel file — PapayaClaw detects this via SSH polling
    trap - ERR
    touch /var/tmp/openclaw-ready
    echo "=== OpenClaw setup complete ==="
    '
`;
}
