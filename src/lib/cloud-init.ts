/**
 * Cloud-init user data generator for OpenClaw VPS provisioning.
 *
 * Generates a cloud-init YAML script that:
 * 1. Installs Docker + Docker Compose
 * 2. Creates a docker-compose.yml for OpenClaw
 * 3. Starts the OpenClaw container
 * 4. Calls back to PapayaClaw to report "running" status
 */

export interface OpenClawConfig {
  instanceId: string;
  model: string;
  modelApiKey: string | null;
  channel: string;
  botToken: string;
  callbackUrl: string;
  callbackSecret: string;
}

/**
 * Maps PapayaClaw model names to the AI provider config
 * that OpenClaw expects in its environment.
 */
function getModelEnv(model: string, apiKey: string | null): string {
  const key = apiKey || "YOUR_API_KEY";

  const modelMap: Record<string, { provider: string; model: string }> = {
    "claude-opus-4.5": {
      provider: "anthropic",
      model: "claude-opus-4-5-20250514",
    },
    "gpt-5.2": { provider: "openai", model: "gpt-5.2" },
    "gemini-3-flash": { provider: "google", model: "gemini-3.0-flash" },
  };

  const config = modelMap[model] || { provider: "openai", model };

  return [
    `AI_PROVIDER=${config.provider}`,
    `AI_MODEL=${config.model}`,
    `AI_API_KEY=${key}`,
  ].join("\n");
}

/**
 * Maps PapayaClaw channel names to OpenClaw gateway config.
 */
function getChannelEnv(channel: string, botToken: string): string {
  switch (channel) {
    case "telegram":
      return ["GATEWAY_TYPE=telegram", `TELEGRAM_BOT_TOKEN=${botToken}`].join(
        "\n",
      );
    case "discord":
      return ["GATEWAY_TYPE=discord", `DISCORD_BOT_TOKEN=${botToken}`].join(
        "\n",
      );
    default:
      return [`GATEWAY_TYPE=${channel}`, `BOT_TOKEN=${botToken}`].join("\n");
  }
}

/**
 * Generates the full cloud-init user_data YAML script.
 *
 * This script runs on first boot of the Hetzner VPS and:
 * - Installs Docker via the official convenience script
 * - Creates a docker-compose.yml for OpenClaw
 * - Starts the container
 * - Sends a callback to PapayaClaw to mark the instance as "running"
 */
export function generateCloudInit(config: OpenClawConfig): string {
  const modelEnv = getModelEnv(config.model, config.modelApiKey);
  const channelEnv = getChannelEnv(config.channel, config.botToken);

  return `#cloud-config
package_update: true
package_upgrade: false

runcmd:
  # Install Docker
  - curl -fsSL https://get.docker.com | sh

  # Create OpenClaw directory
  - mkdir -p /opt/openclaw

  # Write environment file
  - |
    cat > /opt/openclaw/.env << 'ENVEOF'
    ${modelEnv}
    ${channelEnv}
    INSTANCE_ID=${config.instanceId}
    ENVEOF

  # Write docker-compose.yml
  - |
    cat > /opt/openclaw/docker-compose.yml << 'COMPOSEEOF'
    version: "3.8"
    services:
      openclaw:
        image: openclaw/openclaw:latest
        container_name: openclaw
        restart: unless-stopped
        env_file: .env
        volumes:
          - openclaw_data:/app/data
        ports:
          - "127.0.0.1:3000:3000"
    volumes:
      openclaw_data:
    COMPOSEEOF

  # Start OpenClaw
  - cd /opt/openclaw && docker compose up -d

  # Wait for OpenClaw to be ready (max 120s)
  - |
    for i in $(seq 1 24); do
      if docker inspect openclaw --format='{{.State.Running}}' 2>/dev/null | grep -q true; then
        break
      fi
      sleep 5
    done

  # Callback to PapayaClaw to report status
  - |
    curl -X POST "${config.callbackUrl}" \\
      -H "Content-Type: application/json" \\
      -H "X-Callback-Secret: ${config.callbackSecret}" \\
      -d '{"instanceId": "${config.instanceId}", "status": "running"}'
`;
}
