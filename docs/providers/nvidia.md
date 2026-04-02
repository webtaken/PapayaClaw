# NVIDIA

**Setup complexity:** Simple
**Auth choice:** `skip` (uses `NVIDIA_API_KEY` env var)
**Environment variable:** `NVIDIA_API_KEY` (format: `nvapi-...`)

## Getting an API Key

1. Go to the [NVIDIA NGC catalog](https://catalog.ngc.nvidia.com/)
2. Create an account or sign in
3. Generate an API key and copy it

## Configuration in PapayaClaw

Select **NVIDIA** in the deploy wizard and paste your API key. NVIDIA has its own native provider in OpenClaw with base URL `https://integrate.api.nvidia.com/v1`.

## Available Models

| Model ID | Display Name |
|----------|-------------|
| `nvidia/nvidia/llama-3.1-nemotron-70b-instruct` | Nemotron 70B Instruct |
| `nvidia/meta/llama-3.3-70b-instruct` | Llama 3.3 70B Instruct |

## Notes

- OpenAI-compatible API.
- Provider activates automatically when `NVIDIA_API_KEY` env var is set.
- Default context window: 131,072 tokens, max output: 4,096 tokens.
