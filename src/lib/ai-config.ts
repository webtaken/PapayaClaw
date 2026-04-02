// Shared AI provider, model, and channel configuration.
// Pure data — no React/JSX — safe for both server and client code.

export type ProviderId =
  // Phase 1 — Simple API key
  | "anthropic"
  | "openai"
  | "zai"
  | "mistral"
  | "minimax"
  | "openrouter"
  | "opencode"
  | "deepseek"
  | "huggingface"
  | "kilocode"
  | "moonshot"
  | "synthetic"
  | "together"
  | "venice"
  | "xai"
  | "xiaomi"
  | "volcengine"
  | "qianfan"
  | "opencode-go"
  | "litellm"
  | "groq"
  | "nvidia"
  | "gemini"
  | "vercel-ai"
  // Phase 2 — Complex (multi-field config)
  | "bedrock"
  | "cloudflare"
  | "qwen"
  // Phase 3 — Local model servers
  | "ollama"
  | "vllm"
  | "sglang"
  // CLI-auth (configure post-deployment)
  | "copilot"
  | "claude-cli"
  | "codex-cli"
  | "gemini-cli";

export type ChannelId = "telegram" | "discord" | "whatsapp" | "slack";

export type ProviderSetup = "simple" | "complex" | "local" | "cli-auth";

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
  /** Provider onboarding complexity */
  setup: ProviderSetup;
  /** Human-readable note shown in UI when not "simple" */
  setupNote?: string;
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

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export const PROVIDERS: ProviderDef[] = [
  // ── Phase 1 — Simple API key ───────────────────────────────────────────
  {
    id: "anthropic",
    name: "Anthropic",
    modelPrefixes: ["claude"],
    authChoice: "apiKey",
    apiKeyFlag: "--anthropic-api-key",
    setup: "simple",
  },
  {
    id: "openai",
    name: "OpenAI",
    modelPrefixes: ["gpt-", "o1-", "o3-"],
    authChoice: "openai-api-key",
    apiKeyFlag: "--openai-api-key",
    setup: "simple",
  },
  {
    id: "zai",
    name: "Z.AI",
    modelPrefixes: ["glm-"],
    authChoice: "zai-api-key",
    apiKeyFlag: "--zai-api-key",
    setup: "simple",
  },
  {
    id: "mistral",
    name: "Mistral",
    modelPrefixes: ["mistral"],
    authChoice: "mistral-api-key",
    apiKeyFlag: "--mistral-api-key",
    setup: "simple",
  },
  {
    id: "minimax",
    name: "MiniMax",
    modelPrefixes: ["MiniMax", "minimax"],
    authChoice: "minimax-api",
    apiKeyFlag: "--minimax-api-key",
    badge: "recommended",
    setup: "simple",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    modelPrefixes: ["openrouter/"],
    authChoice: "openrouter-api-key",
    apiKeyFlag: "--openrouter-api-key",
    setup: "simple",
  },
  {
    id: "opencode",
    name: "OpenCode Zen",
    modelPrefixes: ["opencode/"],
    authChoice: "opencode-zen",
    apiKeyFlag: "--opencode-zen-api-key",
    setup: "simple",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    modelPrefixes: ["deepseek-"],
    authChoice: "deepseek-api-key",
    apiKeyFlag: "--deepseek-api-key",
    setup: "simple",
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    modelPrefixes: ["huggingface/"],
    authChoice: "huggingface-api-key",
    apiKeyFlag: "--huggingface-api-key",
    setup: "simple",
  },
  {
    id: "kilocode",
    name: "Kilocode",
    modelPrefixes: ["kilocode/"],
    authChoice: "kilocode-api-key",
    apiKeyFlag: "--kilocode-api-key",
    setup: "simple",
  },
  {
    id: "moonshot",
    name: "Moonshot AI",
    modelPrefixes: ["moonshot-", "kimi-"],
    authChoice: "moonshot-api-key",
    apiKeyFlag: "--moonshot-api-key",
    setup: "simple",
  },
  {
    id: "synthetic",
    name: "Synthetic",
    modelPrefixes: ["synthetic/"],
    authChoice: "synthetic-api-key",
    apiKeyFlag: "--synthetic-api-key",
    setup: "simple",
  },
  {
    id: "together",
    name: "Together AI",
    modelPrefixes: ["together/"],
    authChoice: "together-api-key",
    apiKeyFlag: "--together-api-key",
    setup: "simple",
  },
  {
    id: "venice",
    name: "Venice",
    modelPrefixes: ["venice/"],
    authChoice: "venice-api-key",
    apiKeyFlag: "--venice-api-key",
    setup: "simple",
  },
  {
    id: "xai",
    name: "xAI",
    modelPrefixes: ["grok-"],
    authChoice: "xai-api-key",
    apiKeyFlag: "--xai-api-key",
    setup: "simple",
  },
  {
    id: "xiaomi",
    name: "Xiaomi",
    modelPrefixes: ["xiaomi/", "mimo-"],
    authChoice: "xiaomi-api-key",
    apiKeyFlag: "--xiaomi-api-key",
    setup: "simple",
  },
  {
    id: "volcengine",
    name: "Volcengine (Doubao)",
    modelPrefixes: ["doubao-", "ark-"],
    authChoice: "volcengine-api-key",
    apiKeyFlag: "--volcengine-api-key",
    setup: "simple",
  },
  {
    id: "qianfan",
    name: "Qianfan",
    modelPrefixes: ["qianfan/"],
    authChoice: "qianfan-api-key",
    apiKeyFlag: "--qianfan-api-key",
    setup: "simple",
  },
  {
    id: "opencode-go",
    name: "OpenCode Go",
    modelPrefixes: ["opencode-go/"],
    authChoice: "opencode-go",
    apiKeyFlag: "--opencode-go-api-key",
    setup: "simple",
  },
  {
    id: "litellm",
    name: "LiteLLM",
    modelPrefixes: ["litellm/"],
    authChoice: "litellm-api-key",
    apiKeyFlag: "--litellm-api-key",
    setup: "simple",
  },
  {
    // Groq has its own native provider in OpenClaw with GROQ_API_KEY env var.
    // Auth uses --auth-choice skip + env var set on the VPS.
    id: "groq",
    name: "Groq",
    modelPrefixes: ["groq/"],
    authChoice: "skip",
    apiKeyFlag: "",
    badge: "LPU inference",
    setup: "simple",
  },
  {
    // NVIDIA has its own native provider in OpenClaw with NVIDIA_API_KEY env var.
    // Auth uses --auth-choice skip + env var set on the VPS.
    id: "nvidia",
    name: "NVIDIA",
    modelPrefixes: ["nvidia/"],
    authChoice: "skip",
    apiKeyFlag: "",
    setup: "simple",
  },
  {
    // Gemini API key is simple: --auth-choice google-api-key --gemini-api-key <key>
    id: "gemini",
    name: "Google Gemini",
    modelPrefixes: ["gemini-"],
    authChoice: "google-api-key",
    apiKeyFlag: "--gemini-api-key",
    setup: "simple",
  },
  {
    // Vercel AI Gateway is simple: --auth-choice ai-gateway-api-key --ai-gateway-api-key <key>
    id: "vercel-ai",
    name: "Vercel AI Gateway",
    modelPrefixes: ["vercel-ai/"],
    authChoice: "ai-gateway-api-key",
    apiKeyFlag: "--ai-gateway-api-key",
    setup: "simple",
  },

  // ── Phase 2 — Complex (multi-field config) ─────────────────────────────
  {
    id: "bedrock",
    name: "Amazon Bedrock",
    modelPrefixes: ["bedrock/"],
    authChoice: "custom-api-key",
    apiKeyFlag: "--custom-api-key",
    setup: "complex",
    setupNote: "Requires AWS credentials (Access Key, Secret Key, Region)",
  },
  {
    // Cloudflare AI Gateway needs 3 fields: account-id, gateway-id, api-key
    id: "cloudflare",
    name: "Cloudflare AI Gateway",
    modelPrefixes: ["cloudflare-ai-gateway/"],
    authChoice: "cloudflare-ai-gateway-api-key",
    apiKeyFlag: "--cloudflare-ai-gateway-api-key",
    setup: "complex",
    setupNote: "Requires Account ID, Gateway ID, and API key",
  },
  {
    // Qwen / Model Studio has 4 regional variants (standard/coding x global/cn)
    id: "qwen",
    name: "Qwen / Model Studio",
    modelPrefixes: ["modelstudio/", "qwen"],
    authChoice: "modelstudio-api-key",
    apiKeyFlag: "--modelstudio-api-key",
    setup: "complex",
    setupNote: "Multiple regional variants (Global/China, Standard/Coding)",
  },

  // ── Phase 3 — Local model servers ──────────────────────────────────────
  {
    id: "ollama",
    name: "Ollama",
    modelPrefixes: ["ollama/"],
    authChoice: "ollama",
    apiKeyFlag: "",
    setup: "local",
    setupNote: "Requires local Ollama server",
  },
  {
    id: "vllm",
    name: "vLLM",
    modelPrefixes: ["vllm/"],
    authChoice: "vllm",
    apiKeyFlag: "",
    setup: "local",
    setupNote: "Requires local vLLM server",
  },
  {
    id: "sglang",
    name: "SGLang",
    modelPrefixes: ["sglang/"],
    authChoice: "sglang",
    apiKeyFlag: "",
    setup: "local",
    setupNote: "Requires local SGLang server",
  },

  // ── CLI-auth (configure post-deployment via SSH) ───────────────────────
  {
    id: "copilot",
    name: "GitHub Copilot",
    modelPrefixes: ["github-copilot/"],
    authChoice: "github-copilot",
    apiKeyFlag: "",
    setup: "cli-auth",
    setupNote: "Configure via SSH after deployment",
  },
  {
    id: "claude-cli",
    name: "Claude Code CLI",
    modelPrefixes: ["claude-cli/"],
    authChoice: "claude-cli",
    apiKeyFlag: "",
    setup: "cli-auth",
    setupNote: "Configure via SSH after deployment",
  },
  {
    id: "codex-cli",
    name: "OpenAI Codex CLI",
    modelPrefixes: ["openai-codex/"],
    authChoice: "codex-cli",
    apiKeyFlag: "",
    setup: "cli-auth",
    setupNote: "Configure via SSH after deployment",
  },
  {
    id: "gemini-cli",
    name: "Google Gemini CLI",
    modelPrefixes: ["google-gemini-cli/"],
    authChoice: "google-gemini-cli",
    apiKeyFlag: "",
    setup: "cli-auth",
    setupNote: "Configure via SSH after deployment",
  },
];

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

export const MODELS: ModelDef[] = [
  // Anthropic
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

  // OpenAI
  { id: "gpt-5.4", name: "GPT-5.4", providerId: "openai" },
  { id: "gpt-5.4-pro", name: "GPT-5.4 Pro", providerId: "openai" },
  { id: "gpt-5.2", name: "GPT-5.2", providerId: "openai" },
  { id: "gpt-5.1-codex", name: "GPT-5.1 Codex", providerId: "openai" },
  {
    id: "gpt-5.1-codex-mini",
    name: "GPT-5.1 Codex-Mini",
    providerId: "openai",
  },
  { id: "gpt-5-mini", name: "GPT-5 Mini", providerId: "openai" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", providerId: "openai" },

  // Mistral
  {
    id: "mistral-large-latest",
    name: "Mistral Large",
    providerId: "mistral",
  },

  // Z.AI (GLM)
  { id: "glm-5.1", name: "GLM 5.1", providerId: "zai" },
  { id: "glm-5", name: "GLM 5", providerId: "zai" },
  { id: "glm-5-turbo", name: "GLM 5 Turbo", providerId: "zai" },
  { id: "glm-4.7", name: "GLM 4.7", providerId: "zai" },
  { id: "glm-4.6", name: "GLM 4.6", providerId: "zai" },

  // MiniMax
  {
    id: "MiniMax-M2.7",
    name: "MiniMax M2.7",
    providerId: "minimax",
  },
  {
    id: "MiniMax-M2.7-highspeed",
    name: "MiniMax M2.7 Highspeed",
    providerId: "minimax",
  },

  // DeepSeek
  {
    id: "deepseek-chat",
    name: "DeepSeek Chat (V3.2)",
    providerId: "deepseek",
  },
  {
    id: "deepseek-reasoner",
    name: "DeepSeek Reasoner (V3.2)",
    providerId: "deepseek",
  },

  // xAI (Grok)
  { id: "grok-4", name: "Grok 4", providerId: "xai" },
  {
    id: "grok-4-fast-reasoning",
    name: "Grok 4 Fast Reasoning",
    providerId: "xai",
  },
  {
    id: "grok-4-fast-non-reasoning",
    name: "Grok 4 Fast",
    providerId: "xai",
  },
  { id: "grok-code-fast-1", name: "Grok Code Fast", providerId: "xai" },

  // Moonshot AI (Kimi)
  { id: "kimi-k2.5", name: "Kimi K2.5", providerId: "moonshot" },
  {
    id: "kimi-k2-thinking",
    name: "Kimi K2 Thinking",
    providerId: "moonshot",
  },
  {
    id: "kimi-k2-0905-preview",
    name: "Kimi K2 Preview",
    providerId: "moonshot",
  },

  // Together AI (pass-through — representative models)
  {
    id: "together/moonshotai/Kimi-K2.5",
    name: "Kimi K2.5 (Together)",
    providerId: "together",
  },
  {
    id: "together/meta-llama/Llama-4-Maverick-17Bx128E-Instruct-FP8",
    name: "Llama 4 Maverick (FP8)",
    providerId: "together",
  },

  // Groq (native provider — representative models)
  {
    id: "groq/llama-3.3-70b-versatile",
    name: "Llama 3.3 70B Versatile",
    providerId: "groq",
  },
  {
    id: "groq/llama-3.1-8b-instant",
    name: "Llama 3.1 8B Instant",
    providerId: "groq",
  },
  {
    id: "groq/gemma-2-9b",
    name: "Gemma 2 9B",
    providerId: "groq",
  },

  // NVIDIA (native provider — representative models)
  {
    id: "nvidia/nvidia/llama-3.1-nemotron-70b-instruct",
    name: "Nemotron 70B Instruct",
    providerId: "nvidia",
  },

  // Google Gemini
  {
    id: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro Preview",
    providerId: "gemini",
  },

  // Vercel AI Gateway (pass-through — representative models)
  {
    id: "vercel-ai/anthropic/claude-opus-4.6",
    name: "Claude Opus 4.6 (Vercel)",
    providerId: "vercel-ai",
  },

  // Xiaomi MiMo
  {
    id: "mimo-v2-flash",
    name: "MiMo V2 Flash",
    providerId: "xiaomi",
  },
  {
    id: "mimo-v2-pro",
    name: "MiMo V2 Pro",
    providerId: "xiaomi",
    badge: "1M context",
  },
  {
    id: "mimo-v2-omni",
    name: "MiMo V2 Omni",
    providerId: "xiaomi",
    badge: "Multimodal",
  },

  // Volcengine (Doubao)
  {
    id: "doubao-seed-1-8",
    name: "Doubao Seed 1.8",
    providerId: "volcengine",
  },
  {
    id: "ark-code-latest",
    name: "Ark Code Latest",
    providerId: "volcengine",
    badge: "Coding",
  },

  // OpenCode Zen (pass-through — representative models)
  {
    id: "opencode/claude-opus-4-6",
    name: "Claude Opus 4.6 (OpenCode)",
    providerId: "opencode",
  },
  {
    id: "opencode/gpt-5.2",
    name: "GPT-5.2 (OpenCode)",
    providerId: "opencode",
  },

  // OpenCode Go (pass-through — representative models)
  {
    id: "opencode-go/kimi-k2.5",
    name: "Kimi K2.5 (Go)",
    providerId: "opencode-go",
  },
  {
    id: "opencode-go/glm-5",
    name: "GLM 5 (Go)",
    providerId: "opencode-go",
  },

  // Kilocode
  {
    id: "kilocode/kilo/auto",
    name: "Kilo Auto",
    providerId: "kilocode",
    badge: "Auto-routes",
  },

  // Venice (pass-through — representative models)
  {
    id: "venice/kimi-k2-5",
    name: "Kimi K2.5 (Venice)",
    providerId: "venice",
  },
];

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export const CHANNELS: ChannelDef[] = [
  { id: "telegram", name: "Telegram" },
  { id: "discord", name: "Discord" },
  { id: "whatsapp", name: "WhatsApp" },
  { id: "slack", name: "Slack" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Get only providers available for the deploy wizard (simple setup) */
export function getDeployableProviders(): ProviderDef[] {
  return PROVIDERS.filter((p) => p.setup === "simple");
}
