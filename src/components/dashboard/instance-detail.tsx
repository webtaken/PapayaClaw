"use client";

import { toast } from "sonner";

import { useEffect, useState, useCallback, useMemo } from "react";
import useSWR from "swr";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Server,
  Loader2,
  ExternalLink,
  RefreshCw,
  Check,
  MessageCircle,
  ShieldAlert,
  Plus,
  Radio,
  X,
  Info,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { formatModelInfo, formatChannelInfo, getChannelIcon, getProviderIcon } from "@/lib/ai-config-ui";

const SshTerminal = dynamic(
  () => import("./ssh-terminal").then((mod) => mod.SshTerminal),
  { ssr: false },
);

interface InstanceData {
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

interface PairingRequest {
  code: string;
  senderId: string;
  senderName: string | null;
  timestamp: string;
}

interface StatusData {
  instanceStatus: string;
  hetznerStatus: string | null;
  serverIp: string | null;
  gatewayToken: string | null;
  channels?: string[];
  whatsappNumbers?: string[];
}

const statusConfig: Record<
  string,
  { label: string; className: string; dotClass: string }
> = {
  running: {
    label: "Running",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    dotClass: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]",
  },
  stopped: {
    label: "Stopped",
    className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
    dotClass: "bg-zinc-400",
  },
  deploying: {
    label: "Deploying",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    dotClass: "bg-amber-400 animate-pulse",
  },
  initializing: {
    label: "Initializing",
    className: "border-violet-500/30 bg-violet-500/10 text-violet-400",
    dotClass:
      "bg-violet-400 animate-pulse shadow-[0_0_8px_rgba(167,139,250,0.5)]",
  },
  starting: {
    label: "Starting",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    dotClass: "bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.5)]",
  },
  error: {
    label: "Error",
    className: "border-red-500/30 bg-red-500/10 text-red-500",
    dotClass: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]",
  },
};

const provisioningSteps = [
  { key: "creating", label: "Creating server allocation", minTime: 0 },
  { key: "initializing", label: "Running boot sequence", minTime: 3 },
  { key: "starting", label: "Starting system services", minTime: 8 },
  { key: "running", label: "System online", minTime: 15 },
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
  const t = useTranslations("InstanceDetail");
  const [instance, setInstance] = useState(initialInstance);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  // Telegram pairing state
  const [pairingRequests, setPairingRequests] = useState<PairingRequest[]>([]);
  const [isPairingLoading, setIsPairingLoading] = useState(false);
  const [approvingCode, setApprovingCode] = useState<string | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [activeChannelTab, setActiveChannelTab] = useState<string>(
    instance.channel.split("|")[0] || "telegram",
  );

  const fetcher = (url: string) => fetch(url).then((res) => res.json());

  const { data: statusData, mutate: mutateStatus } = useSWR<StatusData>(
    `/api/instances/${instance.id}/status`,
    fetcher,
    {
      refreshInterval: (data) => {
        // Stop polling once running and no longer deploying
        if (
          data?.hetznerStatus === "running" &&
          data?.instanceStatus !== "deploying"
        ) {
          return 0; // stop polling
        }
        return 10000; // poll every 10s
      },
    },
  );

  const currentStatus = statusData?.instanceStatus || instance.status;
  const currentIp = statusData?.serverIp || instance.providerServerIp;

  const isProvisioning =
    currentStatus === "deploying" ||
    (statusData?.hetznerStatus && statusData.hetznerStatus !== "running");

  const effectiveStatus = statusData?.hetznerStatus || currentStatus;

  const channels = useMemo(() => {
    const live = statusData?.channels;
    if (live && live.length > 0) return live;
    return instance.channel.split("|");
  }, [statusData?.channels, instance.channel]);

  const channelSet = useMemo(() => new Set(channels), [channels]);
  const hasTelegram = channelSet.has("telegram");
  const hasWhatsApp = channelSet.has("whatsapp");

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
      if (res.ok) {
        const data = await res.json();
        setPairingRequests(data.requests || []);
      } else {
        const err = await res.json().catch(() => ({}));
        setPairingError(err.error || "Failed to fetch pairing requests");
      }
    } catch {
      setPairingError("Failed to connect");
    } finally {
      setIsPairingLoading(false);
    }
  }, [instance.id, hasTelegram]);

  const approvePairing = useCallback(
    async (code: string) => {
      setApprovingCode(code);
      try {
        const res = await fetch(`/api/instances/${instance.id}/pairing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        if (res.ok) {
          // Remove the approved request from the list
          setPairingRequests((prev) => prev.filter((r) => r.code !== code));
          toast.success("Pairing approved!", {
            description:
              "You can now start chatting with your agent through Telegram.",
          });
        } else {
          const err = await res.json().catch(() => ({}));
          setPairingError(err.error || "Failed to approve");
        }
      } catch {
        setPairingError("Failed to connect");
      } finally {
        setApprovingCode(null);
      }
    },
    [instance.id],
  );

  // Fetch pairing requests when instance becomes ready (Telegram only)
  useEffect(() => {
    if (hasTelegram && !isProvisioning && currentIp) {
      fetchPairingRequests();
    }
  }, [hasTelegram, isProvisioning, currentIp, fetchPairingRequests]);

  const model = formatModelInfo(instance.model);
  const status = statusConfig[effectiveStatus] || statusConfig.deploying;
  const activeStep = getActiveStep(statusData?.hetznerStatus ?? null);

  return (
    <div className="animate-fade-in-up flex flex-col gap-6 font-sans">
      {/* Top Command Bar */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
        <Link
          href="/dashboard"
          className="group flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/50 group-hover:border-zinc-700">
            <ArrowLeft className="h-3.5 w-3.5" />
          </div>
          <span className="font-medium">Dashboard</span>
        </Link>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={`gap-1.5 rounded-md px-2.5 py-1 text-xs font-mono uppercase tracking-wider ${status.className}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${status.dotClass}`} />
            {status.label}
          </Badge>
        </div>
      </div>

      {/* Telemetry Databand */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
        <div className="flex flex-col gap-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-medium tracking-tight text-white mb-1">
                {instance.name}
              </h1>
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                <span>ID: {instance.id}</span>
                <span className="text-zinc-800">|</span>
                <span>
                  CREATED{" "}
                  {new Date(instance.createdAt).toISOString().split("T")[0]}
                </span>
              </div>
            </div>
            {/* Quick action buttons can go here if needed */}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-800/50 border border-zinc-800/50 rounded-lg overflow-hidden">
            <div className="bg-zinc-950 p-4 flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
                IP Address
              </span>
              <span className="font-mono text-sm text-zinc-200">
                {currentIp || "AWAITING ALLOCATION"}
              </span>
            </div>
            <div className="bg-zinc-950 p-4 flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
                Model
              </span>
              <span className="flex items-center gap-2 text-sm text-zinc-200">
                <span className="text-xs text-zinc-400">{model.icon}</span>
                {model.name}
              </span>
            </div>
            <div className="bg-zinc-950 p-4 flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
                {channels.length === 1 ? "Channel" : "Channels"}
              </span>
              <span className="flex items-center gap-2 text-sm text-zinc-200 flex-wrap">
                {channels.map((ch) => {
                  const info = formatChannelInfo(ch);
                  return (
                    <span key={ch} className="flex items-center gap-1.5" title={info.name}>
                      <span className="text-xs text-zinc-400">{info.icon}</span>
                      <span>{info.name}</span>
                    </span>
                  );
                })}
              </span>
            </div>
            <div className="bg-zinc-950 p-4 flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
                Gateway
              </span>
              <span
                className="font-mono text-sm text-zinc-200 truncate"
                title={instance.cfTunnelHostname || "PENDING TUNNEL"}
              >
                {instance.cfTunnelHostname || "PENDING TUNNEL"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {isProvisioning ? (
        /* The Mono-log (Provisioning Sequence) */
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/50 px-4 py-2.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
            <span className="text-xs font-mono font-medium tracking-wide text-zinc-300">
              SYSTEM BOOT SEQUENCE
            </span>
          </div>
          <div className="p-6 font-mono text-sm space-y-3">
            {provisioningSteps.map((step, i) => {
              const isActive = i === activeStep;
              const isComplete = i < activeStep;
              const isPending = i > activeStep;

              let linePrefix = "[PENDING]";
              let lineClass = "text-zinc-600";
              let animationClass = "";

              if (isComplete) {
                linePrefix = "[   OK  ]";
                lineClass = "text-zinc-400";
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
                  <span className={`${isActive ? "text-violet-300" : ""}`}>
                    {step.label}...
                  </span>
                </div>
              );
            })}

            <div className="mt-8 flex items-center gap-2 text-xs text-zinc-600">
              <span className="inline-block h-2 w-1.5 animate-pulse bg-violet-500/50" />
              <span>Awaiting telemetry broadcast...</span>
            </div>
          </div>
        </div>
      ) : (
        /* Modules Section */
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Dashboard Control Panel Module */}
            {instance.cfTunnelHostname ? (
              <div className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl h-full">
                <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-zinc-400" />
                    <h3 className="text-xs font-mono font-semibold tracking-wide text-zinc-300 uppercase">
                      Gateway Console
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                    <span className="text-[10px] font-mono text-emerald-400 font-medium uppercase tracking-widest">
                      TLS Active
                    </span>
                  </div>
                </div>
                <div className="p-6 flex flex-col justify-between gap-6 flex-1">
                  <p className="text-sm text-zinc-400 leading-relaxed max-w-3xl border-l-[3px] border-emerald-500/30 pl-4 py-1">
                    Access the OpenClaw securely-tunneled web interface to
                    interact with your agent, view internal logs, manage skills,
                    and monitor inference metrics.
                  </p>
                  <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                    <p className="text-xs text-amber-400/90 leading-relaxed font-mono">
                      Do not share this web interface with anyone — this is your
                      secret control panel.
                    </p>
                  </div>
                  <div className="shrink-0 mt-auto">
                    <a
                      href={`https://${instance.cfTunnelHostname}/?token=${encodeURIComponent(instance.botToken)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group"
                    >
                      <Button className="w-full sm:w-auto px-6 bg-zinc-100 text-zinc-950 hover:bg-white font-medium shadow-none h-11 border border-transparent transition-all group-hover:border-zinc-300 gap-2 font-mono text-xs uppercase tracking-wider">
                        <ExternalLink className="h-4 w-4" />
                        Launch Interface
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Channels Module */}
            {currentIp ? (
              <div className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl h-full">
                {/* Header with channel tabs */}
                <div className="border-b border-zinc-800 bg-zinc-900/50">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Radio className="h-4 w-4 text-zinc-400" />
                      <h3 className="text-xs font-mono font-semibold tracking-wide text-zinc-300 uppercase">
                        Channels
                      </h3>
                    </div>
                    {activeChannelTab === "telegram" &&
                    pairingRequests.length > 0 ? (
                      <Badge
                        variant="outline"
                        className="rounded-md px-2 py-0.5 text-[10px] font-mono border-amber-500/30 bg-amber-500/10 text-amber-400"
                      >
                        {pairingRequests.length} PENDING
                      </Badge>
                    ) : null}
                  </div>

                  {/* Channel tabs */}
                  <div className="flex px-4 gap-1 -mb-px">
                    {/* Telegram tab */}
                    <button
                      onClick={() => setActiveChannelTab("telegram")}
                      className={`group relative flex items-center gap-2 px-3 py-2 text-[11px] font-mono font-medium uppercase tracking-wider transition-all ${
                        activeChannelTab === "telegram"
                          ? "text-white"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {getChannelIcon("telegram", "h-3.5 w-3.5")}
                      <span>Telegram</span>
                      {hasTelegram ? (
                        <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                      ) : (
                        <Plus className="h-3 w-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                      )}
                      {activeChannelTab === "telegram" && (
                        <span className="absolute bottom-0 left-0 right-0 h-px bg-white" />
                      )}
                    </button>

                    <div className="w-px bg-zinc-800 my-1.5" />

                    {/* WhatsApp tab */}
                    <button
                      onClick={() => setActiveChannelTab("whatsapp")}
                      className={`group relative flex items-center gap-2 px-3 py-2 text-[11px] font-mono font-medium uppercase tracking-wider transition-all ${
                        activeChannelTab === "whatsapp"
                          ? "text-white"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {getChannelIcon("whatsapp", "h-3.5 w-3.5")}
                      <span>WhatsApp</span>
                      {hasWhatsApp ? (
                        <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                      ) : (
                        <Plus className="h-3 w-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                      )}
                      {activeChannelTab === "whatsapp" && (
                        <span className="absolute bottom-0 left-0 right-0 h-px bg-white" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Tab content */}
                <div className="p-6 flex-1 flex flex-col">
                  {/* ── Telegram tab ── */}
                  {activeChannelTab === "telegram" && (
                    <>
                      {hasTelegram ? (
                        /* Primary Telegram — pairing flow */
                        <>
                          <div className="flex justify-end mb-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={fetchPairingRequests}
                              disabled={isPairingLoading}
                              className="h-6 px-2 text-[10px] font-mono hover:bg-zinc-800 hover:text-white text-zinc-400 border border-zinc-700/50 rounded gap-1"
                            >
                              <RefreshCw
                                className={`h-3 w-3 ${
                                  isPairingLoading ? "animate-spin" : ""
                                }`}
                              />
                              REFRESH
                            </Button>
                          </div>

                          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                            <p className="text-xs text-amber-400/90 leading-relaxed font-mono">
                              If you see pairing codes you don&apos;t recognize,
                              ignore them — do not approve anything. This is the
                              door to your agent.
                            </p>
                          </div>

                          {pairingError ? (
                            <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs font-mono text-red-400">
                              {pairingError}
                            </div>
                          ) : null}

                          {isPairingLoading &&
                          pairingRequests.length === 0 ? (
                            <div className="flex items-center justify-center py-8 gap-2 text-zinc-500">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="text-xs font-mono">
                                Loading pairing requests...
                              </span>
                            </div>
                          ) : pairingRequests.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center flex-1">
                              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900/50 border border-zinc-800/80">
                                <MessageCircle className="h-6 w-6 text-zinc-600" />
                              </div>
                              <p className="text-sm text-zinc-500 font-mono">
                                No pending pairing requests
                              </p>
                              <p className="mt-1 text-xs text-zinc-600 font-mono max-w-xs">
                                Send a message to your Telegram bot to initiate
                                a pairing request
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {pairingRequests.map((req) => (
                                <div
                                  key={req.code}
                                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-3 transition-colors hover:border-zinc-700"
                                >
                                  <div className="flex flex-col gap-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-mono font-medium text-zinc-200 truncate">
                                        {req.senderName ||
                                          `User ${req.senderId}`}
                                      </span>
                                      <span className="text-[10px] font-mono text-zinc-600">
                                        ID: {req.senderId}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] font-mono text-amber-400">
                                        {req.code}
                                      </code>
                                      <span className="text-[10px] font-mono text-zinc-600">
                                        {new Date(
                                          req.timestamp,
                                        ).toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => approvePairing(req.code)}
                                    disabled={approvingCode === req.code}
                                    className="ml-4 shrink-0 h-8 px-3 bg-emerald-600/80 text-white hover:bg-emerald-500 border border-emerald-500/30 font-mono text-[10px] uppercase tracking-wider gap-1.5 shadow-none"
                                  >
                                    {approvingCode === req.code ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Check className="h-3 w-3" />
                                    )}
                                    Approve
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        /* Secondary Telegram — add channel */
                        <div className="flex flex-col items-center justify-center py-6 text-center flex-1">
                          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-900/80 border border-zinc-800/80">
                            {getChannelIcon("telegram", "h-7 w-7 text-zinc-400")}
                          </div>
                          <p className="text-sm font-medium text-zinc-300 mb-1">
                            Add Telegram
                          </p>
                          <p className="text-xs text-zinc-500 font-mono max-w-xs mb-5 leading-relaxed">
                            Connect a Telegram bot to this instance via the Root
                            Terminal. Run the command below to start linking.
                          </p>
                          <code className="rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-2.5 text-[11px] font-mono text-zinc-300 mb-5 select-all">
                            openclaw channels add --channel telegram
                          </code>
                          <div className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 py-2 max-w-sm">
                            <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-zinc-500 mt-0.5" />
                            <p className="text-[10px] text-zinc-500 leading-relaxed font-mono text-left">
                              After adding the channel, pairing requests will
                              appear here for you to approve.
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* ── WhatsApp tab ── */}
                  {activeChannelTab === "whatsapp" && (
                    <>
                      {hasWhatsApp ? (
                        /* Primary WhatsApp — allowlist status */
                        <div className="flex flex-col gap-4">
                          <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                            <Check className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                            <div className="text-xs leading-relaxed font-mono">
                              <p className="text-emerald-400">
                                WhatsApp channel is active with{" "}
                                <span className="font-semibold">
                                  allowlist
                                </span>{" "}
                                policy.
                              </p>
                              <p className="mt-1 text-zinc-500">
                                Only messages from pre-authorized numbers are
                                accepted — no pairing codes needed.
                              </p>
                            </div>
                          </div>

                          {/* Allowlist details */}
                          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 overflow-hidden">
                            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/60 bg-zinc-900/50">
                              <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-500">
                                {t("allowedNumbers")}
                              </span>
                              <span className="text-[10px] font-mono text-zinc-600">
                                {(statusData?.whatsappNumbers ?? []).length}
                              </span>
                            </div>
                            <div className="px-3 py-2.5 space-y-2">
                              {(statusData?.whatsappNumbers ?? []).length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {statusData!.whatsappNumbers!.map((num) => (
                                    <div
                                      key={num}
                                      className="inline-flex items-center gap-1.5 rounded-md bg-zinc-800/60 border border-zinc-700/40 pl-2.5 pr-1 py-1 group"
                                    >
                                      <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.4)]" />
                                      <span className="text-xs font-mono text-zinc-300 leading-none">
                                        {num}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={() => removeWhatsAppNumber(num)}
                                        disabled={removingPhone === num}
                                        className="ml-0.5 h-5 w-5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10"
                                      >
                                        {removingPhone === num ? (
                                          <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                        ) : (
                                          <X className="h-2.5 w-2.5" />
                                        )}
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs font-mono text-zinc-600">
                                  {t("noNumbers")}
                                </p>
                              )}
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const trimmed = newPhone.trim();
                                  if (/^\+\d+$/.test(trimmed)) {
                                    addWhatsAppNumber(trimmed);
                                  }
                                }}
                                className="flex items-center gap-1.5"
                              >
                                <Input
                                  type="tel"
                                  placeholder="+1234567890"
                                  value={newPhone}
                                  onChange={(e) => setNewPhone(e.target.value)}
                                  className="h-7 flex-1 bg-zinc-950 border-zinc-800 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-emerald-500/30"
                                />
                                <Button
                                  type="submit"
                                  size="sm"
                                  disabled={isAddingPhone || !/^\+\d+$/.test(newPhone.trim())}
                                  className="h-7 px-2.5 bg-emerald-600/80 text-white hover:bg-emerald-500 border border-emerald-500/30 font-mono text-[10px] uppercase tracking-wider gap-1 shadow-none"
                                >
                                  {isAddingPhone ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Plus className="h-3 w-3" />
                                  )}
                                </Button>
                              </form>
                              <div className="flex items-start gap-2 pt-1">
                                <Info className="h-3 w-3 shrink-0 text-zinc-500 mt-0.5" />
                                <p className="text-[11px] text-zinc-500 leading-relaxed font-mono">
                                  {t("allowedNumbersInfo")}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Link WhatsApp instructions */}
                          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 overflow-hidden">
                            <div className="px-4 py-2.5 border-b border-zinc-800/60 bg-zinc-900/50">
                              <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-500">
                                Link Device
                              </span>
                            </div>
                            <div className="px-4 py-3 space-y-2">
                              <p className="text-xs text-zinc-400 leading-relaxed font-mono">
                                Link your dedicated WhatsApp number via the Root
                                Terminal:
                              </p>
                              <code className="block rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-[11px] font-mono text-zinc-300 select-all">
                                openclaw channels login --channel whatsapp
                              </code>
                              <p className="text-[10px] text-zinc-600 leading-relaxed font-mono">
                                Scan the QR code with WhatsApp on your dedicated
                                phone. Once linked, messages from your allowed
                                number will reach your agent automatically.
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Secondary WhatsApp — add channel */
                        <div className="flex flex-col items-center justify-center py-6 text-center flex-1">
                          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-900/80 border border-zinc-800/80">
                            {getChannelIcon("whatsapp", "h-7 w-7 text-zinc-400")}
                          </div>
                          <p className="text-sm font-medium text-zinc-300 mb-1">
                            Add WhatsApp
                          </p>
                          <p className="text-xs text-zinc-500 font-mono max-w-xs mb-5 leading-relaxed">
                            Connect a dedicated WhatsApp number using allowlist
                            mode. Messages from your authorized number are
                            accepted automatically — no pairing codes needed.
                          </p>
                          <code className="rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-2.5 text-[11px] font-mono text-zinc-300 mb-5 select-all">
                            openclaw channels add --channel whatsapp
                          </code>
                          <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 max-w-sm">
                            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400 mt-0.5" />
                            <p className="text-[10px] text-emerald-400/80 leading-relaxed font-mono text-left">
                              WhatsApp uses allowlist policy — pre-authorize
                              phone numbers, no approval codes required.
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* SSH Terminal Module */}
          {currentIp ? (
            <div className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-zinc-400" />
                  <h3 className="text-xs font-mono font-semibold tracking-wide text-zinc-300 uppercase">
                    Root Terminal
                  </h3>
                </div>
                {isTerminalOpen ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsTerminalOpen(false)}
                    className="h-6 px-2 text-[10px] font-mono hover:bg-zinc-800 hover:text-white text-zinc-400 border border-zinc-700/50 rounded"
                  >
                    DISCONNECT
                  </Button>
                ) : (
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                    Idle
                  </span>
                )}
              </div>

              <div className="p-0 flex flex-col h-[550px] sm:h-[650px]">
                {!isTerminalOpen ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-zinc-950/50">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-zinc-900/50 border border-zinc-800/80">
                      {getProviderIcon("opencode", "h-8 w-8 text-zinc-500")}
                    </div>
                    <p className="mb-6 max-w-[260px] text-sm text-zinc-400 leading-relaxed font-mono">
                      Secure WebRTC shell protocol. Direct root access to
                      standard input/output.
                    </p>
                    <Button
                      onClick={() => setIsTerminalOpen(true)}
                      className="bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700 hover:text-white font-medium shadow-none gap-2 font-mono text-xs uppercase tracking-wider"
                    >
                      <span className="text-emerald-400">root@</span> Connect
                    </Button>
                  </div>
                ) : (
                  <div className="flex-1 overflow-hidden bg-black w-full h-full p-2">
                    <SshTerminal instanceId={instance.id} />
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
