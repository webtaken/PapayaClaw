# xAI

**Setup complexity:** Simple
**Auth choice:** `xai-api-key`
**CLI flag:** `--xai-api-key`
**Environment variable:** `XAI_API_KEY`

## Getting an API Key

1. Go to [console.x.ai](https://console.x.ai/)
2. Create an account or sign in
3. Navigate to **API Keys**
4. Create a new key and copy it

## Configuration in PapayaClaw

Select **xAI** in the deploy wizard and paste your API key.

## Available Models

| Model ID | Display Name |
|----------|-------------|
| `grok-4` | Grok 4 |
| `grok-4-fast-reasoning` | Grok 4 Fast Reasoning |
| `grok-4-fast-non-reasoning` | Grok 4 Fast |
| `grok-code-fast-1` | Grok Code Fast |

## Notes

- Auth is API-key only — no OAuth/device-code flow available.
- Grok 4 is xAI's flagship model with strong reasoning capabilities.
- Also supports web search via `openclaw config set tools.web.search.provider grok`.
- The plugin auto-resolves newer `grok-4*` and `grok-code-fast*` IDs.
