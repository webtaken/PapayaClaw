"use client";

import { useState } from "react";
import type { Instance } from "./dashboard-content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Square, Play, Trash2, Shield, Eye } from "lucide-react";
import { PairingDialog } from "./pairing-dialog";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatModelInfo, formatChannelInfo } from "@/lib/ai-config-ui";

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
  const channels = instance.channel.split("|");
  const t = useTranslations("InstanceCard");

  const statusConfig: Record<
    string,
    { label: string; className: string; dotClass: string }
  > = {
    running: {
      label: t("running"),
      className: "border-green-500/30 bg-green-500/10 text-green-400",
      dotClass: "bg-green-400",
    },
    stopped: {
      label: t("stopped"),
      className: "border-red-500/30 bg-red-500/10 text-red-400",
      dotClass: "bg-red-400",
    },
    deploying: {
      label: t("deploying"),
      className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
      dotClass: "bg-amber-400 animate-pulse",
    },
    error: {
      label: t("error"),
      className: "border-red-500/30 bg-red-500/10 text-red-400",
      dotClass: "bg-red-400",
    },
  };

  const status = statusConfig[instance.status] || statusConfig.stopped;
  const isRunning = instance.status === "running";
  const isDeploying = instance.status === "deploying";
  const hasTelegram = channels.includes("telegram");
  const [pairingOpen, setPairingOpen] = useState(false);

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card shadow-2xl h-full transition-all duration-300 hover:border-border">
      {/* Top row: name + status */}
      <div className="flex items-center justify-between border-b border-border/80 bg-muted/20 px-4 py-3">
        <div className="flex flex-col min-w-0 pr-3">
          <h3 className="text-sm font-medium tracking-tight text-foreground mb-0.5 truncate">
            {instance.name}
          </h3>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest truncate">
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
        <div className="grid grid-cols-2 gap-px bg-muted/50 border border-border/50 rounded-lg overflow-hidden shrink-0">
          <div className="bg-card/80 p-3 flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              {t("model")}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-foreground/80">
              <span className="text-[10px] text-muted-foreground shrink-0">
                {model.icon}
              </span>
              <span className="truncate">{model.name}</span>
            </span>
          </div>
          <div className="bg-card/80 p-3 flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              {channels.length === 1 ? t("channel") : t("channel")}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-foreground/80 flex-wrap">
              {channels.map((ch) => {
                const info = formatChannelInfo(ch);
                return (
                  <span key={ch} className="flex items-center gap-1" title={info.name}>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {info.icon}
                    </span>
                    <span className="truncate">{info.name}</span>
                  </span>
                );
              })}
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
              className="cursor-pointer gap-1.5 rounded-lg border-border bg-muted/50 text-[10px] font-mono uppercase tracking-wider text-muted-foreground transition-all hover:border-border hover:bg-muted hover:text-foreground h-8 shadow-none"
            >
              {isRunning ? (
                <>
                  <Square className="h-3 w-3" />
                  {t("stop")}
                </>
              ) : (
                <>
                  <Play className="h-3 w-3" />
                  {t("start")}
                </>
              )}
            </Button>
          )}

          {isRunning && hasTelegram && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPairingOpen(true)}
              className="cursor-pointer gap-1.5 rounded-lg border-amber-500/20 bg-amber-500/5 text-[10px] font-mono uppercase tracking-wider text-amber-500/90 transition-all hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-400 h-8 shadow-none"
            >
              <Shield className="h-3 w-3" />
              {t("pairing")}
            </Button>
          )}

          <Link
            href={`/dashboard/${instance.id}`}
            className={
              !isDeploying && (!isRunning || !hasTelegram)
                ? "col-span-1"
                : isDeploying
                  ? "col-span-2"
                  : "col-span-2"
            }
          >
            <Button
              variant="outline"
              size="sm"
              className="w-full cursor-pointer gap-1.5 rounded-lg border-border bg-muted/50 text-[10px] font-mono uppercase tracking-wider text-muted-foreground transition-all hover:border-border hover:bg-muted hover:text-foreground h-8 shadow-none"
            >
              <Eye className="h-3 w-3" />
              {t("view")}
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
                {t("delete")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-border font-sans">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-foreground">
                  {t("deleteTitle")}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground text-sm">
                  {t("deleteDescription")}{" "}
                  <span className="text-foreground font-mono">{instance.name}</span>
                  {t("deleteDescriptionEnd")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-4">
                <AlertDialogCancel className="bg-muted/50 text-foreground/80 border-border hover:bg-muted hover:text-foreground font-mono text-[10px] uppercase tracking-wider px-6 h-9 transition-colors">
                  {t("cancel")}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(instance.id)}
                  className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 font-mono text-[10px] uppercase tracking-wider px-6 h-9 transition-colors shadow-none"
                >
                  {t("confirmDelete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Pairing Dialog */}
      {hasTelegram && (
        <PairingDialog
          open={pairingOpen}
          onOpenChange={setPairingOpen}
          instanceId={instance.id}
        />
      )}
    </div>
  );
}
