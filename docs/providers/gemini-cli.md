# Google Gemini CLI

**Setup complexity:** CLI auth (device flow)
**Status:** Configure via SSH after deployment

## Overview

Google Gemini CLI allows using Google's Gemini models through the CLI authentication flow.

## What's Needed

- Google account
- Device auth flow (requires browser login)

## Configuration

Google Gemini CLI uses device authentication which requires browser interaction. This cannot be configured during automated deployment.

**After deploying your instance**, SSH in and run:
```
openclaw onboard --auth-choice google-gemini-cli
```

Follow the prompts to complete the device auth flow in your browser.
