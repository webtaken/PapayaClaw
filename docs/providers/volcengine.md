# Volcengine (Doubao)

**Setup complexity:** Simple
**Auth choice:** `volcengine-api-key`
**CLI flag:** `--volcengine-api-key`
**Environment variable:** `VOLCANO_ENGINE_API_KEY`

## Getting an API Key

1. Go to [Volcengine platform](https://www.volcengine.com/)
2. Create an account or sign in (ByteDance account)
3. Navigate to Model API section
4. Generate an API key and copy it

## Configuration in PapayaClaw

Select **Volcengine (Doubao)** in the deploy wizard and paste your API key.

## Available Models

| Model ID | Display Name | Purpose |
|----------|-------------|---------|
| `doubao-seed-1-8` | Doubao Seed 1.8 | General (default) |
| `doubao-seed-code-preview` | Doubao Seed Code Preview | Coding |
| `ark-code-latest` | Ark Code Latest | Coding plan default |

Also hosts third-party models: `kimi-k2-5`, `glm-4-7`, `deepseek-v3-2`.

## Notes

- Volcengine is ByteDance's cloud platform. Doubao is their AI model family.
- Two providers registered: `volcengine` (general, `ark.cn-beijing.volces.com/api/v3`) and `volcengine-plan` (coding, `ark.cn-beijing.volces.com/api/coding/v3`).
- Single API key works for both providers.
- For daemon mode, ensure the API key is available via `~/.openclaw/.env`.
