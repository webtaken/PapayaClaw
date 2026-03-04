"use client";

import { ReactNode, useState } from "react";
import type { Instance } from "./dashboard-content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Square, Play, Trash2, Shield, Eye } from "lucide-react";
import { PairingDialog } from "./pairing-dialog";
import { ClaudeAI } from "@/components/icons/claudeai";
import { OpenAI } from "@/components/icons/openai";
import { MistralAI } from "@/components/icons/mistralai";
import { OpenRouter } from "@/components/icons/openrouter";
import { OpenCode } from "@/components/icons/opencode";
import Image from "next/image";
import Link from "next/link";
import { Telegram } from "../icons/telegram";
import { Discord } from "../icons/discord";
import { WhatsApp } from "../icons/whatsapp";
import { Slack } from "../icons/slack";

function formatModelInfo(modelId: string): {
  name: string;
  icon: React.ReactNode;
} {
  if (modelId.startsWith("openrouter/")) {
    return {
      name: modelId.replace("openrouter/", ""),
      icon: <OpenRouter className="h-4 w-4 fill-current" />,
    };
  }
  if (modelId.startsWith("opencode/")) {
    return {
      name: modelId.replace("opencode/", ""),
      icon: <OpenCode className="h-4 w-4" />,
    };
  }

  const map: Record<string, { name: string; icon: React.ReactNode }> = {
    "claude-opus-4-6": {
      name: "Claude Opus 4.6",
      icon: <ClaudeAI className="h-4 w-4" />,
    },
    "claude-sonnet-4-6": {
      name: "Claude Sonnet 4.6",
      icon: <ClaudeAI className="h-4 w-4" />,
    },
    "claude-haiku-4-5": {
      name: "Claude Haiku 4.5",
      icon: <ClaudeAI className="h-4 w-4" />,
    },
    "gpt-5.2": { name: "GPT-5.2", icon: <OpenAI className="h-4 w-4" /> },
    "gpt-5.1-codex": {
      name: "GPT-5.1 Codex",
      icon: <OpenAI className="h-4 w-4" />,
    },
    "gpt-5.1-codex-mini": {
      name: "GPT-5.1 Codex-Mini",
      icon: <OpenAI className="h-4 w-4" />,
    },
    "gpt-5-mini": { name: "GPT-5 Mini", icon: <OpenAI className="h-4 w-4" /> },
    "gpt-4.1-mini": {
      name: "GPT-4.1 Mini",
      icon: <OpenAI className="h-4 w-4" />,
    },
    "mistral-large-latest": {
      name: "Mistral Large",
      icon: <MistralAI className="h-4 w-4" />,
    },
    "glm-4.7": {
      name: "GLM 4.7",
      icon: (
        <Image
          src="/icons/Zai.png"
          alt="Z.AI"
          width={16}
          height={16}
          className="object-contain"
        />
      ),
    },
    "glm-5": {
      name: "GLM 5",
      icon: (
        <Image
          src="/icons/Zai.png"
          alt="Z.AI"
          width={16}
          height={16}
          className="object-contain"
        />
      ),
    },
    "MiniMax-M2.1": {
      name: "MiniMax M2.1",
      icon: (
        <Image
          src="/icons/MiniMax.jpg"
          alt="MiniMax"
          width={16}
          height={16}
          className="object-contain"
        />
      ),
    },
  };

  return map[modelId] || { name: modelId, icon: "⚪" };
}

const channelLabels: Record<string, { name: string; icon: ReactNode }> = {
  telegram: { name: "Telegram", icon: <Telegram className="w-4 h-4" /> },
  discord: { name: "Discord", icon: <Discord className="w-4 h-4" /> },
  whatsapp: { name: "WhatsApp", icon: <WhatsApp className="w-4 h-4" /> },
  slack: { name: "Slack", icon: <Slack className="w-4 h-4" /> },
};

const statusConfig: Record<
  string,
  { label: string; className: string; dotClass: string }
> = {
  running: {
    label: "Running",
    className: "border-green-500/30 bg-green-500/10 text-green-400",
    dotClass: "bg-green-400",
  },
  stopped: {
    label: "Stopped",
    className: "border-red-500/30 bg-red-500/10 text-red-400",
    dotClass: "bg-red-400",
  },
  deploying: {
    label: "Deploying",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    dotClass: "bg-amber-400 animate-pulse",
  },
  error: {
    label: "Error",
    className: "border-red-500/30 bg-red-500/10 text-red-400",
    dotClass: "bg-red-400",
  },
};

export function InstanceCard({
  instance,
  onStatusChange,
  onDelete,
}: {
  instance: Instance;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  const model = formatModelInfo(instance.model);
  const channel = channelLabels[instance.channel] || {
    name: instance.channel,
    icon: "💬",
  };
  const status = statusConfig[instance.status] || statusConfig.stopped;

  const isRunning = instance.status === "running";
  const isDeploying = instance.status === "deploying";
  const isTelegram = instance.channel === "telegram";
  const [pairingOpen, setPairingOpen] = useState(false);

  return (
    <div className="card-glow rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all duration-300">
      {/* Top row: name + status */}
      <div className="mb-4 flex items-start justify-between">
        <h3 className="text-lg font-semibold text-white">{instance.name}</h3>
        <Badge
          variant="outline"
          className={`gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${status.dotClass}`} />
          {status.label}
        </Badge>
      </div>

      {/* Model + Channel */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-zinc-800/40 px-3 py-2">
          <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Model
          </p>
          <p className="flex items-center gap-1.5 text-sm text-zinc-300">
            <span className="text-xs">{model.icon}</span>
            {model.name}
          </p>
        </div>
        <div className="rounded-lg bg-zinc-800/40 px-3 py-2">
          <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Channel
          </p>
          <p className="flex items-center gap-1.5 text-sm text-zinc-300">
            <span className="text-xs">{channel.icon}</span>
            {channel.name}
          </p>
        </div>
      </div>

      {/* Created date */}
      <p className="mb-4 text-xs text-zinc-500">
        Created{" "}
        {new Date(instance.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {!isDeploying && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onStatusChange(instance.id, isRunning ? "stopped" : "running")
            }
            className="cursor-pointer gap-1.5 rounded-lg border-zinc-700 bg-zinc-800/50 text-xs text-zinc-300 transition-all hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
          >
            {isRunning ? (
              <>
                <Square className="h-3 w-3" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-3 w-3" />
                Start
              </>
            )}
          </Button>
        )}
        {isRunning && isTelegram && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPairingOpen(true)}
            className="cursor-pointer gap-1.5 rounded-lg border-violet-500/30 bg-violet-500/10 text-xs text-violet-300 transition-all hover:border-violet-500/50 hover:bg-violet-500/20 hover:text-violet-200"
          >
            <Shield className="h-3 w-3" />
            Pairing
          </Button>
        )}
        <Link href={`/dashboard/${instance.id}`}>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer gap-1.5 rounded-lg border-zinc-700 bg-zinc-800/50 text-xs text-zinc-300 transition-all hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
          >
            <Eye className="h-3 w-3" />
            View
          </Button>
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDelete(instance.id)}
          className="cursor-pointer gap-1.5 rounded-lg border-zinc-700 bg-zinc-800/50 text-xs text-red-400 transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </Button>
      </div>

      {/* Pairing Dialog */}
      {isTelegram && (
        <PairingDialog
          open={pairingOpen}
          onOpenChange={setPairingOpen}
          instanceId={instance.id}
        />
      )}
    </div>
  );
}
