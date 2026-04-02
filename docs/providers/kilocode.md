# Kilocode

**Setup complexity:** Simple
**Auth choice:** `kilocode-api-key`
**CLI flag:** `--kilocode-api-key`
**Environment variable:** `KILOCODE_API_KEY`

## Getting an API Key

1. Go to [app.kilo.ai](https://app.kilo.ai)
2. Create an account or sign in
3. Navigate to **API Keys** section
4. Generate a new key and copy it

## Configuration in PapayaClaw

Select **Kilocode** in the deploy wizard and paste your API key.

## Available Models

| Model ID | Display Name | Notes |
|----------|-------------|-------|
| `kilocode/kilo/auto` | Kilo Auto | Auto-routes to best model per task |

The `kilo/auto` model automatically routes: planning/debugging/orchestration to Claude Opus, code writing/exploration to Claude Sonnet.

Run `/models kilocode` in OpenClaw to discover all available models.

## Notes

- Base URL: `https://api.kilo.ai/api/gateway/`
- OpenAI-compatible API (Bearer token auth).
- Models dynamically discover available options at startup based on account permissions.
