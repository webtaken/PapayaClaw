# DeepSeek

**Setup complexity:** Simple
**Auth choice:** `deepseek-api-key`
**CLI flag:** `--deepseek-api-key`
**Environment variable:** `DEEPSEEK_API_KEY`

## Getting an API Key

1. Go to [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)
2. Create an account or sign in
3. Generate a new key and copy it

## Configuration in PapayaClaw

Select **DeepSeek** in the deploy wizard and paste your API key.

## Available Models

| Model ID | Display Name | Context Window |
|----------|-------------|----------------|
| `deepseek-chat` | DeepSeek Chat (V3.2) | 128K tokens |
| `deepseek-reasoner` | DeepSeek Reasoner (V3.2) | 128K tokens |

## Notes

- OpenAI-compatible API.
- DeepSeek offers competitive pricing, significantly lower than most Western providers.
- DeepSeek Reasoner supports reasoning with chain-of-thought.
- Default model set during onboarding: `deepseek/deepseek-chat`.
- For daemon environments, ensure `DEEPSEEK_API_KEY` is available via `~/.openclaw/.env`.
