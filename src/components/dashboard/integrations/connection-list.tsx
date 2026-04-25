"use client";

import { useState } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ReconnectDialog } from "./reconnect-dialog";
import { RefreshCw, Trash2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Connection {
  id: string;
  toolkitSlug: string;
  accountLabel: string | null;
  status: string;
  createdAt: string;
}

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  connected: "default",
  pending: "secondary",
  reconnect_required: "destructive",
  expired: "destructive",
  revoked: "destructive",
};

export function ConnectionList() {
  const t = useTranslations("Integrations");
  const { data, mutate } = useSWR<{ connections: Connection[] }>(
    "/api/integrations/connections",
    fetcher,
  );
  const connections = data?.connections ?? [];

  const [disconnectTarget, setDisconnectTarget] = useState<Connection | null>(
    null,
  );
  const [reconnectTarget, setReconnectTarget] = useState<Connection | null>(
    null,
  );

  async function handleDisconnect(conn: Connection) {
    try {
      const res = await fetch(`/api/integrations/connections/${conn.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("disconnect_failed");
      toast.success(t("disconnectSuccess"));
      await mutate();
    } catch {
      toast.error(t("connectError"));
    }
    setDisconnectTarget(null);
  }

  if (!connections.length) return null;

  return (
    <section>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground font-mono">
        My connections
      </h3>
      <div className="rounded-xl border border-border divide-y divide-border">
        {connections.map((conn) => {
          const statusKey =
            conn.status === "reconnect_required" ? "reconnectRequired" : conn.status;
          const needsReconnect = ["reconnect_required", "expired", "revoked"].includes(
            conn.status,
          );

          return (
            <div
              key={conn.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium capitalize truncate">
                  {conn.toolkitSlug}
                  {conn.accountLabel && (
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      {conn.accountLabel}
                    </span>
                  )}
                </p>
                <Badge
                  variant={STATUS_VARIANT[conn.status] ?? "secondary"}
                  className="mt-0.5 text-[10px]"
                >
                  {t(`status.${String(statusKey)}` as Parameters<typeof t>[0])}
                </Badge>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {needsReconnect && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs"
                    onClick={() => setReconnectTarget(conn)}
                  >
                    <RefreshCw className="h-3 w-3" />
                    {t("actions.reconnect")}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => setDisconnectTarget(conn)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog
        open={!!disconnectTarget}
        onOpenChange={(o) => !o && setDisconnectTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialog.disconnectTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dialog.disconnectDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => disconnectTarget && handleDisconnect(disconnectTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("actions.disconnect")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {reconnectTarget && (
        <ReconnectDialog
          open={!!reconnectTarget}
          onOpenChange={(o) => !o && setReconnectTarget(null)}
          connectionId={reconnectTarget.id}
          toolkitSlug={reconnectTarget.toolkitSlug}
        />
      )}
    </section>
  );
}
