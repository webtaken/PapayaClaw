# LiteLLM

**Setup complexity:** Simple
**Auth choice:** `litellm-api-key`
**CLI flag:** `--litellm-api-key`

## Getting an API Key

1. Deploy a LiteLLM proxy or use a hosted instance
2. Get the API key from your LiteLLM deployment
3. Copy the key

## Configuration in PapayaClaw

Select **LiteLLM** in the deploy wizard and paste your API key. Enter models using the `litellm/` prefix format.

## Available Models

Pass-through provider. LiteLLM is a unified gateway that supports 100+ LLM providers. Use any model configured in your LiteLLM instance with the `litellm/` prefix.

## Notes

- LiteLLM acts as a unified proxy to many AI providers with a single OpenAI-compatible API.
- Requires a running LiteLLM instance (self-hosted or managed).
- Useful for teams that want to centralize API key management and usage tracking.
- See [docs.litellm.ai](https://docs.litellm.ai/) for setup instructions.
