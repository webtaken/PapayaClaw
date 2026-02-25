"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Server, Cpu, Loader2 } from "lucide-react";
import Link from "next/link";
import { ClaudeAI } from "@/components/icons/claudeai";
import { OpenAI } from "@/components/icons/openai";
import { MistralAI } from "@/components/icons/mistralai";
import { OpenRouter } from "@/components/icons/openrouter";
import { OpenCode } from "@/components/icons/opencode";
import Image from "next/image";

interface InstanceData {
  id: string;
  name: string;
  model: string;
  channel: string;
  status: string;
  providerServerIp: string | null;
  createdAt: string | Date; // Modified to accept Date directly
}

interface StatusData {
  instanceStatus: string;
  hetznerStatus: string | null;
  serverIp: string | null;
}

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

const channelLabels: Record<string, { name: string; icon: string }> = {
  telegram: { name: "Telegram", icon: "✈️" },
  discord: { name: "Discord", icon: "🎮" },
  whatsapp: { name: "WhatsApp", icon: "💬" },
  slack: { name: "Slack", icon: "💼" },
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
  initializing: {
    label: "Initializing",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    dotClass: "bg-amber-400 animate-pulse",
  },
  starting: {
    label: "Starting",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    dotClass: "bg-blue-400 animate-pulse",
  },
  error: {
    label: "Error",
    className: "border-red-500/30 bg-red-500/10 text-red-400",
    dotClass: "bg-red-400",
  },
};

const provisioningSteps = [
  { key: "creating", label: "Creating server", minTime: 0 },
  { key: "initializing", label: "Initializing VPS", minTime: 3 },
  { key: "starting", label: "Booting up", minTime: 8 },
  { key: "running", label: "Server online", minTime: 15 },
];

function getActiveStep(hetznerStatus: string | null): number {
  if (!hetznerStatus) return 0;
  switch (hetznerStatus) {
    case "initializing":
      return 1;
    case "starting":
      return 2;
    case "running":
      return 3;
    default:
      return 0;
  }
}

export function InstanceDetail({
  initialInstance,
}: {
  initialInstance: InstanceData;
}) {
  const [instance, setInstance] = useState(initialInstance);
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  const isProvisioning =
    instance.status === "deploying" ||
    (statusData?.hetznerStatus && statusData.hetznerStatus !== "running");

  const effectiveStatus = statusData?.hetznerStatus || instance.status;

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/instances/${instance.id}/status`);
      if (res.ok) {
        const data: StatusData = await res.json();
        setStatusData(data);

        // Update instance status if it changed
        if (data.instanceStatus !== instance.status) {
          setInstance((prev) => ({ ...prev, status: data.instanceStatus }));
        }
        if (data.serverIp && !instance.providerServerIp) {
          setInstance((prev) => ({ ...prev, providerServerIp: data.serverIp }));
        }

        // Stop polling once server is running and instance is no longer deploying
        if (
          data.hetznerStatus === "running" &&
          data.instanceStatus !== "deploying"
        ) {
          setIsPolling(false);
        }
      }
    } catch (error) {
      console.error("Status poll failed:", error);
    }
  }, [instance.id, instance.status, instance.providerServerIp]);

  useEffect(() => {
    // Initial poll
    pollStatus();

    if (!isPolling) return;

    const interval = setInterval(pollStatus, 5000);
    return () => clearInterval(interval);
  }, [pollStatus, isPolling]);

  const model = formatModelInfo(instance.model);
  const channel = channelLabels[instance.channel] || {
    name: instance.channel,
    icon: "💬",
  };
  const status = statusConfig[effectiveStatus] || statusConfig.deploying;
  const activeStep = getActiveStep(statusData?.hetznerStatus ?? null);

  return (
    <div className="animate-fade-in-up">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* Instance header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {instance.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Created{" "}
            {new Date(instance.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
        <Badge
          variant="outline"
          className={`gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${status.className}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${status.dotClass}`} />
          {status.label}
        </Badge>
      </div>

      {/* Provisioning state */}
      {isProvisioning ? (
        <div className="card-glow rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8">
          <div className="flex flex-col items-center text-center">
            {/* Spinner */}
            <div className="relative mb-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-violet-500/10">
                <Loader2 className="h-10 w-10 animate-spin text-violet-400" />
              </div>
              <div className="absolute -inset-2 animate-pulse rounded-3xl bg-violet-500/5" />
            </div>

            <h2 className="mb-2 text-lg font-semibold text-white">
              Provisioning your server…
            </h2>
            <p className="mb-8 max-w-md text-sm text-zinc-400">
              Your OpenClaw instance is being set up. This usually takes 1–2
              minutes. You can stay on this page — it will update automatically.
            </p>

            {/* Progress steps */}
            <div className="w-full max-w-sm space-y-3">
              {provisioningSteps.map((step, i) => {
                const isActive = i === activeStep;
                const isComplete = i < activeStep;
                const isPending = i > activeStep;

                return (
                  <div
                    key={step.key}
                    className={`flex items-center gap-3 rounded-xl px-4 py-2.5 transition-all duration-500 ${
                      isActive
                        ? "bg-violet-500/10 border border-violet-500/20"
                        : isComplete
                          ? "bg-green-500/5"
                          : "opacity-40"
                    }`}
                  >
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all duration-500 ${
                        isComplete
                          ? "bg-green-500 text-white"
                          : isActive
                            ? "bg-violet-500 text-white shadow-lg shadow-violet-500/25"
                            : "bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      {isComplete ? "✓" : i + 1}
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        isActive
                          ? "text-violet-300"
                          : isComplete
                            ? "text-green-400"
                            : "text-zinc-500"
                      }`}
                    >
                      {step.label}
                    </span>
                    {isActive && (
                      <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-violet-400" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Running / Ready state — show instance details */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Server Info Card */}
          <div className="card-glow rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Server className="h-4 w-4 text-violet-400" />
              <h3 className="text-sm font-semibold text-white">Server Info</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Status</span>
                <Badge
                  variant="outline"
                  className={`gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${status.dotClass}`}
                  />
                  {status.label}
                </Badge>
              </div>
              <div className="h-px bg-zinc-800" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">IP Address</span>
                <span className="font-mono text-sm text-zinc-300">
                  {instance.providerServerIp || "—"}
                </span>
              </div>
              <div className="h-px bg-zinc-800" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Provider</span>
                <span className="text-sm text-zinc-300">Hetzner Cloud</span>
              </div>
            </div>
          </div>

          {/* Configuration Card */}
          <div className="card-glow rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Cpu className="h-4 w-4 text-violet-400" />
              <h3 className="text-sm font-semibold text-white">
                Configuration
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">AI Model</span>
                <span className="flex items-center gap-1.5 text-sm text-zinc-300">
                  <span className="text-xs">{model.icon}</span>
                  {model.name}
                </span>
              </div>
              <div className="h-px bg-zinc-800" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Channel</span>
                <span className="flex items-center gap-1.5 text-sm text-zinc-300">
                  <span className="text-xs">{channel.icon}</span>
                  {channel.name}
                </span>
              </div>
              <div className="h-px bg-zinc-800" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Created</span>
                <span className="text-sm text-zinc-300">
                  {new Date(instance.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card-glow col-span-full rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h3 className="mb-4 text-sm font-semibold text-white">
              Quick Actions
            </h3>
            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard">
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer gap-1.5 rounded-lg border-zinc-700 bg-zinc-800/50 text-xs text-zinc-300 transition-all hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
