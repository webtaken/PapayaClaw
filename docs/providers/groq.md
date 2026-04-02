# Groq

**Setup complexity:** Simple
**Auth choice:** `skip` (uses `GROQ_API_KEY` env var)
**Environment variable:** `GROQ_API_KEY` (format: `gsk_...`)

## Getting an API Key

1. Go to [console.groq.com/keys](https://console.groq.com/keys)
2. Create an account or sign in
3. Generate a new API key and copy it

## Configuration in PapayaClaw

Select **Groq** in the deploy wizard and paste your API key. Groq has its own native provider in OpenClaw (not routed through OpenRouter).

## Available Models

| Model ID | Display Name |
|----------|-------------|
| `groq/llama-3.3-70b-versatile` | Llama 3.3 70B Versatile |
| `groq/llama-3.1-8b-instant` | Llama 3.1 8B Instant |
| `groq/gemma-2-9b` | Gemma 2 9B |
| `groq/mixtral-8x7b` | Mixtral 8x7B |

Browse more models: [console.groq.com/docs/models](https://console.groq.com/docs/models)

## Notes

- Groq uses custom LPU (Language Processing Unit) hardware for ultra-fast inference.
- Known for very low latency responses.
- OpenAI-compatible API.
- Audio transcription available via `whisper-large-v3-turbo`.
