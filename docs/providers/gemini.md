# Google Gemini

**Setup complexity:** Simple (API key)
**Auth choice:** `google-api-key`
**CLI flag:** `--gemini-api-key`
**Environment variable:** `GEMINI_API_KEY` (or `GOOGLE_API_KEY`)

## Getting an API Key

1. Go to [aistudio.google.com](https://aistudio.google.com/)
2. Sign in with your Google account
3. Get an API key from Google AI Studio
4. Copy the key

## Configuration in PapayaClaw

Select **Google Gemini** in the deploy wizard and paste your API key.

## Available Models

| Model ID | Display Name |
|----------|-------------|
| `gemini-3.1-pro-preview` | Gemini 3.1 Pro Preview |

## Notes

- Google Gemini also supports a CLI auth flow (`google-gemini-cli`) for device-based login, but PapayaClaw uses the simpler API key approach.
- Supports chat completions, image generation/understanding, audio transcription, video understanding, and web search (Grounding).
- Gemini 3.1+ supports thinking/reasoning mode.
