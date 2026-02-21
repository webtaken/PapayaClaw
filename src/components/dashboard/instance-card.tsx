"use client";

import type { Instance } from "./dashboard-content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Square, Play, Trash2 } from "lucide-react";

const modelLabels: Record<string, { name: string; icon: string }> = {
  "claude-opus-4.5": { name: "Claude Opus 4.5", icon: "🟣" },
  "gpt-5.2": { name: "GPT-5.2", icon: "🟢" },
  "gemini-3-flash": { name: "Gemini 3 Flash Preview", icon: "🔵" },
  custom: { name: "Custom Model", icon: "⚪" },
};

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
  const model = modelLabels[instance.model] || {
    name: instance.model,
    icon: "⚪",
  };
  const channel = channelLabels[instance.channel] || {
    name: instance.channel,
    icon: "💬",
  };
  const status = statusConfig[instance.status] || statusConfig.stopped;

  const isRunning = instance.status === "running";
  const isDeploying = instance.status === "deploying";

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
    </div>
  );
}
