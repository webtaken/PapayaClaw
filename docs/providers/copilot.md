# GitHub Copilot

**Setup complexity:** CLI auth (device flow)
**Status:** Configure via SSH after deployment

## Overview

GitHub Copilot can be used as an AI provider through a proxy that leverages your Copilot subscription.

## What's Needed

- Active GitHub Copilot subscription
- Device auth flow (requires browser login)

## Configuration

GitHub Copilot uses device authentication which requires browser interaction. This cannot be configured during automated deployment.

**After deploying your instance**, SSH in and run:
```
openclaw onboard --auth-choice github-copilot
```

Follow the prompts to complete the device auth flow in your browser.
