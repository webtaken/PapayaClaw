# MiniMax

**Setup complexity:** Simple
**Auth choice:** `minimax-api`
**CLI flag:** `--minimax-api-key`
**Environment variable:** `MINIMAX_API_KEY` (format: `sk-...`)

## Getting an API Key

1. Go to [MiniMax platform](https://www.minimax.io/)
2. Create an account or sign in
3. Navigate to the API section
4. Generate an API key and copy it

## Configuration in PapayaClaw

Select **MiniMax** in the deploy wizard and paste your API key. MiniMax is marked as **recommended** in the UI.

## Available Models

| Model ID | Display Name | Reasoning |
|----------|-------------|-----------|
| `MiniMax-M2.7` | MiniMax M2.7 | Yes |
| `MiniMax-M2.7-highspeed` | MiniMax M2.7 Highspeed | Yes |

## Notes

- MiniMax M2.7 is the recommended default model in PapayaClaw.
- PapayaClaw automatically configures the custom models block required by OpenClaw for MiniMax (Anthropic-compatible API at `https://api.minimax.io/anthropic`).
- Context window: 200,000 tokens. Max output: 8,192 tokens.
- Cost: 0.3 input / 1.2 output (cents per million tokens).
- Also supports image generation via `minimax/image-01`.
- OAuth portal login also available for MiniMax Coding Plan users.
