"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ReconnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  toolkitSlug: string;
}

export function ReconnectDialog({
  open,
  onOpenChange,
  connectionId,
  toolkitSlug,
}: ReconnectDialogProps) {
  const t = useTranslations("Integrations");
  const [loading, setLoading] = useState(false);

  async function handleReconnect() {
    setLoading(true);
    try {
      const res = await fetch(`/api/integrations/connections/${connectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("reconnect_failed");
      const { redirectUrl } = await res.json();
      if (redirectUrl) window.location.assign(redirectUrl);
    } catch {
      toast.error(t("connectError"));
    } finally {
      setLoading(false);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dialog.reconnectTitle")}</DialogTitle>
          <DialogDescription>
            {t("dialog.reconnectDescription")} ({toolkitSlug})
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("actions.cancel")}
          </Button>
          <Button onClick={handleReconnect} disabled={loading}>
            {t("actions.reconnect")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
