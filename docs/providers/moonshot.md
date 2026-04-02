# Moonshot AI (Kimi)

**Setup complexity:** Simple
**Auth choice:** `moonshot-api-key`
**CLI flag:** `--moonshot-api-key`
**Environment variable:** `MOONSHOT_API_KEY` (format: `sk-...`)

## Getting an API Key

1. Go to [Moonshot AI platform](https://platform.moonshot.cn/) (or Kimi global portal)
2. Create an account or sign in
3. Navigate to API Keys
4. Generate a new key and copy it

## Configuration in PapayaClaw

Select **Moonshot AI** in the deploy wizard and paste your API key.

## Available Models

| Model ID | Display Name | Context Window |
|----------|-------------|----------------|
| `kimi-k2.5` | Kimi K2.5 | 256K tokens |
| `kimi-k2-thinking` | Kimi K2 Thinking | 256K tokens |
| `kimi-k2-0905-preview` | Kimi K2 Preview | 256K tokens |
| `kimi-k2-turbo-preview` | Kimi K2 Turbo Preview | 256K tokens |
| `kimi-k2-thinking-turbo` | Kimi K2 Thinking Turbo | 256K tokens |

## Notes

- Moonshot AI is the company behind Kimi.
- Base URLs: International `https://api.moonshot.ai/v1`, China `https://api.moonshot.cn/v1`.
- OpenAI-compatible endpoints.
- Max output: 8,192 tokens across all models.
- Supports native thinking mode (enabled/disabled via config).
- Also available: `kimi-code-api-key` auth for Kimi Coding subscription (separate provider, `KIMI_API_KEY`).
