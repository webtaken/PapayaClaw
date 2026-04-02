# Claude Code CLI

**Setup complexity:** CLI auth (device flow)
**Status:** Configure via SSH after deployment

## Overview

Claude Code CLI allows using Anthropic's Claude models through the Claude Code CLI authentication flow.

## What's Needed

- Claude Code CLI installed
- Active Anthropic account with Claude access
- Device auth flow (requires browser login)

## Configuration

Claude Code CLI uses device authentication which requires browser interaction. This cannot be configured during automated deployment.

**After deploying your instance**, SSH in and run:
```
openclaw onboard --auth-choice claude-cli
```

Follow the prompts to complete the authentication flow.
