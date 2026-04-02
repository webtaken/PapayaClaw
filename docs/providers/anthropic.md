# Anthropic

**Setup complexity:** Simple
**Auth choice:** `apiKey`
**CLI flag:** `--anthropic-api-key`

## Getting an API Key

1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Create an account or sign in
3. Navigate to **API Keys** in the sidebar
4. Click **Create Key** and copy it

## Configuration in PapayaClaw

Select **Anthropic** in the deploy wizard and paste your API key.

## Available Models

| Model ID | Display Name |
|----------|-------------|
| `claude-opus-4-6` | Claude Opus 4.6 |
| `claude-sonnet-4-6` | Claude Sonnet 4.6 |
| `claude-haiku-4-5` | Claude Haiku 4.5 |

## Notes

- Anthropic offers usage-based pricing. Check [anthropic.com/pricing](https://www.anthropic.com/pricing) for current rates.
- Claude Opus 4.6 is the most capable model but also the most expensive.
- Claude Haiku 4.5 is the fastest and most cost-effective for simple tasks.
