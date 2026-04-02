# Ollama

**Setup complexity:** Local server
**Status:** Not yet available in deploy wizard

## Overview

Ollama runs AI models locally on your machine. No API key is needed — it connects to a local Ollama server.

## What's Needed

- Ollama installed and running on the VPS
- Models downloaded locally via `ollama pull <model>`

## Current Status

Ollama requires a local server running on the VPS. Support in the PapayaClaw deploy wizard is planned for a future update.

## Manual Configuration

After deploying an instance, SSH in and:
1. Install Ollama: `curl -fsSL https://ollama.com/install.sh | sh`
2. Pull a model: `ollama pull llama3.1`
3. Configure OpenClaw: `openclaw onboard --auth-choice ollama`
