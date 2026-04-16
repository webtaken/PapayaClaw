"use client";

import dynamic from "next/dynamic";
import { Loader2, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { getProviderIcon } from "@/lib/ai-config-ui";

const SshTerminal = dynamic(
  () => import("../ssh-terminal").then((m) => m.SshTerminal),
  { ssr: false },
);

export interface SshTabProps {
  instanceId: string;
  currentIp: string | null;
  isProvisioning: boolean;
  isTerminalOpen: boolean;
  setIsTerminalOpen: (v: boolean) => void;
}

export function SshTab({
  instanceId,
  currentIp,
  isProvisioning,
  isTerminalOpen,
  setIsTerminalOpen,
}: SshTabProps) {
  const t = useTranslations("InstanceDetail");

  if (!currentIp || isProvisioning) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-8 text-sm text-muted-foreground font-mono">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        <span>{t("ssh.notReady")}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card shadow-2xl">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-semibold tracking-wide text-foreground/80 uppercase">
            {t("ssh.title")}
          </span>
        </div>
        {isTerminalOpen ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsTerminalOpen(false)}
            className="h-6 px-2 text-[10px] font-mono hover:bg-muted hover:text-foreground text-muted-foreground border border-border/50 rounded uppercase tracking-wider"
          >
            {t("ssh.disconnect")}
          </Button>
        ) : (
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            {t("ssh.idleLabel")}
          </span>
        )}
      </div>

      <div className="flex flex-col h-[550px] sm:h-[650px]">
        {!isTerminalOpen ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-card/50">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-muted/50 border border-border/80">
              {getProviderIcon("opencode", "h-8 w-8 text-muted-foreground")}
            </div>
            <p className="mb-4 max-w-[260px] text-sm text-muted-foreground leading-relaxed font-mono">
              {t("ssh.description")}
            </p>
            <div className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground/60 font-mono">
              <Info className="h-3 w-3 shrink-0" />
              <span>{t("ssh.reconnectNotice")}</span>
            </div>
            <Button
              onClick={() => setIsTerminalOpen(true)}
              className="bg-muted text-foreground/90 hover:bg-muted border border-border hover:text-foreground font-medium shadow-none gap-2 font-mono text-xs uppercase tracking-wider"
            >
              <span className="text-emerald-400">root@</span>{" "}
              {t("ssh.connect")}
            </Button>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden bg-black w-full h-full p-2">
            <SshTerminal instanceId={instanceId} />
          </div>
        )}
      </div>
    </div>
  );
}
