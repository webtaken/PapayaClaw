# vLLM

**Setup complexity:** Local server
**Status:** Not yet available in deploy wizard

## Overview

vLLM is a high-throughput inference engine for LLMs. It runs models locally with optimized serving.

## What's Needed

- vLLM installed and running on the VPS
- GPU recommended for reasonable performance
- Model loaded and served via vLLM

## Current Status

vLLM requires a local server setup with GPU. Support in the PapayaClaw deploy wizard is planned for a future update.

## Manual Configuration

After deploying an instance, SSH in and configure OpenClaw:
```
openclaw onboard --auth-choice vllm
```

Refer to [vLLM docs](https://docs.vllm.ai/) for server setup instructions.
