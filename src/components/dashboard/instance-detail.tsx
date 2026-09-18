"use client";

import { toast } from "sonner";

import { useEffect, useState, useCallback, useMemo } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Server,
  Radio,
  LayoutDashboard,
  Plug,
  Bot,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GeneralTab } from "./tabs/general-tab";
import type { GatewayHealth, HealthReason } from "@/lib/gateway-health";
import { ChannelsTab, type PairingRequest } from "./tabs/channels-tab";
import { SshTab } from "./tabs/ssh-tab";
import { IntegrationsTab } from "./tabs/integrations-tab";
import { AgentsTab } from "./tabs/agents-tab";
import { apiErrorMessage, type ApiErrorBody } from "@/lib/api-errors";


export interface InstanceData {
  id: string;
  name: string;
  model: string;
  channel: string;
  botToken: string;
  status: string;
  providerServerIp: string | null;
  cfTunnelHostname: string | null;
  createdAt: string | Date;
}

type TabKey = "general" | "channels" | "ssh" | "integrations" | "agents";

const TABS: readonly { key: TabKey; labelKey: string; icon: LucideIcon }[] = [
  { key: "general", labelKey: "tabs.general", icon: LayoutDashboard },
  { key: "channels", labelKey: "tabs.channels", icon: Radio },
  { key: "ssh", labelKey: "tabs.ssh", icon: Server },
  { key: "integrations", labelKey: "tabs.integrations", icon: Plug },
  { key: "agents", labelKey: "tabs.agents", icon: Bot },
] as const;


interface StatusData {
  instanceStatus: string;
  hetznerStatus: string | null;
  serverIp: string | null;
  gatewayToken: string | null;
  channels?: string[];
  whatsappNumbers?: string[];
  health?: GatewayHealth;
  healthReason?: HealthReason | null;
  gatewayUp?: boolean | null;
  configValid?: boolean | null;
  errorSentinel?: string | null;
}

type BadgeStatus =
  | "running"
  | "degraded"
  | "unknown"
  | "stopped"
  | "stopping"
  | "deploying"
  | "initializing"
  | "starting"
  | "error";

/**
 * Header badge = agent (gateway) health, not VM power.
 * Labels come from i18n `InstanceDetail.status.<key>`.
 */
const statusConfig: Record<BadgeStatus, { className: string; dotClass: string }> = {
  running: {
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    dotClass: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]",
  },
  // VM on, gateway dead or config invalid. Solid dot: a fault, not a transition.
  degraded: {
    className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    dotClass: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]",
  },
  // VM on but we could not reach it — neither alive nor dead.
  unknown: {
    className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
    dotClass: "bg-zinc-400 animate-pulse",
  },
  stopped: {
    className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
    dotClass: "bg-zinc-400",
  },
  stopping: {
    className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
    dotClass: "bg-zinc-400 animate-pulse",
  },
  deploying: {
    className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    dotClass: "bg-amber-400 animate-pulse",
  },
  initializing: {
    className: "border-violet-500/30 bg-violet-500/10 text-violet-400",
    dotClass:
      "bg-violet-400 animate-pulse shadow-[0_0_8px_rgba(167,139,250,0.5)]",
  },
  starting: {
    className: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    dotClass: "bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.5)]",
  },
  error: {
    className: "border-red-500/30 bg-red-500/10 text-red-500",
    dotClass: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]",
  },
};

function isBadgeStatus(value: string): value is BadgeStatus {
  return value in statusConfig;
}

/**
 * Resolves what the header badge shows. Precedence:
 * deploying → VM off → DB error → VM running (gateway health) → other VM states.
 */
function resolveBadgeStatus(
  currentStatus: string,
  hetznerStatus: string | null,
  health: GatewayHealth | undefined,
): BadgeStatus {
  if (currentStatus === "deploying") return "deploying";
  if (hetznerStatus === "off") return "stopped";
  if (currentStatus === "error") return "error";
  if (hetznerStatus === "running") {
    if (health === "degraded") return "degraded";
    if (health === "unknown") return "unknown";
    return "running";
  }
  const raw = hetznerStatus ?? currentStatus;
  return isBadgeStatus(raw) ? raw : "deploying";
}


export function InstanceDetail({
  initialInstance,
}: {
  initialInstance: InstanceData;
}) {
  const t = useTranslations("InstanceDetail");
  const describeApiError = useCallback(
    (body: Partial<ApiErrorBody> | null | undefined) => apiErrorMessage(t, body),
    [t],
  );
  const [instance, setInstance] = useState(initialInstance);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  // Telegram pairing state
  const [pairingRequests, setPairingRequests] = useState<PairingRequest[]>([]);
  const [isPairingLoading, setIsPairingLoading] = useState(false);
  const [approvingCode, setApprovingCode] = useState<string | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [activeChannelTab, setActiveChannelTab] = useState<"telegram" | "whatsapp">(
    (instance.channel.split("|")[0] as "telegram" | "whatsapp") || "telegram",
  );

  const fetcher = (url: string) => fetch(url).then((res) => res.json());

  const { data: statusData, mutate: mutateStatus } = useSWR<StatusData>(
    `/api/instances/${instance.id}/status`,
    fetcher,
    {
      refreshInterval: (data) => {
        if (!data) return 10000;
        if (data.hetznerStatus === "off") return 0; // nothing to watch
        if (
          data.instanceStatus === "deploying" ||
          data.hetznerStatus !== "running"
        ) {
          return 10000; // provisioning / VM transitioning
        }
        // VM up: keep an eye on the gateway. Faster while unhealthy.
        return data.health === "healthy" ? 60000 : 30000;
      },
    },
  );

  const currentStatus = statusData?.instanceStatus || instance.status;
  const currentIp = statusData?.serverIp || instance.providerServerIp;

  const hetznerStatus = statusData?.hetznerStatus ?? null;
  const health = statusData?.health;
  const healthReason = statusData?.healthReason ?? null;

  // Only true setup phases show the provisioning log. A powered-off VM is
  // stopped, not provisioning.
  const isProvisioning =
    currentStatus === "deploying" ||
    hetznerStatus === "initializing" ||
    hetznerStatus === "starting";

  const effectiveStatus = resolveBadgeStatus(
    currentStatus,
    hetznerStatus,
    health,
  );
  const showHealthReason =
    (effectiveStatus === "degraded" || effectiveStatus === "unknown") &&
    healthReason !== null;

  const channels = useMemo(() => {
    const live = statusData?.channels;
    if (live && live.length > 0) return live;
    return instance.channel.split("|");
  }, [statusData?.channels, instance.channel]);

  const channelSet = useMemo(() => new Set(channels), [channels]);
  const hasTelegram = channelSet.has("telegram");

  // WhatsApp number management state
  const [newPhone, setNewPhone] = useState("");
  const [isAddingPhone, setIsAddingPhone] = useState(false);
  const [removingPhone, setRemovingPhone] = useState<string | null>(null);

  const addWhatsAppNumber = useCallback(
    async (phone: string) => {
      setIsAddingPhone(true);
      try {
        const res = await fetch(
          `/api/instances/${instance.id}/whatsapp-numbers`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone }),
          },
        );
        if (res.ok) {
          const data = await res.json();
          mutateStatus(
            (prev) =>
              prev ? { ...prev, whatsappNumbers: data.numbers } : prev,
            false,
          );
          setNewPhone("");
          toast.success("Number added", {
            description: `${phone} has been added to the allowlist.`,
          });
        } else {
          const err = await res.json().catch(() => ({}));
          toast.error(err.error || "Failed to add number");
        }
      } catch {
        toast.error("Failed to connect");
      } finally {
        setIsAddingPhone(false);
      }
    },
    [instance.id, mutateStatus],
  );

  const removeWhatsAppNumber = useCallback(
    async (phone: string) => {
      setRemovingPhone(phone);
      try {
        const res = await fetch(
          `/api/instances/${instance.id}/whatsapp-numbers`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone }),
          },
        );
        if (res.ok) {
          const data = await res.json();
          mutateStatus(
            (prev) =>
              prev ? { ...prev, whatsappNumbers: data.numbers } : prev,
            false,
          );
          toast.success("Number removed", {
            description: `${phone} has been removed from the allowlist.`,
          });
        } else {
          const err = await res.json().catch(() => ({}));
          toast.error(err.error || "Failed to remove number");
        }
      } catch {
        toast.error("Failed to connect");
      } finally {
        setRemovingPhone(null);
      }
    },
    [instance.id, mutateStatus],
  );

  const fetchPairingRequests = useCallback(async () => {
    if (!hasTelegram) return;
    setIsPairingLoading(true);
    setPairingError(null);
    try {
      const res = await fetch(`/api/instances/${instance.id}/pairing?channel=telegram`);
      const body = (await res.json().catch(() => ({}))) as Partial<ApiErrorBody> & {
        requests?: PairingRequest[];
      };
      if (res.ok) {
        setPairingRequests(body.requests ?? []);
      } else {
        setPairingError(describeApiError(body));
      }
    } catch {
      setPairingError(t("errors.network"));
    } finally {
      setIsPairingLoading(false);
    }
  }, [instance.id, hasTelegram, describeApiError, t]);

  const approvePairing = useCallback(
    async (code: string) => {
      setApprovingCode(code);
      setPairingError(null);
      try {
        const res = await fetch(`/api/instances/${instance.id}/pairing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, channel: "telegram" }),
        });
        if (res.ok) {
          setPairingRequests((prev) => prev.filter((r) => r.code !== code));
          toast.success(t("pairing.approvedTitle"), {
            description: t("pairing.approvedDescription"),
          });
        } else {
          const body = (await res.json().catch(() => ({}))) as Partial<ApiErrorBody>;
          setPairingError(describeApiError(body));
        }
      } catch {
        setPairingError(t("errors.network"));
      } finally {
        setApprovingCode(null);
      }
    },
    [instance.id, describeApiError, t],
  );

  // Fetch pairing requests when instance becomes ready (Telegram only)
  useEffect(() => {
    if (hasTelegram && !isProvisioning && currentIp) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- pre-existing fetch-on-ready; the loading flag is intentional. TODO: migrate to SWR like tabs/agents-tab.tsx
      fetchPairingRequests();
    }
  }, [hasTelegram, isProvisioning, currentIp, fetchPairingRequests]);

  const status = statusConfig[effectiveStatus];

  const pendingPairingCount = pairingRequests.length;

  return (
    <div className="animate-fade-in-up flex flex-col gap-6 font-sans">
      {/* Persistent Header — outside Tabs, always visible */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <Link
          href="/dashboard"
          className="group flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground/80"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-muted/50 group-hover:border-border">
            <ArrowLeft className="h-3.5 w-3.5" />
          </div>
          <span className="font-medium">Dashboard</span>
        </Link>
        <div className="flex flex-col items-end gap-1">
          <Badge
            variant="outline"
            className={`gap-1.5 rounded-md px-2.5 py-1 text-xs font-mono uppercase tracking-wider ${status.className}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${status.dotClass}`} />
            {t(`status.${effectiveStatus}`)}
          </Badge>
          {showHealthReason && healthReason ? (
            <span className="text-xs text-muted-foreground text-right">
              {t(`healthReason.${healthReason}`)}
              {statusData?.errorSentinel &&
              statusData.errorSentinel !== healthReason ? (
                <span className="ml-1.5 font-mono text-muted-foreground/60">
                  [{statusData.errorSentinel}]
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
      </div>

      {/* Instance identity block */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-foreground mb-1">
            {instance.name}
          </h1>
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span>ID: {instance.id}</span>
            <span className="text-border">|</span>
            <span>
              CREATED{" "}
              {new Date(instance.createdAt).toISOString().split("T")[0]}
            </span>
          </div>
        </div>
      </div>

      {/* Tab shell */}
      <Tabs defaultValue="general" className="w-full">
        <div className="overflow-x-auto">
          <TabsList className="h-auto gap-1 rounded-none border-b border-border bg-transparent p-0 w-full justify-start">
            {TABS.map(({ key, labelKey, icon: Icon }) => (
              <TabsTrigger
                key={key}
                value={key}
                className="relative gap-2 rounded-none border-b-2 border-transparent px-4 py-2.5 text-xs font-mono uppercase tracking-wider text-muted-foreground transition-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                <span>{t(labelKey)}</span>
                {key === "channels" && pendingPairingCount > 0 ? (
                  <Badge
                    variant="outline"
                    className="ml-1 rounded-full border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-xs font-mono text-amber-400"
                    aria-label={t("tabs.channelsAttentionAria", { count: pendingPairingCount })}
                  >
                    {pendingPairingCount}
                  </Badge>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="general" className="mt-6">
          <GeneralTab
            instance={instance}
            currentIp={currentIp}
            currentStatus={currentStatus}
            isProvisioning={isProvisioning}
            effectiveStatus={effectiveStatus}
            channels={channels}
            hetznerStatus={hetznerStatus}
            health={health ?? null}
            healthReason={healthReason}
            onRestarted={() => mutateStatus()}
            onModelChanged={(newModel) =>
              setInstance((prev) => ({ ...prev, model: newModel }))
            }
          />
        </TabsContent>

        <TabsContent value="channels" className="mt-6">
          <ChannelsTab
            instanceId={instance.id}
            currentIp={currentIp}
            isProvisioning={isProvisioning}
            channelSet={channelSet}
            activeChannelTab={activeChannelTab}
            setActiveChannelTab={setActiveChannelTab}
            pairingRequests={pairingRequests}
            isPairingLoading={isPairingLoading}
            pairingError={pairingError}
            approvingCode={approvingCode}
            onRefreshPairing={fetchPairingRequests}
            onApprovePairing={approvePairing}
            whatsappNumbers={statusData?.whatsappNumbers ?? []}
            newPhone={newPhone}
            setNewPhone={setNewPhone}
            isAddingPhone={isAddingPhone}
            removingPhone={removingPhone}
            onAddWhatsAppNumber={addWhatsAppNumber}
            onRemoveWhatsAppNumber={removeWhatsAppNumber}
          />
        </TabsContent>

        <TabsContent value="ssh" className="mt-6">
          <SshTab
            instanceId={instance.id}
            currentIp={currentIp}
            isProvisioning={isProvisioning}
            isTerminalOpen={isTerminalOpen}
            setIsTerminalOpen={setIsTerminalOpen}
          />
        </TabsContent>

        <TabsContent value="integrations" className="mt-6">
          <IntegrationsTab />
        </TabsContent>

        <TabsContent value="agents" className="mt-6">
          <AgentsTab
            instanceId={instance.id}
            isProvisioning={isProvisioning}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
