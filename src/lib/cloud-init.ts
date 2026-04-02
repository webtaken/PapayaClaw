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
 *
 * Architecture:
 *   - bootcmd: fix broken Hetzner DNS (runs before everything)
 *   - packages: install jq via cloud-init's apt module
 *   - write_files: write the bash setup script to /run/openclaw-setup.sh
 *   - runcmd: invoke the bash script (runcmd uses sh, not bash)
 */

import { detectProviderByModelId } from "./ai-config";

export interface OpenClawConfig {
  instanceId: string;
  instanceName: string;
  model: string;
  modelApiKey: string | null;
  channel: string;
  botToken: string;
  channelPhone: string | null;
  sshPublicKey: string;
  tunnelToken: string;
  tunnelHostname: string;
}

/**
 * Generates the cloud-init user_data YAML script that installs OpenClaw
 * from scratch on a fresh Ubuntu 24.04 VPS.
 *
 * Performs a full install (jq, OpenClaw CLI via install.sh), then runs
 * `openclaw onboard` to configure the system and starts the gateway.
 */
export function generateCloudInit(config: OpenClawConfig): string {
  const key = config.modelApiKey || "YOUR_API_KEY";
  let primaryModel = config.model;
  let customModelsJson = "";

  const detected = detectProviderByModelId(config.model);
  const authChoice = detected?.authChoice ?? "openai-api-key";
  const apiKeyFlag = detected?.apiKeyFlag ?? "--openai-api-key";

  if (detected) {
    // openrouter/ and opencode/ models already include the provider prefix
    if (detected.id !== "openrouter" && detected.id !== "opencode") {
      primaryModel = `${detected.id}/${config.model}`;
    }

    // MiniMax requires a custom models block per OpenClaw docs:
    // https://docs.openclaw.ai/providers/minimax
    if (detected.id === "minimax") {
      customModelsJson = JSON.stringify({
        mode: "merge",
        providers: {
          minimax: {
            baseUrl: "https://api.minimax.io/anthropic",
            apiKey: "${MINIMAX_API_KEY}",
            api: "anthropic-messages",
            models: [
              {
                id: "MiniMax-M2.7",
                name: "MiniMax M2.7",
                reasoning: true,
                input: ["text"],
                cost: { input: 0.3, output: 1.2, cacheRead: 0, cacheWrite: 0 },
                contextWindow: 200000,
                maxTokens: 8192,
              },
              {
                id: "MiniMax-M2.7-highspeed",
                name: "MiniMax M2.7 Highspeed",
                reasoning: true,
                input: ["text"],
                cost: { input: 0.3, output: 1.2, cacheRead: 0, cacheWrite: 0 },
                contextWindow: 200000,
                maxTokens: 8192,
              },
            ],
          },
        },
      });
    }
  } else {
    // Fallback: assume OpenAI-compatible
    if (!primaryModel.includes("/")) {
      primaryModel = `openai/${config.model.replace("openai/", "")}`;
    }
  }

  const customModelsB64 = customModelsJson
    ? Buffer.from(customModelsJson).toString("base64")
    : "";
  const botTokenB64 = Buffer.from(config.botToken).toString("base64");
  const channelPhoneB64 = config.channelPhone
    ? Buffer.from(config.channelPhone).toString("base64")
    : "";
  const instanceNameB64 = Buffer.from(config.instanceName).toString("base64");

  // Build the bash setup script content.
  // This will be written to /run/openclaw-setup.sh via write_files,
  // then invoked from runcmd. This avoids sh vs bash issues.
  const setupScript = `#!/bin/bash
set -euxo pipefail
exec > /var/log/openclaw-setup.log 2>&1
export HOME=/root

# On any error, write sentinel error file
trap 'echo $? > /var/tmp/openclaw-error' ERR

# 0) Sanity-check: wait for DNS (should already work thanks to bootcmd)
for i in $(seq 1 12); do
  if getent hosts openclaw.ai > /dev/null 2>&1; then
    break
  fi
  echo "Waiting for DNS resolution... attempt $i/12"
  sleep 5
done

# Install OpenClaw CLI
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard

# Export DBUS and systemd vars to guarantee daemon installation hooks flawlessly
export XDG_RUNTIME_DIR=/run/user/0
export DBUS_SESSION_BUS_ADDRESS=unix:path=$XDG_RUNTIME_DIR/bus

# Pre-emptively enable linger for root so systemd user instances stay active
loginctl enable-linger root || true

# Create workspace so openclaw knows where to put it
mkdir -p /root/.openclaw/workspace

export PATH=/root/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH

# 1) Run the official OpenClaw CLI to bootstrap the gateway and systemd daemon
openclaw onboard --non-interactive --mode local --auth-choice "${authChoice}" ${apiKeyFlag} "${key}" --gateway-port 18789 --gateway-bind loopback --gateway-auth token --gateway-token "${config.botToken}" --install-daemon --daemon-runtime node --skip-skills --accept-risk

# 2) Patch the generated config with jq (Telegram channel, model, UI, session)
export BOT_TOKEN_B64="${botTokenB64}"
export CHANNEL_PHONE_B64="${channelPhoneB64}"
export INSTANCE_NAME_B64="${instanceNameB64}"
export CUSTOM_MODELS_B64="${customModelsB64}"
export MODEL_ID="${primaryModel}"
export CHANNEL="${config.channel}"

BOT_TOKEN=$(echo "$BOT_TOKEN_B64" | base64 -d)
INSTANCE_NAME=$(echo "$INSTANCE_NAME_B64" | base64 -d)

# 2a) Patch channel config (Telegram or WhatsApp)
if [ "$CHANNEL" = "telegram" ]; then
  jq --arg token "$BOT_TOKEN" '.channels.telegram = { enabled: true, botToken: $token, dmPolicy: "pairing", groups: { "*": { requireMention: true } } }' /root/.openclaw/openclaw.json > /run/oc.json && mv /run/oc.json /root/.openclaw/openclaw.json
elif [ "$CHANNEL" = "whatsapp" ]; then
  CHANNEL_PHONE=$(echo "$CHANNEL_PHONE_B64" | base64 -d)
  jq --arg phone "$CHANNEL_PHONE" '.channels.whatsapp = { dmPolicy: "allowlist", allowFrom: [$phone] }' /root/.openclaw/openclaw.json > /run/oc.json && mv /run/oc.json /root/.openclaw/openclaw.json
fi

# 2b) Patch model, UI, session, cron, browser, and Control UI for remote access
jq --arg model "$MODEL_ID" --arg name "$INSTANCE_NAME" --arg origin "https://${config.tunnelHostname}" '.agents.defaults.model.primary = $model | .ui.assistant.name = $name | .ui.seamColor = "#FF4500" | .session.dmScope = "per-channel-peer" | .session.threadBindings.enabled = true | .session.reset.mode = "daily" | .cron.enabled = true | .browser = { enabled: true, evaluateEnabled: true } | .gateway.controlUi.enabled = true | .gateway.controlUi.dangerouslyDisableDeviceAuth = true | .gateway.controlUi.allowedOrigins = [$origin]' /root/.openclaw/openclaw.json > /run/oc.json && mv /run/oc.json /root/.openclaw/openclaw.json

# 2c) Patch MiniMax custom models (only if CUSTOM_MODELS_B64 is set)
if [ -n "$CUSTOM_MODELS_B64" ]; then
  echo "$CUSTOM_MODELS_B64" | base64 -d > /run/custom_models.json
  jq -s '.[0] * { models: .[1] }' /root/.openclaw/openclaw.json /run/custom_models.json > /run/oc.json && mv /run/oc.json /root/.openclaw/openclaw.json
  rm /run/custom_models.json
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

# 5) Install cloudflared and set up Cloudflare Tunnel
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared noble main' | tee /etc/apt/sources.list.d/cloudflared.list
apt-get update && apt-get install -y cloudflared

# Install cloudflared as a systemd service with the tunnel token
cloudflared service install ${config.tunnelToken}

# 6) Install WhatsApp plugin if needed
if [ "$CHANNEL" = "whatsapp" ]; then
  openclaw plugins install @openclaw/whatsapp || true
fi

# 7) Write sentinel file — PapayaClaw detects this via SSH polling
trap - ERR
touch /var/tmp/openclaw-ready
echo "=== OpenClaw setup complete ==="`;

  // Indent the script content for YAML write_files block (6 spaces)
  const indentedScript = setupScript
    .split("\n")
    .map((line) => `      ${line}`)
    .join("\n");

  return `#cloud-config
package_update: true
package_upgrade: false

# Fix DNS: Hetzner's DNS servers (185.12.64.x) fail to resolve on Ubuntu 24.04 minimal.
# bootcmd runs before package_update/packages, so DNS is ready for apt.
bootcmd:
  - mkdir -p /etc/systemd/resolved.conf.d
  - printf '[Resolve]\\nDNS=1.1.1.1 8.8.8.8\\nFallbackDNS=1.0.0.1 8.8.4.4\\n' > /etc/systemd/resolved.conf.d/dns.conf
  - systemctl restart systemd-resolved

packages:
  - jq

# Write the setup script as a real file so it runs with bash.
# runcmd string items are interpreted by sh (not bash), so pipefail
# and single-quoted jq filters would break there.
write_files:
  - path: /run/openclaw-setup.sh
    permissions: '0755'
    content: |
${indentedScript}

runcmd:
  - bash /run/openclaw-setup.sh
`;
}
