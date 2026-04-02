# Xiaomi (MiMo)

**Setup complexity:** Simple
**Auth choice:** `xiaomi-api-key`
**CLI flag:** `--xiaomi-api-key`
**Environment variable:** `XIAOMI_API_KEY`

## Getting an API Key

1. Go to [Xiaomi MiMo console](https://platform.xiaomimimo.com/#/console/api-keys)
2. Create an account or sign in
3. Generate an API key and copy it

## Configuration in PapayaClaw

Select **Xiaomi** in the deploy wizard and paste your API key.

## Available Models

| Model ID | Display Name | Context | Max Tokens | Input |
|----------|-------------|---------|-----------|-------|
| `mimo-v2-flash` | MiMo V2 Flash | 262K | 8K | Text |
| `mimo-v2-pro` | MiMo V2 Pro | 1M | 32K | Text |
| `mimo-v2-omni` | MiMo V2 Omni | 262K | 32K | Text, Image |

## Notes

- Base URL: `https://api.xiaomimimo.com/v1`
- OpenAI-compatible API (`openai-completions`).
- MiMo V2 Pro has a 1M context window.
- MiMo V2 Omni supports multimodal input (text + image).
- Currently free pricing for all input/output.
