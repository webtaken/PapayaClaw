# Cloudflare AI Gateway

**Setup complexity:** Complex
**Status:** Not yet available in deploy wizard

## Overview

Cloudflare AI Gateway acts as a proxy between your application and AI providers, adding caching, rate limiting, and analytics.

## What's Needed

- Cloudflare account
- Account ID
- Gateway ID (create one in the Cloudflare dashboard)
- API key

## Current Status

Cloudflare AI Gateway requires three configuration fields (Account ID, Gateway ID, API key). Support in the PapayaClaw deploy wizard is planned for a future update.

## Manual Configuration

After deploying an instance, you can configure Cloudflare AI Gateway manually via SSH using:
```
openclaw onboard --auth-choice cloudflare-ai-gateway-api-key \
  --cloudflare-ai-gateway-account-id <id> \
  --cloudflare-ai-gateway-gateway-id <id> \
  --cloudflare-ai-gateway-api-key <key>
```
