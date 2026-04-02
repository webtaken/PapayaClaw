# Vercel AI Gateway

**Setup complexity:** Simple
**Auth choice:** `ai-gateway-api-key`
**CLI flag:** `--ai-gateway-api-key`
**Environment variable:** `AI_GATEWAY_API_KEY`

## Getting an API Key

1. Go to your Vercel dashboard
2. Navigate to AI Gateway settings
3. Generate an API key and copy it

## Configuration in PapayaClaw

Select **Vercel AI Gateway** in the deploy wizard and paste your API key.

## Available Models

| Model ID | Display Name |
|----------|-------------|
| `vercel-ai/anthropic/claude-opus-4.6` | Claude Opus 4.6 (Vercel) |

Vercel AI Gateway auto-discovers available models via the `/v1/models` endpoint. Supports shorthand: `vercel-ai/claude-opus-4.6` auto-normalizes to `vercel-ai/anthropic/claude-opus-4.6`.

## Notes

- Vercel AI Gateway provides a unified API gateway for AI models.
- Anthropic Messages compatible API.
- Models from multiple providers accessible through a single gateway.
