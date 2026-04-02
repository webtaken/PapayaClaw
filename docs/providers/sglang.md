# SGLang

**Setup complexity:** Local server
**Status:** Not yet available in deploy wizard

## Overview

SGLang is a fast serving framework for large language models and vision-language models. It runs models locally.

## What's Needed

- SGLang installed and running on the VPS
- GPU recommended for reasonable performance
- Model loaded and served via SGLang

## Current Status

SGLang requires a local server setup with GPU. Support in the PapayaClaw deploy wizard is planned for a future update.

## Manual Configuration

After deploying an instance, SSH in and configure OpenClaw:
```
openclaw onboard --auth-choice sglang
```

Refer to [SGLang docs](https://sgl-project.github.io/) for server setup instructions.
