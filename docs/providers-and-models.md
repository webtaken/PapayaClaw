# AI Providers & Models

PapayaClaw supports multiple AI providers out of the box. Users select a provider and model during instance deployment — the platform handles all configuration and cloud-init scripting automatically.

> Source of truth: [`src/lib/ai-config.ts`](../src/lib/ai-config.ts)

---

## Providers

| Provider | ID | Auth Method | Notes |
|----------|----|-------------|-------|
| **Anthropic** | `anthropic` | `--anthropic-api-key` | Claude model family |
| **OpenAI** | `openai` | `--openai-api-key` | GPT model family |
| **Z.AI** | `zai` | `--zai-api-key` | GLM model family |
| **Mistral** | `mistral` | `--mistral-api-key` | Mistral Large |
| **MiniMax** | `minimax` | `--minimax-api-key` | Requires custom model config (see below) |
| **OpenRouter** | `openrouter` | `--openrouter-api-key` | Proxy — supports any model on OpenRouter |
| **OpenCode Zen** | `opencode` | `--opencode-zen-api-key` | Custom provider |

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
| `gpt-5.2` | GPT-5.2 |
| `gpt-5.1-codex` | GPT-5.1 Codex |
| `gpt-5.1-codex-mini` | GPT-5.1 Codex-Mini |
| `gpt-5-mini` | GPT-5 Mini |
| `gpt-4.1-mini` | GPT-4.1 Mini |

### Mistral

| Model ID | Display Name |
|----------|-------------|
| `mistral-large-latest` | Mistral Large |

### Z.AI

| Model ID | Display Name | Badge |
|----------|-------------|-------|
| `glm-4.7` | GLM 4.7 | — |
| `glm-5` | GLM 5 | Requires Pro+ |

### MiniMax

| Model ID | Display Name |
|----------|-------------|
| `MiniMax-M2.1` | MiniMax M2.1 |

MiniMax is marked as **recommended** in the UI. It requires a special custom models block injected into the OpenClaw config during provisioning. The platform handles this automatically — see `generateCloudInit()` in [`src/lib/cloud-init.ts`](../src/lib/cloud-init.ts) for implementation details.

The custom config sets:
- Base URL: `https://api.minimax.io/anthropic`
- API: `anthropic-messages` (Anthropic-compatible endpoint)
- Context window: 200,000 tokens
- Max output: 8,192 tokens

### OpenRouter & OpenCode Zen

These are pass-through providers. Users supply any model ID prefixed with `openrouter/` or `opencode/`, and the platform forwards it as-is. No predefined model list — any valid model on the respective platform works.

---

## How Provider Detection Works

When a user selects a model, the platform detects the provider using prefix matching:

| Provider | Prefix(es) |
|----------|-----------|
| Anthropic | `claude` |
| OpenAI | `gpt-`, `o1-`, `o3-` |
| Z.AI | `glm-` |
| Mistral | `mistral` |
| MiniMax | `MiniMax`, `minimax` |
| OpenRouter | `openrouter/` |
| OpenCode Zen | `opencode/` |

This is implemented in `detectProviderByModelId()` in [`src/lib/ai-config.ts`](../src/lib/ai-config.ts).

---

## Adding a New Provider

1. Add the provider ID to the `ProviderId` union type in `src/lib/ai-config.ts`
2. Add a `ProviderDef` entry to the `PROVIDERS` array with:
   - `id` — unique identifier
   - `name` — display name
   - `modelPrefixes` — array of strings used to detect this provider from a model ID
   - `authChoice` — the `--auth-choice` value for `openclaw onboard`
   - `apiKeyFlag` — the CLI flag for passing the API key
3. Add model entries to the `MODELS` array
4. Add an icon in `src/lib/ai-config-ui.tsx`
5. If the provider needs custom OpenClaw config (like MiniMax), update `generateCloudInit()` in `src/lib/cloud-init.ts`

## Adding a New Model to an Existing Provider

Simply add an entry to the `MODELS` array in `src/lib/ai-config.ts`:

```typescript
{ id: "model-id", name: "Display Name", providerId: "provider-id" }
```

Optionally add a `badge` field (e.g., `"Requires Pro+"`) to show a label in the UI.
