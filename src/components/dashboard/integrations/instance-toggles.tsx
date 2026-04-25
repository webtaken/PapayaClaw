"use client";

import useSWR from "swr";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface AvailableConnection {
  id: string;
  accountLabel: string | null;
  status: string;
}

interface InstanceBinding {
  toolkitSlug: string;
  enabled: boolean;
  selectedConnectionId: string | null;
  availableConnections: AvailableConnection[];
}

interface InstanceTogglesProps {
  instanceId: string;
}

export function InstanceToggles({ instanceId }: InstanceTogglesProps) {
  const t = useTranslations("Integrations");
  const { data, mutate } = useSWR<{ bindings: InstanceBinding[] }>(
    `/api/instances/${instanceId}/integrations`,
    fetcher,
  );

  const bindings = (data?.bindings ?? []).filter(
    (b) => b.availableConnections.some((c) => c.status === "connected"),
  );

  if (!bindings.length) {
    return (
      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground font-mono">
          {t("togglesTitle")}
        </h3>
        <p className="text-sm text-muted-foreground">{t("noConnections")}</p>
      </section>
    );
  }

  async function handleToggle(binding: InstanceBinding, enabled: boolean) {
    const connectedConns = binding.availableConnections.filter(
      (c) => c.status === "connected",
    );
    const selectedConnectionId =
      connectedConns.length === 1
        ? connectedConns[0].id
        : binding.selectedConnectionId;

    const prev = data;
    await mutate(
      (current) => {
        if (!current) return current;
        return {
          bindings: current.bindings.map((b) =>
            b.toolkitSlug === binding.toolkitSlug ? { ...b, enabled } : b,
          ),
        };
      },
      { revalidate: false },
    );

    try {
      const res = await fetch(
        `/api/instances/${instanceId}/integrations/${binding.toolkitSlug}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled, selectedConnectionId }),
        },
      );
      if (!res.ok) throw new Error("update_failed");
      await mutate();
    } catch {
      await mutate(prev, { revalidate: false });
      toast.error(t("connectError"));
    }
  }

  async function handleConnectionSelect(binding: InstanceBinding, connId: string) {
    try {
      const res = await fetch(
        `/api/instances/${instanceId}/integrations/${binding.toolkitSlug}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled: binding.enabled,
            selectedConnectionId: connId,
          }),
        },
      );
      if (!res.ok) throw new Error("update_failed");
      await mutate();
    } catch {
      toast.error(t("connectError"));
    }
  }

  return (
    <section>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground font-mono">
        {t("togglesTitle")}
      </h3>
      <div className="rounded-xl border border-border divide-y divide-border">
        {bindings.map((binding) => {
          const connectedConns = binding.availableConnections.filter(
            (c) => c.status === "connected",
          );
          return (
            <div
              key={binding.toolkitSlug}
              className="flex items-center justify-between px-4 py-3 gap-4"
            >
              <div className="flex-1">
                <p className="text-sm font-medium capitalize">
                  {binding.toolkitSlug}
                </p>
                {connectedConns.length > 1 && (
                  <Select
                    value={binding.selectedConnectionId ?? ""}
                    onValueChange={(v) => handleConnectionSelect(binding, v)}
                  >
                    <SelectTrigger className="mt-1 h-7 w-48 text-xs">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {connectedConns.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.accountLabel ?? c.id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Switch
                checked={binding.enabled}
                onCheckedChange={(v) => handleToggle(binding, v)}
                disabled={!connectedConns.length}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
