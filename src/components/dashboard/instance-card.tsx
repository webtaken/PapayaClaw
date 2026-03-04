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

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
    <div className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl h-full transition-all duration-300 hover:border-zinc-700">
      {/* Top row: name + status */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/20 px-4 py-3">
        <div className="flex flex-col min-w-0 pr-3">
          <h3 className="text-sm font-medium tracking-tight text-white mb-0.5 truncate">
            {instance.name}
          </h3>
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest truncate">
            {new Date(instance.createdAt).toISOString().split("T")[0]}
          </p>
        </div>
        <Badge
          variant="outline"
          className={`shrink-0 gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${status.className}`}
        >
          <span className={`h-1 w-1 rounded-full ${status.dotClass}`} />
          {status.label}
        </Badge>
      </div>

      <div className="p-4 flex flex-col flex-1 gap-4">
        {/* Model + Channel */}
        <div className="grid grid-cols-2 gap-px bg-zinc-800/50 border border-zinc-800/50 rounded-lg overflow-hidden shrink-0">
          <div className="bg-zinc-950/80 p-3 flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
              Model
            </span>
            <span className="flex items-center gap-1.5 text-xs text-zinc-300">
              <span className="text-[10px] text-zinc-400 shrink-0">
                {model.icon}
              </span>
              <span className="truncate">{model.name}</span>
            </span>
          </div>
          <div className="bg-zinc-950/80 p-3 flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
              Channel
            </span>
            <span className="flex items-center gap-1.5 text-xs text-zinc-300">
              <span className="text-[10px] text-zinc-400 shrink-0">
                {channel.icon}
              </span>
              <span className="truncate">{channel.name}</span>
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
          {!isDeploying && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onStatusChange(instance.id, isRunning ? "stopped" : "running")
              }
              className="cursor-pointer gap-1.5 rounded-lg border-zinc-800 bg-zinc-900/50 text-[10px] font-mono uppercase tracking-wider text-zinc-400 transition-all hover:border-zinc-700 hover:bg-zinc-800 hover:text-white h-8 shadow-none"
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
              className="cursor-pointer gap-1.5 rounded-lg border-amber-500/20 bg-amber-500/5 text-[10px] font-mono uppercase tracking-wider text-amber-500/90 transition-all hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-400 h-8 shadow-none"
            >
              <Shield className="h-3 w-3" />
              Pairing
            </Button>
          )}

          <Link
            href={`/dashboard/${instance.id}`}
            className={
              !isDeploying && (!isRunning || !isTelegram)
                ? "col-span-1"
                : isDeploying
                  ? "col-span-2"
                  : "col-span-2"
            }
          >
            <Button
              variant="outline"
              size="sm"
              className="w-full cursor-pointer gap-1.5 rounded-lg border-zinc-800 bg-zinc-900/50 text-[10px] font-mono uppercase tracking-wider text-zinc-400 transition-all hover:border-zinc-700 hover:bg-zinc-800 hover:text-white h-8 shadow-none"
            >
              <Eye className="h-3 w-3" />
              View
            </Button>
          </Link>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="col-span-2 cursor-pointer gap-1.5 rounded-lg border-red-500/20 bg-red-500/5 text-[10px] font-mono uppercase tracking-wider text-red-400 transition-all hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 h-8 shadow-none mt-1"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-zinc-950 border-zinc-800 font-sans">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">
                  Delete Instance
                </AlertDialogTitle>
                <AlertDialogDescription className="text-zinc-400 text-sm">
                  Are you sure you want to delete{" "}
                  <span className="text-white font-mono">{instance.name}</span>?
                  This action cannot be undone. All data and configuration will
                  be permanently lost.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-4">
                <AlertDialogCancel className="bg-zinc-900/50 text-zinc-300 border-zinc-800 hover:bg-zinc-800 hover:text-white font-mono text-[10px] uppercase tracking-wider px-6 h-9 transition-colors">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(instance.id)}
                  className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 font-mono text-[10px] uppercase tracking-wider px-6 h-9 transition-colors shadow-none"
                >
                  Confirm Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
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
