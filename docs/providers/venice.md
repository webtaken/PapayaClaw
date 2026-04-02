# Venice

**Setup complexity:** Simple
**Auth choice:** `venice-api-key`
**CLI flag:** `--venice-api-key`

## Getting an API Key

1. Go to [venice.ai](https://venice.ai/)
2. Create an account or sign in
3. Navigate to API settings
4. Generate a new key and copy it

## Configuration in PapayaClaw

Select **Venice** in the deploy wizard and paste your API key. Enter models using the `venice/` prefix format.

## Available Models

Pass-through provider. Use any model ID available on Venice with the `venice/` prefix.

## Notes

- Venice AI is a privacy-focused AI platform.
- No conversation logs are stored by Venice.
- Good option for users who prioritize data privacy.
