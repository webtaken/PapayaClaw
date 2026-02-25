/**
 * Cloud-init user data generator for OpenClaw VPS provisioning.
 *
 * Generates a cloud-init YAML script that:
 * 1. Installs OpenClaw via the official installer (includes Node 22)
 * 2. Writes the OpenClaw configuration (~/.openclaw/openclaw.json)
 * 3. Starts the Gateway as a systemd service
 * 4. Calls back to PapayaClaw to report "running" status
 *
 * Uses the official install path from https://docs.openclaw.ai/install
 * instead of Docker, cutting deploy time from ~10 min to ~2 min.
 */

export interface OpenClawConfig {
  instanceId: string;
  instanceName: string;
  model: string;
  modelApiKey: string | null;
  channel: string;
  botToken: string;
  callbackUrl: string;
  callbackSecret: string;
  sshPublicKey: string;
}

/**
 * Generates the OpenClaw JSON configuration.
 */
function generateOpenClawJson(config: OpenClawConfig): string {
  const key = config.modelApiKey || "YOUR_API_KEY";

  const modelMap: Record<
    string,
    { provider: string; model: string; envKey: string; extraModelsConfig?: any }
  > = {
    // Anthropic
    "claude-opus-4-6": {
      provider: "anthropic",
      model: "anthropic/claude-opus-4-6",
      envKey: "ANTHROPIC_API_KEY",
    },
    "claude-sonnet-4-6": {
      provider: "anthropic",
      model: "anthropic/claude-sonnet-4-6",
      envKey: "ANTHROPIC_API_KEY",
    },
    "claude-haiku-4-5": {
      provider: "anthropic",
      model: "anthropic/claude-haiku-4-5",
      envKey: "ANTHROPIC_API_KEY",
    },
    // OpenAI
    "gpt-5.2": {
      provider: "openai",
      model: "openai/gpt-5.2",
      envKey: "OPENAI_API_KEY",
    },
    "gpt-5.1-codex": {
      provider: "openai",
      model: "openai/gpt-5.1-codex",
      envKey: "OPENAI_API_KEY",
    },
    "gpt-5.1-codex-mini": {
      provider: "openai",
      model: "openai/gpt-5.1-codex-mini",
      envKey: "OPENAI_API_KEY",
    },
    "gpt-5-mini": {
      provider: "openai",
      model: "openai/gpt-5-mini",
      envKey: "OPENAI_API_KEY",
    },
    "gpt-4.1-mini": {
      provider: "openai",
      model: "openai/gpt-4.1-mini",
      envKey: "OPENAI_API_KEY",
    },
    // Z.AI
    "glm-4.7": { provider: "zai", model: "zai/glm-4.7", envKey: "ZAI_API_KEY" },
    "glm-5": { provider: "zai", model: "zai/glm-5", envKey: "ZAI_API_KEY" },
    // Mistral
    "mistral-large-latest": {
      provider: "mistral",
      model: "mistral/mistral-large-latest",
      envKey: "MISTRAL_API_KEY",
    },
    // MiniMax
    "MiniMax-M2.1": {
      provider: "minimax",
      model: "minimax/MiniMax-M2.1",
      envKey: "MINIMAX_API_KEY",
      extraModelsConfig: {
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
      },
    },
  };

  let modelInfo = modelMap[config.model];

  // Dynamic override for custom models (OpenRouter, OpenCode Zen)
  if (config.model.startsWith("openrouter/")) {
    modelInfo = {
      provider: "openrouter",
      model: config.model,
      envKey: "OPENROUTER_API_KEY",
    };
  } else if (config.model.startsWith("opencode/")) {
    modelInfo = {
      provider: "opencode",
      model: config.model,
      envKey: "OPENCODE_API_KEY",
    };
  } else if (!modelInfo) {
    // Fallback
    modelInfo = {
      provider: "openai",
      model: `openai/${config.model.replace("openai/", "")}`,
      envKey: "OPENAI_API_KEY",
    };
  }

  const jsonConfig: any = {
    env: {
      [modelInfo.envKey]: key,
    },
    agents: {
      defaults: {
        model: {
          primary: modelInfo.model,
        },
      },
    },
    gateway: {
      mode: "local",
      port: 18789,
      auth: {
        mode: "token",
        token: config.botToken, // Using bot token as gateway token for simplicity
        allowTailscale: true,
      },
      tailscale: {
        mode: "serve",
      },
    },
    ui: {
      seamColor: "#FF4500",
      assistant: {
        name: config.instanceName,
      },
    },
    session: {
      dmScope: "per-channel-peer",
      threadBindings: {
        enabled: true,
      },
      reset: {
        mode: "daily",
      },
    },
    cron: {
      enabled: true,
    },
    browser: {
      enabled: true,
      evaluateEnabled: true,
    },
    channels: {},
  };

  if (modelInfo.extraModelsConfig) {
    jsonConfig.models = modelInfo.extraModelsConfig;
  }

  if (config.channel === "telegram") {
    jsonConfig.channels.telegram = {
      enabled: true,
      botToken: config.botToken,
      dmPolicy: "pairing",
      groups: { "*": { requireMention: true } },
    };
  } else if (config.channel === "discord") {
    jsonConfig.channels.discord = {
      enabled: true,
      token: config.botToken,
      dmPolicy: "pairing",
      groups: { "*": { requireMention: true } },
    };
  } else {
    // Default fallback
    jsonConfig.channels[config.channel] = {
      enabled: true,
      botToken: config.botToken,
    };
  }

  return JSON.stringify(jsonConfig, null, 2);
}

/**
 * Generates the full cloud-init user_data YAML script.
 *
 * This script runs on first boot of the Hetzner VPS and:
 * - Installs OpenClaw via the official installer (brings Node 22 + CLI)
 * - Writes the openclaw.json config
 * - Creates a systemd service for the Gateway
 * - Sends a callback to PapayaClaw to mark the instance as "running"
 *
 * All commands run in a single shell block so that `export PATH`
 * persists across steps. Uses `set -euxo pipefail` for strict error
 * handling and logs everything to /var/log/openclaw-setup.log.
 */
export function generateCloudInit(config: OpenClawConfig): string {
  console.log("Passed config", JSON.stringify(config, null, 2));
  const openclawJson = generateOpenClawJson(config);

  const indentedJson = openclawJson
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");

  return `#cloud-config
package_update: false
package_upgrade: false

runcmd:
  - |
    #!/bin/bash
    set -euxo pipefail
    exec > /var/log/openclaw-setup.log 2>&1

    # On any error, notify PapayaClaw so the dashboard shows "error"
    error_callback() {
      curl -sf -X POST "${config.callbackUrl}" \\
        -H "Content-Type: application/json" \\
        -H "X-Callback-Secret: ${config.callbackSecret}" \\
        -d '{"instanceId": "${config.instanceId}", "status": "error"}' || true
    }
    trap error_callback ERR

    # ── Install OpenClaw (includes Node 22) ──────────────────────────
    curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard
    # Make sure we add Node's global bin to PATH, just in case
    export PATH="/root/.local/bin:$(npm prefix -g 2>/dev/null || echo '/usr/local')/bin:/usr/bin:$PATH"

    # ── Write openclaw.json ──────────────────────────────────────────
    mkdir -p /root/.openclaw/workspace
    cat > /root/.openclaw/openclaw.json << 'JSONEOF'
${indentedJson}
    JSONEOF

    # ── Systemd service ──────────────────────────────────────────────
    cat > /etc/systemd/system/openclaw-gateway.service << 'SERVICEEOF'
    [Unit]
    Description=OpenClaw Gateway
    After=network-online.target
    Wants=network-online.target

    [Service]
    Type=simple
    User=root
    Environment=PATH=/root/.local/bin:/usr/local/bin:/usr/bin:/bin
    Environment=HOME=/root
    ExecStart=/usr/bin/env openclaw gateway --port 18789
    Restart=always
    RestartSec=5

    [Install]
    WantedBy=multi-user.target
    SERVICEEOF

    systemctl daemon-reload
    systemctl enable openclaw-gateway
    systemctl start openclaw-gateway

    # ── Wait for gateway to become healthy (max 60s) ─────────────────
    for i in $(seq 1 12); do
      if curl -sf http://127.0.0.1:18789/ > /dev/null 2>&1; then
        break
      fi
      sleep 5
    done

    # ── Success callback ─────────────────────────────────────────────
    curl -sf -X POST "${config.callbackUrl}" \\
      -H "Content-Type: application/json" \\
      -H "X-Callback-Secret: ${config.callbackSecret}" \\
      -d '{"instanceId": "${config.instanceId}", "status": "running"}'
`;
}
