// Shared AI provider, model, and channel configuration.
// Pure data — no React/JSX — safe for both server and client code.

export type ProviderId =
  | "anthropic"
  | "openai"
  | "zai"
  | "mistral"
  | "minimax"
  | "openrouter"
  | "opencode";

export type ChannelId = "telegram" | "discord" | "whatsapp" | "slack";

export interface ProviderDef {
  id: ProviderId;
  name: string;
  /** Prefixes used to detect this provider from a model ID string */
  modelPrefixes: string[];
  /** cloud-init auth choice key */
  authChoice: string;
  /** cloud-init API key flag */
  apiKeyFlag: string;
  badge?: string;
}

export interface ModelDef {
  id: string;
  name: string;
  providerId: ProviderId;
  badge?: string;
}

export interface ChannelDef {
  id: ChannelId;
  name: string;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    modelPrefixes: ["claude"],
    authChoice: "apiKey",
    apiKeyFlag: "--anthropic-api-key",
  },
  {
    id: "openai",
    name: "OpenAI",
    modelPrefixes: ["gpt-", "o1-", "o3-"],
    authChoice: "openai-api-key",
    apiKeyFlag: "--openai-api-key",
  },
  {
    id: "zai",
    name: "Z.AI",
    modelPrefixes: ["glm-"],
    authChoice: "zai-api-key",
    apiKeyFlag: "--zai-api-key",
  },
  {
    id: "mistral",
    name: "Mistral",
    modelPrefixes: ["mistral"],
    authChoice: "mistral-api-key",
    apiKeyFlag: "--mistral-api-key",
  },
  {
    id: "minimax",
    name: "MiniMax",
    modelPrefixes: ["MiniMax", "minimax"],
    authChoice: "minimax-api",
    apiKeyFlag: "--minimax-api-key",
    badge: "recommended",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    modelPrefixes: ["openrouter/"],
    authChoice: "openrouter-api-key",
    apiKeyFlag: "--openrouter-api-key",
  },
  {
    id: "opencode",
    name: "OpenCode Zen",
    modelPrefixes: ["opencode/"],
    authChoice: "opencode-zen",
    apiKeyFlag: "--opencode-zen-api-key",
  },
];

export const MODELS: ModelDef[] = [
  { id: "claude-opus-4-6", name: "Claude Opus 4.6", providerId: "anthropic" },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    providerId: "anthropic",
  },
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    providerId: "anthropic",
  },
  { id: "gpt-5.2", name: "GPT-5.2", providerId: "openai" },
  { id: "gpt-5.1-codex", name: "GPT-5.1 Codex", providerId: "openai" },
  {
    id: "gpt-5.1-codex-mini",
    name: "GPT-5.1 Codex-Mini",
    providerId: "openai",
  },
  { id: "gpt-5-mini", name: "GPT-5 Mini", providerId: "openai" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", providerId: "openai" },
  {
    id: "mistral-large-latest",
    name: "Mistral Large",
    providerId: "mistral",
  },
  { id: "glm-4.7", name: "GLM 4.7", providerId: "zai" },
  { id: "glm-5", name: "GLM 5", providerId: "zai", badge: "Requires Pro+" },
  { id: "MiniMax-M2.1", name: "MiniMax M2.1", providerId: "minimax" },
];

export const CHANNELS: ChannelDef[] = [
  { id: "telegram", name: "Telegram" },
  { id: "discord", name: "Discord" },
  { id: "whatsapp", name: "WhatsApp" },
  { id: "slack", name: "Slack" },
];

/** Get models for a specific provider */
export function getModelsByProvider(providerId: ProviderId): ModelDef[] {
  return MODELS.filter((m) => m.providerId === providerId);
}

/** Get a provider definition by ID */
export function getProvider(id: ProviderId): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/** Detect provider from a model ID string using prefix matching */
export function detectProviderByModelId(
  modelId: string,
): ProviderDef | undefined {
  return PROVIDERS.find((p) =>
    p.modelPrefixes.some((prefix) => modelId.startsWith(prefix)),
  );
}
