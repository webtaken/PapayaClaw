# Qwen / Model Studio (Alibaba Cloud)

**Setup complexity:** Complex
**Status:** Not yet available in deploy wizard

## Overview

Alibaba Cloud's Model Studio offers Qwen models through multiple API variants depending on region and plan type.

## What's Needed

There are four API key variants:

| Auth Choice | CLI Flag | Description |
|-------------|----------|-------------|
| `modelstudio-api-key` | `--modelstudio-api-key` | Coding Plan (Global/Intl) |
| `modelstudio-api-key-cn` | `--modelstudio-api-key-cn` | Coding Plan (China) |
| `modelstudio-standard-api-key` | `--modelstudio-standard-api-key` | Standard (Global/Intl) |
| `modelstudio-standard-api-key-cn` | `--modelstudio-standard-api-key-cn` | Standard (China) |

## Current Status

Qwen / Model Studio has multiple regional variants that require different configuration. Support in the PapayaClaw deploy wizard is planned for a future update.

## Manual Configuration

After deploying an instance, configure via SSH:
```
openclaw onboard --auth-choice modelstudio-api-key --modelstudio-api-key <key>
```
