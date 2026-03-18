"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, RefreshCw, Users, Shield } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";

interface PairingRequest {
  code: string;
  senderId: string;
  senderName: string | null;
  timestamp: string;
}

export function PairingDialog({
  open,
  onOpenChange,
  instanceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
}) {
  const [requests, setRequests] = useState<PairingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("PairingDialog");
  const locale = useLocale();

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/instances/${instanceId}/pairing`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to load pairing requests");
      }
    } catch {
      setError("Failed to connect");
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    if (open) {
      fetchRequests();
    }
  }, [open, fetchRequests]);

  const handleApprove = async (code: string) => {
    setApproving(code);
    try {
      const res = await fetch(`/api/instances/${instanceId}/pairing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.code !== code));
      } else {
        const data = await res.json();
        setError(data.error || "Failed to approve");
      }
    } catch {
      setError("Failed to connect");
    } finally {
      setApproving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-zinc-800 bg-zinc-900 p-0">
        <DialogHeader className="border-b border-zinc-800 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-white">
            <Shield className="h-5 w-5 text-violet-400" />
            {t("title")}
          </DialogTitle>
          <p className="mt-1 text-sm text-zinc-400">
            {t("subtitle")}
          </p>
        </DialogHeader>

        <div className="px-6 py-4">
          {/* Error banner */}
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-10">
              <RefreshCw className="mb-3 h-6 w-6 animate-spin text-violet-400" />
              <p className="text-sm text-zinc-400">{t("connecting")}</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && requests.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/50">
                <Users className="h-6 w-6 text-zinc-500" />
              </div>
              <p className="text-sm font-medium text-zinc-300">
                {t("noPending")}
              </p>
              <p className="mt-1 text-center text-xs text-zinc-500">
                {t("noPendingDescription")}
              </p>
            </div>
          )}

          {/* Request list */}
          {!loading && requests.length > 0 && (
            <div className="space-y-3">
              {requests.map((req) => (
                <div
                  key={req.code}
                  className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-800/30 px-4 py-3 transition-all duration-200"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="rounded-md border-violet-500/30 bg-violet-500/10 px-2 py-0.5 font-mono text-xs font-semibold tracking-wider text-violet-300"
                      >
                        {req.code}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-xs text-zinc-500">
                      {req.senderName ? (
                        <span className="text-zinc-400">{req.senderName}</span>
                      ) : (
                        <span>{t("user")} {req.senderId}</span>
                      )}
                      {req.timestamp && (
                        <>
                          {" · "}
                          {new Date(req.timestamp).toLocaleString(
                            locale === "es" ? "es-419" : "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            }
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(req.code)}
                    disabled={approving === req.code}
                    className="ml-3 cursor-pointer gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg transition-all duration-300 hover:bg-green-500 hover:shadow-green-500/20 disabled:opacity-60"
                  >
                    {approving === req.code ? (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    {t("approve")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-3">
          <p className="text-[11px] text-zinc-500">{t("codesExpire")}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchRequests}
            disabled={loading}
            className="cursor-pointer gap-1.5 text-xs text-zinc-400 hover:text-white"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            {t("refresh")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
