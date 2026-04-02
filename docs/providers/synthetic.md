# Synthetic

**Setup complexity:** Simple
**Auth choice:** `synthetic-api-key`
**CLI flag:** `--synthetic-api-key`
**Environment variable:** `SYNTHETIC_API_KEY` (format: `sk-...`)

## Getting an API Key

1. Go to the Synthetic AI platform
2. Create an account or sign in
3. Navigate to API Keys
4. Generate a new key and copy it

## Configuration in PapayaClaw

Select **Synthetic** in the deploy wizard and paste your API key. Enter models using the `synthetic/` prefix format.

## Available Models

Pass-through provider. Use any model ID available on the Synthetic platform with the `synthetic/` prefix. Default: `synthetic/hf:MiniMaxAI/MiniMax-M2.5`.

Notable models include reasoning-capable (Kimi-K2-Thinking, Qwen3-235B-A22B-Thinking), large context (Llama-4-Maverick at 524K tokens), and multimodal (Qwen3-VL-235B).

## Notes

- Base URL: `https://api.synthetic.new/anthropic` (Anthropic-compatible Messages API).
- Context windows range from 128K to 524K tokens.
- Currently zero-cost for all input/output.
