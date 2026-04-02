# Hugging Face

**Setup complexity:** Simple
**Auth choice:** `huggingface-api-key`
**CLI flag:** `--huggingface-api-key`

## Getting an API Key

1. Go to [huggingface.co](https://huggingface.co/)
2. Create an account or sign in
3. Go to **Settings** > **Access Tokens**
4. Create a new token with **Inference** permissions and copy it

## Configuration in PapayaClaw

Select **Hugging Face** in the deploy wizard and paste your HF token. Enter any model available on the Hugging Face Inference API using the `huggingface/` prefix format.

## Available Models

Pass-through provider. Use any model available on the [Hugging Face Inference API](https://huggingface.co/docs/api-inference/) with the `huggingface/` prefix.

## Notes

- Hugging Face hosts thousands of open-source models.
- Free tier available with rate limits. Pro subscription removes limits.
- Model availability depends on the Inference API — not all HF models are supported.
