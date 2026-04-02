# Z.AI

**Setup complexity:** Simple
**Auth choice:** `zai-api-key`
**CLI flag:** `--zai-api-key`
**Environment variable:** `ZAI_API_KEY` (format: `sk-...`)

## Getting an API Key

1. Go to the Z.AI console
2. Create an account or sign in
3. Navigate to API Keys
4. Generate a new key and copy it

## Configuration in PapayaClaw

Select **Z.AI** in the deploy wizard and paste your API key.

## Available Models

| Model ID | Display Name |
|----------|-------------|
| `glm-5.1` | GLM 5.1 |
| `glm-5` | GLM 5 |
| `glm-4.7` | GLM 4.7 |
| `glm-4.6` | GLM 4.6 |

## Notes

- Z.AI offers four onboarding variants: `zai-coding-global`, `zai-coding-cn`, `zai-global`, `zai-cn`. PapayaClaw uses the general API key approach.
- Tool-call streaming (`tool_stream`) is enabled by default.
- GLM models offer strong multilingual capabilities, particularly for Chinese language tasks.
- GLM versions and availability can change — check Z.AI docs for the latest.
