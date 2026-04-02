# AI Providers & Models

PapayaClaw supports multiple AI providers out of the box. Users select a provider and model during instance deployment — the platform handles all configuration and cloud-init scripting automatically.

> Source of truth: [`src/lib/ai-config.ts`](../src/lib/ai-config.ts)

---

## Provider Setup Types

| Type | Description | Deploy Wizard |
|------|-------------|---------------|
| **Simple** | Single API key — paste and go | Selectable |
| **Complex** | Multiple fields (credentials, regions, IDs) | Coming soon |
| **Local** | Requires a local model server on the VPS | Coming soon |
| **CLI-auth** | Device auth flow — configure via SSH after deployment | Coming soon |

---

## Simple Providers (Available Now)

| Provider | ID | Auth Method | Notes | Docs |
|----------|----|-------------|-------|------|
| **Anthropic** | `anthropic` | `--anthropic-api-key` | Claude model family | [docs](providers/anthropic.md) |
| **OpenAI** | `openai` | `--openai-api-key` | GPT model family | [docs](providers/openai.md) |
| **Z.AI** | `zai` | `--zai-api-key` | GLM model family | [docs](providers/zai.md) |
| **Mistral** | `mistral` | `--mistral-api-key` | Mistral Large | [docs](providers/mistral.md) |
| **MiniMax** | `minimax` | `--minimax-api-key` | Recommended default | [docs](providers/minimax.md) |
| **OpenRouter** | `openrouter` | `--openrouter-api-key` | Proxy — any model on OpenRouter | [docs](providers/openrouter.md) |
| **OpenCode Zen** | `opencode` | `--opencode-zen-api-key` | OpenCode Zen catalog | [docs](providers/opencode.md) |
| **DeepSeek** | `deepseek` | `--deepseek-api-key` | Chat, Reasoner | [docs](providers/deepseek.md) |
| **Hugging Face** | `huggingface` | `--huggingface-api-key` | Inference API models | [docs](providers/huggingface.md) |
| **Kilocode** | `kilocode` | `--kilocode-api-key` | Auto-routing gateway | [docs](providers/kilocode.md) |
| **Moonshot AI** | `moonshot` | `--moonshot-api-key` | Kimi models | [docs](providers/moonshot.md) |
| **Synthetic** | `synthetic` | `--synthetic-api-key` | Anthropic-compatible | [docs](providers/synthetic.md) |
| **Together AI** | `together` | `--together-api-key` | Open-source model hosting | [docs](providers/together.md) |
| **Venice** | `venice` | `--venice-api-key` | Privacy-focused | [docs](providers/venice.md) |
| **xAI** | `xai` | `--xai-api-key` | Grok models | [docs](providers/xai.md) |
| **Xiaomi** | `xiaomi` | `--xiaomi-api-key` | MiMo models | [docs](providers/xiaomi.md) |
| **Volcengine (Doubao)** | `volcengine` | `--volcengine-api-key` | ByteDance Doubao models | [docs](providers/volcengine.md) |
| **Qianfan** | `qianfan` | `--qianfan-api-key` | Baidu ERNIE models | [docs](providers/qianfan.md) |
| **OpenCode Go** | `opencode-go` | `--opencode-go-api-key` | OpenCode Go catalog | [docs](providers/opencode-go.md) |
| **LiteLLM** | `litellm` | `--litellm-api-key` | Unified gateway | [docs](providers/litellm.md) |
| **Groq** | `groq` | env: `GROQ_API_KEY` | Native provider, LPU inference | [docs](providers/groq.md) |
| **NVIDIA** | `nvidia` | env: `NVIDIA_API_KEY` | Native provider, Nemotron models | [docs](providers/nvidia.md) |
| **Google Gemini** | `gemini` | `--gemini-api-key` | Gemini 3.1 Pro | [docs](providers/gemini.md) |
| **Vercel AI Gateway** | `vercel-ai` | `--ai-gateway-api-key` | Unified AI gateway | [docs](providers/vercel-ai.md) |

## Complex Providers (Coming Soon)

| Provider | ID | Setup Note | Docs |
|----------|----|-----------|------|
| **Amazon Bedrock** | `bedrock` | Requires AWS credentials (Access Key, Secret Key, Region) | [docs](providers/bedrock.md) |
| **Cloudflare AI Gateway** | `cloudflare` | Requires Account ID + Gateway ID + API key | [docs](providers/cloudflare.md) |
| **Qwen / Model Studio** | `qwen` | Multiple regional variants (Global/China, Standard/Coding) | [docs](providers/qwen.md) |

## Local Model Servers (Coming Soon)

| Provider | ID | Setup Note | Docs |
|----------|----|-----------|------|
| **Ollama** | `ollama` | Requires local Ollama server | [docs](providers/ollama.md) |
| **vLLM** | `vllm` | Requires local vLLM server + GPU | [docs](providers/vllm.md) |
| **SGLang** | `sglang` | Requires local SGLang server + GPU | [docs](providers/sglang.md) |

## CLI-Auth Providers (Post-Deployment)

These providers use device authentication flows that require browser interaction. Configure them via SSH after deploying your instance.

| Provider | ID | Auth Choice | Docs |
|----------|----|-------------|------|
| **GitHub Copilot** | `copilot` | `github-copilot` | [docs](providers/copilot.md) |
| **Claude Code CLI** | `claude-cli` | `claude-cli` | [docs](providers/claude-cli.md) |
| **OpenAI Codex CLI** | `codex-cli` | `codex-cli` | [docs](providers/codex-cli.md) |
| **Google Gemini CLI** | `gemini-cli` | `google-gemini-cli` | [docs](providers/gemini-cli.md) |

---

## Models

### Anthropic

| Model ID | Display Name |
|----------|-------------|
| `claude-opus-4-6` | Claude Opus 4.6 |
| `claude-sonnet-4-6` | Claude Sonnet 4.6 |
| `claude-haiku-4-5` | Claude Haiku 4.5 |

### OpenAI

| Model ID | Display Name |
|----------|-------------|
| `gpt-5.4` | GPT-5.4 |
| `gpt-5.4-pro` | GPT-5.4 Pro |
| `gpt-5.2` | GPT-5.2 |
| `gpt-5.1-codex` | GPT-5.1 Codex |
| `gpt-5.1-codex-mini` | GPT-5.1 Codex-Mini |
| `gpt-5-mini` | GPT-5 Mini |
| `gpt-4.1-mini` | GPT-4.1 Mini |

### Mistral

| Model ID | Display Name |
|----------|-------------|
| `mistral-large-latest` | Mistral Large |

### Z.AI (GLM)

| Model ID | Display Name |
|----------|-------------|
| `glm-5.1` | GLM 5.1 |
| `glm-5` | GLM 5 |
| `glm-4.7` | GLM 4.7 |
| `glm-4.6` | GLM 4.6 |

### MiniMax

| Model ID | Display Name |
|----------|-------------|
| `MiniMax-M2.7` | MiniMax M2.7 |
| `MiniMax-M2.7-highspeed` | MiniMax M2.7 Highspeed |

MiniMax is marked as **recommended** in the UI. It requires a special custom models block injected into the OpenClaw config during provisioning. The platform handles this automatically — see `generateCloudInit()` in [`src/lib/cloud-init.ts`](../src/lib/cloud-init.ts).

### DeepSeek

| Model ID | Display Name | Context |
|----------|-------------|---------|
| `deepseek-chat` | DeepSeek Chat (V3.2) | 128K |
| `deepseek-reasoner` | DeepSeek Reasoner (V3.2) | 128K |

### xAI (Grok)

| Model ID | Display Name |
|----------|-------------|
| `grok-4` | Grok 4 |
| `grok-4-fast-reasoning` | Grok 4 Fast Reasoning |
| `grok-4-fast-non-reasoning` | Grok 4 Fast |
| `grok-code-fast-1` | Grok Code Fast |

### Moonshot AI (Kimi)

| Model ID | Display Name | Context |
|----------|-------------|---------|
| `kimi-k2.5` | Kimi K2.5 | 256K |
| `kimi-k2-thinking` | Kimi K2 Thinking | 256K |
| `kimi-k2-0905-preview` | Kimi K2 Preview | 256K |

### Google Gemini

| Model ID | Display Name |
|----------|-------------|
| `gemini-3.1-pro-preview` | Gemini 3.1 Pro Preview |

### Groq

| Model ID | Display Name |
|----------|-------------|
| `groq/llama-3.3-70b-versatile` | Llama 3.3 70B Versatile |
| `groq/llama-3.1-8b-instant` | Llama 3.1 8B Instant |
| `groq/gemma-2-9b` | Gemma 2 9B |

### NVIDIA

| Model ID | Display Name |
|----------|-------------|
| `nvidia/nvidia/llama-3.1-nemotron-70b-instruct` | Nemotron 70B Instruct |

### Xiaomi (MiMo)

| Model ID | Display Name | Context | Input |
|----------|-------------|---------|-------|
| `mimo-v2-flash` | MiMo V2 Flash | 262K | Text |
| `mimo-v2-pro` | MiMo V2 Pro | 1M | Text |
| `mimo-v2-omni` | MiMo V2 Omni | 262K | Text, Image |

### Volcengine (Doubao)

| Model ID | Display Name | Purpose |
|----------|-------------|---------|
| `doubao-seed-1-8` | Doubao Seed 1.8 | General |
| `ark-code-latest` | Ark Code Latest | Coding |

### Together AI

| Model ID | Display Name |
|----------|-------------|
| `together/moonshotai/Kimi-K2.5` | Kimi K2.5 (Together) |
| `together/meta-llama/Llama-4-Maverick-17Bx128E-Instruct-FP8` | Llama 4 Maverick (FP8) |

### Pass-Through Providers

The following providers work as pass-through — users type any valid model ID with the provider prefix. No predefined model list.

- **OpenRouter** — `openrouter/<provider>/<model>`
- **OpenCode Zen** — `opencode/<model>`
- **OpenCode Go** — `opencode-go/<model>`
- **Hugging Face** — `huggingface/<org>/<model>` (supports `:fastest`, `:cheapest` suffixes)
- **Kilocode** — `kilocode/<model>` (default: `kilocode/kilo/auto`)
- **Synthetic** — `synthetic/<model>`
- **Venice** — `venice/<model>`
- **Volcengine** — `doubao-<model>` or `ark-<model>`
- **Qianfan** — `qianfan/<model>`
- **LiteLLM** — `litellm/<model>`
- **Vercel AI Gateway** — `vercel-ai/<provider>/<model>`

---

## How Provider Detection Works

When a user selects a model, the platform detects the provider using prefix matching via `detectProviderByModelId()` in [`src/lib/ai-config.ts`](../src/lib/ai-config.ts).

---

## Adding a New Provider

1. Add the provider ID to the `ProviderId` union type in `src/lib/ai-config.ts`
2. Add a `ProviderDef` entry to the `PROVIDERS` array with:
   - `id` — unique identifier
   - `name` — display name
   - `modelPrefixes` — array of strings used to detect this provider from a model ID
   - `authChoice` — the `--auth-choice` value for `openclaw onboard`
   - `apiKeyFlag` — the CLI flag for passing the API key
   - `setup` — one of `simple`, `complex`, `local`, `cli-auth`
3. Add model entries to the `MODELS` array (if predefined models exist)
4. Add an icon in `src/lib/ai-config-ui.tsx`
5. If the provider needs custom OpenClaw config (like MiniMax), update `generateCloudInit()` in `src/lib/cloud-init.ts`
6. Create a docs file at `docs/providers/<provider-id>.md`

## Adding a New Model to an Existing Provider

Simply add an entry to the `MODELS` array in `src/lib/ai-config.ts`:

```typescript
{ id: "model-id", name: "Display Name", providerId: "provider-id" }
```

Optionally add a `badge` field (e.g., `"Requires Pro+"`) to show a label in the UI.
