# OpenAI Codex CLI

**Setup complexity:** CLI auth (device flow)
**Status:** Configure via SSH after deployment

## Overview

OpenAI Codex CLI allows using OpenAI models through the Codex CLI authentication flow.

## What's Needed

- OpenAI Codex CLI installed
- Active OpenAI account
- Device auth flow (requires browser login)

## Configuration

OpenAI Codex CLI uses device authentication which requires browser interaction. This cannot be configured during automated deployment.

**After deploying your instance**, SSH in and run:
```
openclaw onboard --auth-choice codex-cli
```

Follow the prompts to complete the authentication flow.
