"use client";

import {
  Loader2,
  RefreshCw,
  ShieldAlert,
  MessageCircle,
  Check,
  Plus,
  X,
  Info,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getChannelIcon } from "@/lib/ai-config-ui";

export interface PairingRequest {
  code: string;
  senderId: string;
  senderName: string | null;
  timestamp: string;
}

export interface ChannelsTabProps {
  instanceId: string;
  currentIp: string | null;
  isProvisioning: boolean;
  channelSet: Set<string>;
  activeChannelTab: "telegram" | "whatsapp";
  setActiveChannelTab: (c: "telegram" | "whatsapp") => void;

  // Telegram
  pairingRequests: PairingRequest[];
  isPairingLoading: boolean;
  pairingError: string | null;
  approvingCode: string | null;
  onRefreshPairing: () => void;
  onApprovePairing: (code: string) => void;

  // WhatsApp
  whatsappNumbers: string[];
  newPhone: string;
  setNewPhone: (v: string) => void;
  isAddingPhone: boolean;
  removingPhone: string | null;
  onAddWhatsAppNumber: (phone: string) => void;
  onRemoveWhatsAppNumber: (phone: string) => void;
}

export function ChannelsTab({
  currentIp,
  isProvisioning,
  channelSet,
  activeChannelTab,
  setActiveChannelTab,
  pairingRequests,
  isPairingLoading,
  pairingError,
  approvingCode,
  onRefreshPairing,
  onApprovePairing,
  whatsappNumbers,
  newPhone,
  setNewPhone,
  isAddingPhone,
  removingPhone,
  onAddWhatsAppNumber,
  onRemoveWhatsAppNumber,
}: ChannelsTabProps) {
  const t = useTranslations("InstanceDetail");

  const hasTelegram = channelSet.has("telegram");
  const hasWhatsApp = channelSet.has("whatsapp");

  if (!currentIp || isProvisioning) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-8 text-sm text-muted-foreground font-mono">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        <span>{t("channels.notReady")}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card shadow-2xl">
      {/* Channel sub-tab header */}
      <div className="border-b border-border bg-muted/50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold tracking-wide text-foreground/80 uppercase">
              Channels
            </span>
          </div>
          {activeChannelTab === "telegram" && pairingRequests.length > 0 ? (
            <Badge
              variant="outline"
              className="rounded-md px-2 py-0.5 text-[10px] font-mono border-amber-500/30 bg-amber-500/10 text-amber-400"
            >
              {pairingRequests.length} PENDING
            </Badge>
          ) : null}
        </div>

        {/* Sub-tab strip */}
        <div className="flex px-4 gap-1 -mb-px">
          <button
            onClick={() => setActiveChannelTab("telegram")}
            className={`group relative flex items-center gap-2 px-3 py-2 text-[11px] font-mono font-medium uppercase tracking-wider transition-all ${
              activeChannelTab === "telegram"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground/80"
            }`}
          >
            {getChannelIcon("telegram", "h-3.5 w-3.5")}
            <span>Telegram</span>
            {hasTelegram ? (
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
            ) : (
              <Plus className="h-3 w-3 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
            )}
            {activeChannelTab === "telegram" && (
              <span className="absolute bottom-0 left-0 right-0 h-px bg-foreground" />
            )}
          </button>

          <div className="w-px bg-border my-1.5" />

          <button
            onClick={() => setActiveChannelTab("whatsapp")}
            className={`group relative flex items-center gap-2 px-3 py-2 text-[11px] font-mono font-medium uppercase tracking-wider transition-all ${
              activeChannelTab === "whatsapp"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground/80"
            }`}
          >
            {getChannelIcon("whatsapp", "h-3.5 w-3.5")}
            <span>WhatsApp</span>
            {hasWhatsApp ? (
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
            ) : (
              <Plus className="h-3 w-3 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
            )}
            {activeChannelTab === "whatsapp" && (
              <span className="absolute bottom-0 left-0 right-0 h-px bg-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Sub-tab content */}
      <div className="p-6 flex-1 flex flex-col">
        {/* ── Telegram ── */}
        {activeChannelTab === "telegram" && (
          <>
            {hasTelegram ? (
              <>
                <div className="flex justify-end mb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRefreshPairing}
                    disabled={isPairingLoading}
                    className="h-6 px-2 text-[10px] font-mono hover:bg-muted hover:text-foreground text-muted-foreground border border-border/50 rounded gap-1"
                  >
                    <RefreshCw className={`h-3 w-3 ${isPairingLoading ? "animate-spin" : ""}`} />
                    REFRESH
                  </Button>
                </div>

                <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                  <p className="text-xs text-amber-400/90 leading-relaxed font-mono">
                    If you see pairing codes you don&apos;t recognize, ignore
                    them — do not approve anything. This is the door to your
                    agent.
                  </p>
                </div>

                {pairingError ? (
                  <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs font-mono text-red-400">
                    {pairingError}
                  </div>
                ) : null}

                {isPairingLoading && pairingRequests.length === 0 ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs font-mono">Loading pairing requests...</span>
                  </div>
                ) : pairingRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center flex-1">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50 border border-border/80">
                      <MessageCircle className="h-6 w-6 text-muted-foreground/60" />
                    </div>
                    <p className="text-sm text-muted-foreground font-mono">
                      No pending pairing requests
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/60 font-mono max-w-xs">
                      Send a message to your Telegram bot to initiate a pairing
                      request
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pairingRequests.map((req) => (
                      <div
                        key={req.code}
                        className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3 transition-colors hover:border-border"
                      >
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-medium text-foreground/90 truncate">
                              {req.senderName ?? `User ${req.senderId}`}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground/60">
                              ID: {req.senderId}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-amber-400">
                              {req.code}
                            </code>
                            <span className="text-[10px] font-mono text-muted-foreground/60">
                              {new Date(req.timestamp).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => onApprovePairing(req.code)}
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
              <div className="flex flex-col items-center justify-center py-6 text-center flex-1">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-muted/80 border border-border/80">
                  {getChannelIcon("telegram", "h-7 w-7 text-muted-foreground")}
                </div>
                <p className="text-sm font-medium text-foreground/80 mb-1">Add Telegram</p>
                <p className="text-xs text-muted-foreground font-mono max-w-xs mb-5 leading-relaxed">
                  Connect a Telegram bot to this instance via the Root Terminal.
                  Run the command below to start linking.
                </p>
                <code className="rounded-lg bg-muted border border-border px-4 py-2.5 text-[11px] font-mono text-foreground/80 mb-5 select-all">
                  openclaw channels add --channel telegram
                </code>
                <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 max-w-sm">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed font-mono text-left">
                    After adding the channel, pairing requests will appear here
                    for you to approve.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── WhatsApp ── */}
        {activeChannelTab === "whatsapp" && (
          <>
            {hasWhatsApp ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                  <Check className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                  <div className="text-xs leading-relaxed font-mono">
                    <p className="text-emerald-400">
                      WhatsApp channel is active with{" "}
                      <span className="font-semibold">allowlist</span> policy.
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Only messages from pre-authorized numbers are accepted —
                      no pairing codes needed.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-muted/50">
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground">
                      {t("allowedNumbers")}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground/60">
                      {whatsappNumbers.length}
                    </span>
                  </div>
                  <div className="px-3 py-2.5 space-y-2">
                    {whatsappNumbers.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {whatsappNumbers.map((num) => (
                          <div
                            key={num}
                            className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 border border-border/40 pl-2.5 pr-1 py-1 group"
                          >
                            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.4)]" />
                            <span className="text-xs font-mono text-foreground/80 leading-none">
                              {num}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => onRemoveWhatsAppNumber(num)}
                              disabled={removingPhone === num}
                              className="ml-0.5 h-5 w-5 text-muted-foreground/60 hover:text-red-400 hover:bg-red-500/10"
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
                      <p className="text-xs font-mono text-muted-foreground/60">
                        {t("noNumbers")}
                      </p>
                    )}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const trimmed = newPhone.trim();
                        if (/^\+\d+$/.test(trimmed)) {
                          onAddWhatsAppNumber(trimmed);
                        }
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <Input
                        type="tel"
                        placeholder="+1234567890"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        className="h-7 flex-1 bg-card border-border text-xs font-mono text-foreground/90 placeholder:text-muted-foreground/60 focus-visible:ring-emerald-500/30"
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
                      <Info className="h-3 w-3 shrink-0 text-muted-foreground mt-0.5" />
                      <p className="text-[11px] text-muted-foreground leading-relaxed font-mono">
                        {t("allowedNumbersInfo")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border/60 bg-muted/50">
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground">
                      Link Device
                    </span>
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    <p className="text-xs text-muted-foreground leading-relaxed font-mono">
                      Link your dedicated WhatsApp number via the Root Terminal:
                    </p>
                    <code className="block rounded-lg bg-card border border-border px-3 py-2 text-[11px] font-mono text-foreground/80 select-all">
                      openclaw channels login --channel whatsapp
                    </code>
                    <p className="text-[10px] text-muted-foreground/60 leading-relaxed font-mono">
                      Scan the QR code with WhatsApp on your dedicated phone.
                      Once linked, messages from your allowed number will reach
                      your agent automatically.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center flex-1">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-muted/80 border border-border/80">
                  {getChannelIcon("whatsapp", "h-7 w-7 text-muted-foreground")}
                </div>
                <p className="text-sm font-medium text-foreground/80 mb-1">Add WhatsApp</p>
                <p className="text-xs text-muted-foreground font-mono max-w-xs mb-5 leading-relaxed">
                  Connect a dedicated WhatsApp number using allowlist mode.
                  Messages from your authorized number are accepted
                  automatically — no pairing codes needed.
                </p>
                <code className="rounded-lg bg-muted border border-border px-4 py-2.5 text-[11px] font-mono text-foreground/80 mb-5 select-all">
                  openclaw channels add --channel whatsapp
                </code>
                <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 max-w-sm">
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400 mt-0.5" />
                  <p className="text-[10px] text-emerald-400/80 leading-relaxed font-mono text-left">
                    WhatsApp uses allowlist policy — pre-authorize phone
                    numbers, no approval codes required.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
