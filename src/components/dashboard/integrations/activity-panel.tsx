"use client";

import useSWR from "swr";
import { useTranslations } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Invocation {
  id: string;
  toolkitSlug: string;
  actionSlug: string;
  outcome: string;
  errorClass: string | null;
  latencyMs: number | null;
  occurredAt: string;
}

const OUTCOME_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  success: "default",
  provider_error: "destructive",
  auth_denied: "destructive",
  connection_unhealthy: "destructive",
  not_enabled: "outline",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface ActivityPanelProps {
  instanceId: string;
}

export function ActivityPanel({ instanceId }: ActivityPanelProps) {
  const t = useTranslations("Integrations");
  const { data } = useSWR<{ invocations: Invocation[] }>(
    `/api/instances/${instanceId}/integration-activity`,
    fetcher,
  );

  const invocations = data?.invocations ?? [];

  return (
    <section>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground font-mono">
        {t("activityTitle")}
      </h3>

      {!invocations.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-12 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/60">
            <Activity className="h-5 w-5 text-muted-foreground/60" />
          </div>
          <p className="text-sm text-muted-foreground">{t("noActivity")}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Service</TableHead>
                <TableHead className="text-xs">Action</TableHead>
                <TableHead className="text-xs">Outcome</TableHead>
                <TableHead className="text-xs text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invocations.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="text-xs capitalize">
                    {inv.toolkitSlug}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {inv.actionSlug}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={OUTCOME_VARIANT[inv.outcome] ?? "secondary"}
                      className="text-[10px]"
                    >
                      {inv.outcome}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-right text-muted-foreground">
                    {relativeTime(inv.occurredAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
