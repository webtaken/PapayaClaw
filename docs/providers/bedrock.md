# Amazon Bedrock

**Setup complexity:** Complex
**Status:** Not yet available in deploy wizard

## Overview

Amazon Bedrock provides access to foundation models from various providers through AWS. It requires AWS credentials (Access Key, Secret Key, Region) rather than a simple API key.

## What's Needed

- AWS account with Bedrock access enabled
- IAM credentials with Bedrock permissions
- AWS Region selection (models vary by region)

## Current Status

Amazon Bedrock requires multi-field configuration (AWS credentials + region). Support in the PapayaClaw deploy wizard is planned for a future update.

## Manual Configuration

After deploying an instance, you can configure Bedrock manually via SSH. Refer to the [OpenClaw Bedrock docs](https://docs.openclaw.ai/providers/bedrock) for details.
