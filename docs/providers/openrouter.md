# OpenRouter

**Setup complexity:** Simple
**Auth choice:** `openrouter-api-key`
**CLI flag:** `--openrouter-api-key`

## Getting an API Key

1. Go to [openrouter.ai](https://openrouter.ai/)
2. Create an account or sign in
3. Navigate to **Keys** in the dashboard
4. Create a new key and copy it

## Configuration in PapayaClaw

Select **OpenRouter** in the deploy wizard and paste your API key. Then enter any model ID available on OpenRouter using the `openrouter/` prefix format.

## Available Models

OpenRouter is a pass-through proxy — it supports any model available on the OpenRouter platform. Use the model ID format: `openrouter/<provider>/<model-name>`.

Browse available models at [openrouter.ai/models](https://openrouter.ai/models).

## Notes

- OpenRouter acts as a unified gateway to hundreds of AI models from various providers.
- Pricing varies by model. Check individual model pages on OpenRouter for rates.
- Useful if you want to switch between providers without changing API keys.
- Groq, NVIDIA, and Perplexity models in PapayaClaw are routed through OpenRouter.
