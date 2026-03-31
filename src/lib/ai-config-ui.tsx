"use client";

import Image from "next/image";
import { ClaudeAI } from "@/components/icons/claudeai";
import { OpenAI } from "@/components/icons/openai";
import { MistralAI } from "@/components/icons/mistralai";
import { OpenRouter } from "@/components/icons/openrouter";
import { OpenCode } from "@/components/icons/opencode";
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
    case "anthropic":
      return <ClaudeAI className={className} />;
    case "openai":
      return <OpenAI className={className} />;
    case "mistral":
      return <MistralAI className={className} />;
    case "openrouter":
      return <OpenRouter className={`${className} fill-current`} />;
    case "opencode":
      return <OpenCode className={className} />;
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
