# Qianfan

**Setup complexity:** Simple
**Auth choice:** `qianfan-api-key`
**CLI flag:** `--qianfan-api-key`

## Getting an API Key

1. Go to the [Baidu Qianfan platform](https://cloud.baidu.com/product/wenxinworkshop)
2. Create an account or sign in
3. Navigate to API management
4. Generate an API key and copy it

## Configuration in PapayaClaw

Select **Qianfan** in the deploy wizard and paste your API key. Enter models using the `qianfan/` prefix format.

## Available Models

Pass-through provider. Use any model ID available on the Qianfan platform with the `qianfan/` prefix.

## Notes

- Qianfan is Baidu's AI model platform, home to the ERNIE model family.
- Strong Chinese language capabilities.
