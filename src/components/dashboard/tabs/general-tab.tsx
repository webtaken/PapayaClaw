"use client";

import dynamic from "next/dynamic";
import { ExternalLink, Loader2, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatModelInfo, formatChannelInfo } from "@/lib/ai-config-ui";
import type { InstanceData } from "../instance-detail";

const ModelProviderModule = dynamic(
  () =>
    import("../model-provider-module").then((mod) => mod.ModelProviderModule),
  { ssr: false },
);

export interface GeneralTabProps {
  instance: InstanceData;
  currentIp: string | null;
  currentStatus: string;
  isProvisioning: boolean;
  effectiveStatus: string;
  channels: string[];
  hetznerStatus: string | null;
  onModelChanged: (newModel: string) => void;
}

const provisioningSteps = [
  { key: "creating", stepKey: "stepCreating" as const },
  { key: "initializing", stepKey: "stepInitializing" as const },
  { key: "starting", stepKey: "stepStarting" as const },
  { key: "running", stepKey: "stepRunning" as const },
];

function getActiveStep(hetznerStatus: string | null): number {
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

export function GeneralTab({
  instance,
  currentIp,
  isProvisioning,
  channels,
  hetznerStatus,
  onModelChanged,
}: GeneralTabProps) {
  const t = useTranslations("InstanceDetail");
  const model = formatModelInfo(instance.model);
  const activeStep = getActiveStep(hetznerStatus);

  if (isProvisioning) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          <span className="text-xs font-mono font-medium tracking-wide text-foreground/80 uppercase">
            {t("provisioning.bannerTitle")}
          </span>
        </div>
        <div className="p-6 font-mono text-sm space-y-3">
          {provisioningSteps.map((step, i) => {
            const isActive = i === activeStep;
            const isComplete = i < activeStep;

            let linePrefix = "[PENDING]";
            let lineClass = "text-muted-foreground/60";
            let animationClass = "";

            if (isComplete) {
              linePrefix = "[   OK  ]";
              lineClass = "text-muted-foreground";
            } else if (isActive) {
              linePrefix = "[WORKING]";
              lineClass = "text-violet-400";
              animationClass = "animate-pulse";
            }

            return (
              <div
                key={step.key}
                className={`flex items-start gap-4 ${lineClass}`}
              >
                <span className={`shrink-0 ${animationClass}`}>
                  {linePrefix}
                </span>
                <span className={isActive ? "text-violet-300" : ""}>
                  {t(`provisioning.${step.stepKey}`)}...
                </span>
              </div>
            );
          })}

          <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground/60">
            <span className="inline-block h-2 w-1.5 animate-pulse bg-violet-500/50" />
            <span>{t("provisioning.awaitingTelemetry")}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Telemetry Databand */}
      <div className="rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-muted/50">
          <div className="bg-card p-4 flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              IP Address
            </span>
            <span className="font-mono text-sm text-foreground/90">
              {currentIp ?? "AWAITING ALLOCATION"}
            </span>
          </div>

          <div className="bg-card p-4 flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Model
            </span>
            <span className="flex items-center gap-2 text-sm text-foreground/90">
              <span className="text-xs text-muted-foreground">
                {model.icon}
              </span>
              {model.name}
            </span>
          </div>

          <div className="bg-card p-4 flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              {channels.length === 1 ? "Channel" : "Channels"}
            </span>
            <span className="flex items-center gap-2 text-sm text-foreground/90 flex-wrap">
              {channels.map((ch) => {
                const info = formatChannelInfo(ch);
                return (
                  <span
                    key={ch}
                    className="flex items-center gap-1.5"
                    title={info.name}
                  >
                    <span className="text-xs text-muted-foreground">
                      {info.icon}
                    </span>
                    <span>{info.name}</span>
                  </span>
                );
              })}
            </span>
          </div>

          <div className="bg-card p-4 flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Gateway
            </span>
            <span
              className="font-mono text-sm text-foreground/90 truncate"
              title={instance.cfTunnelHostname ?? "PENDING TUNNEL"}
            >
              {instance.cfTunnelHostname ?? "PENDING TUNNEL"}
            </span>
          </div>
        </div>
      </div>

      {/* Gateway Console Card + AI Model / Provider Module — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Gateway Console Card */}
        {instance.cfTunnelHostname ? (
          <div className="flex flex-col rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-xs font-mono font-semibold tracking-wide text-foreground/80 uppercase">
                  {t("general.gatewayTitle")}
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <span className="text-xs font-mono text-emerald-400 font-medium uppercase tracking-widest">
                  TLS Active
                </span>
              </div>
            </div>
            <div className="p-6 flex flex-col gap-6">
              <p className="text-sm text-muted-foreground leading-relaxed border-l-[3px] border-emerald-500/30 pl-4 py-1">
                {t("general.gatewayDescription")}
              </p>
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                <p className="text-xs text-amber-400/90 leading-relaxed font-mono">
                  {t("general.gatewayWarning")}
                </p>
              </div>
              <div>
                <a
                  href={`https://${instance.cfTunnelHostname}/?token=${encodeURIComponent(instance.botToken)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group"
                >
                  <Button className="w-full sm:w-auto px-6 bg-foreground text-background hover:bg-foreground/90 font-medium shadow-none h-11 border border-transparent transition-all group-hover:border-border gap-2 font-mono text-xs uppercase tracking-wider">
                    <ExternalLink className="h-4 w-4" />
                    {t("general.gatewayLaunch")}
                  </Button>
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground font-mono">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            <span>{t("general.gatewayPending")}</span>
          </div>
        )}

        {/* AI Model / Provider Module */}
        {currentIp ? (
          <ModelProviderModule
            instanceId={instance.id}
            currentModel={instance.model}
            onModelChanged={onModelChanged}
          />
        ) : null}
      </div>
    </div>
  );
}
