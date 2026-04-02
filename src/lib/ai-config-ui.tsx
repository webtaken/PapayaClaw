"use client";

import Image from "next/image";
import { ClaudeAI } from "@/components/icons/claudeai";
import { OpenAI } from "@/components/icons/openai";
import { MistralAI } from "@/components/icons/mistralai";
import { OpenRouter } from "@/components/icons/openrouter";
import { OpenCode } from "@/components/icons/opencode";
import { DeepSeek } from "@/components/icons/deepseek";
import { Groq } from "@/components/icons/groq";
import { HuggingFace } from "@/components/icons/huggingface";
import { KiloCode } from "@/components/icons/kilocode";
import MoonshotAI from "@/components/icons/moonshot-ai";
import { NVIDIA } from "@/components/icons/nvidia";

import { TogetherAI } from "@/components/icons/together-ai";
import { XAIGrok } from "@/components/icons/x-ai-grok";
import { Qwen } from "@/components/icons/qwen";
import { AmazonWebServices } from "@/components/icons/amazon";
import { Cloudflare } from "@/components/icons/cloudflare";
import { Gemini } from "@/components/icons/gemini";
import { Vercel } from "@/components/icons/vercel";
import VLLM from "@/components/icons/vllm";
import { Telegram } from "@/components/icons/telegram";
import { Discord } from "@/components/icons/discord";
import { WhatsApp } from "@/components/icons/whatsapp";
import { Slack } from "@/components/icons/slack";
import type { ProviderId, ChannelId } from "./ai-config";
import { MODELS, detectProviderByModelId } from "./ai-config";

/** Returns the icon ReactNode for a provider */
export function getProviderIcon(
  id: ProviderId,
  className = "h-5 w-5",
): React.ReactNode {
  const size = parseInt(className.match(/h-(\d+)/)?.[1] || "5") * 4;
  switch (id) {
    // Phase 1 — Simple API key
    case "anthropic":
      return <ClaudeAI className={className} />;
    case "openai":
      return <OpenAI className={className} />;
    case "mistral":
      return <MistralAI className={className} />;
    case "openrouter":
      return <OpenRouter className={`${className} fill-current`} />;
    case "opencode":
    case "opencode-go":
      return <OpenCode className={className} />;
    case "deepseek":
      return <DeepSeek className={className} />;
    case "groq":
      return <Groq className={className} />;
    case "huggingface":
      return <HuggingFace className={className} />;
    case "kilocode":
      return <KiloCode className={className} />;
    case "moonshot":
      return <MoonshotAI className={className} />;
    case "nvidia":
      return <NVIDIA className={className} />;
    case "together":
      return <TogetherAI className={className} />;
    case "xai":
      return <XAIGrok className={className} />;
    case "zai":
      return (
        <Image
          src="/icons/Zai.png"
          alt="Z.AI"
          width={size}
          height={size}
          className="object-contain"
        />
      );
    case "minimax":
      return (
        <Image
          src="/icons/MiniMax.jpg"
          alt="MiniMax"
          width={size}
          height={size}
          className="object-contain"
        />
      );
    case "synthetic":
      return (
        <Image
          src="/icons/synthetic-ai.png"
          alt="Synthetic"
          width={size}
          height={size}
          className="object-contain"
        />
      );
    case "venice":
      return (
        <Image
          src="/icons/venice-ai.png"
          alt="Venice"
          width={size}
          height={size}
          className="object-contain"
        />
      );
    case "xiaomi":
      return (
        <Image
          src="/icons/xiaomi-mimo.png"
          alt="Xiaomi"
          width={size}
          height={size}
          className="object-contain"
        />
      );
    case "volcengine":
      return (
        <Image
          src="/icons/volcengine.png"
          alt="Volcengine"
          width={size}
          height={size}
          className="object-contain"
        />
      );
    case "litellm":
      return <span className={className}>🔀</span>;
    case "qianfan":
      return <span className={className}>🌐</span>;

    case "gemini":
    case "gemini-cli":
      return <Gemini className={className} />;
    case "vercel-ai":
      return <Vercel className={className} />;

    // Phase 2 — Complex
    case "bedrock":
      return <AmazonWebServices className={className} />;
    case "cloudflare":
      return <Cloudflare className={className} />;
    case "qwen":
      return <Qwen className={className} />;

    // Phase 3 — Local
    case "ollama":
      return <span className={className}>🦙</span>;
    case "vllm":
      return <VLLM className={className} />;
    case "sglang":
      return (
        <Image
          src="/icons/sglang.png"
          alt="SGLang"
          width={size}
          height={size}
          className="object-contain"
        />
      );

    // CLI-auth
    case "copilot":
      return <span className={className}>🤖</span>;
    case "claude-cli":
      return <ClaudeAI className={className} />;
    case "codex-cli":
      return <OpenAI className={className} />;
  }
}

/** Returns the icon ReactNode for a channel */
export function getChannelIcon(
  id: ChannelId,
  className = "h-5 w-5",
): React.ReactNode {
  switch (id) {
    case "telegram":
      return <Telegram className={className} />;
    case "discord":
      return <Discord className={className} />;
    case "whatsapp":
      return <WhatsApp className={className} />;
    case "slack":
      return <Slack className={className} />;
  }
}

/** Resolves a model ID to its display name and provider icon */
export function formatModelInfo(
  modelId: string,
  iconClassName = "h-4 w-4",
): { name: string; icon: React.ReactNode } {
  // Custom provider models use prefix/model format
  if (modelId.startsWith("openrouter/")) {
    return {
      name: modelId.replace("openrouter/", ""),
      icon: <OpenRouter className={`${iconClassName} fill-current`} />,
    };
  }
  if (modelId.startsWith("opencode/")) {
    return {
      name: modelId.replace("opencode/", ""),
      icon: <OpenCode className={iconClassName} />,
    };
  }

  // Look up in known models
  const model = MODELS.find((m) => m.id === modelId);
  if (model) {
    return {
      name: model.name,
      icon: getProviderIcon(model.providerId, iconClassName),
    };
  }

  // Fallback: try to detect provider from prefix
  const provider = detectProviderByModelId(modelId);
  if (provider) {
    return {
      name: modelId,
      icon: getProviderIcon(provider.id, iconClassName),
    };
  }

  return { name: modelId, icon: "⚪" };
}

/** Resolves a channel ID to its display name and icon */
export function formatChannelInfo(
  channelId: string,
  iconClassName = "h-4 w-4",
): { name: string; icon: React.ReactNode } {
  const channelMap: Record<string, { name: string; id: ChannelId }> = {
    telegram: { name: "Telegram", id: "telegram" },
    discord: { name: "Discord", id: "discord" },
    whatsapp: { name: "WhatsApp", id: "whatsapp" },
    slack: { name: "Slack", id: "slack" },
  };

  const ch = channelMap[channelId];
  if (ch) {
    return { name: ch.name, icon: getChannelIcon(ch.id, iconClassName) };
  }
  return { name: channelId, icon: "⚪" };
}
