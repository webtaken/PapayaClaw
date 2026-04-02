# OpenAI

**Setup complexity:** Simple
**Auth choice:** `openai-api-key`
**CLI flag:** `--openai-api-key`
**Environment variable:** `OPENAI_API_KEY` (format: `sk-...`)

## Getting an API Key

1. Go to [platform.openai.com](https://platform.openai.com/)
2. Create an account or sign in
3. Navigate to **API Keys** in Settings
4. Click **Create new secret key** and copy it

## Configuration in PapayaClaw

Select **OpenAI** in the deploy wizard and paste your API key.

## Available Models

| Model ID | Display Name |
|----------|-------------|
| `gpt-5.4` | GPT-5.4 |
| `gpt-5.4-pro` | GPT-5.4 Pro |
| `gpt-5.2` | GPT-5.2 |
| `gpt-5.1-codex` | GPT-5.1 Codex |
| `gpt-5.1-codex-mini` | GPT-5.1 Codex-Mini |
| `gpt-5-mini` | GPT-5 Mini |
| `gpt-4.1-mini` | GPT-4.1 Mini |

## Notes

- Usage-based pricing. Check [openai.com/api/pricing](https://openai.com/api/pricing/) for current rates.
- Transport options: SSE, WebSocket, or auto (WebSocket-first with SSE fallback).
- Service tiers available: `auto`, `default`, `flex`, `priority`.
- Codex CLI auth (`openai-codex`) also available for ChatGPT subscription users — configure via SSH after deployment.
