"use client";

import useSWR from "swr";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

import { Gmail } from "@/components/icons/gmail";
import { GoogleCalendar } from "@/components/icons/google-calendar";
import { GoogleDrive } from "@/components/icons/drive";
import { GoogleSheets } from "@/components/icons/google-sheets";
import { Notion } from "@/components/icons/notion";
import { Linear } from "@/components/icons/linear";
import { Slack } from "@/components/icons/slack";
import { GitHub } from "@/components/icons/github";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const ICON_MAP: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  gmail: Gmail,
  "google-calendar": GoogleCalendar,
  "google-drive": GoogleDrive,
  "google-sheets": GoogleSheets,
  notion: Notion,
  linear: Linear,
  slack: Slack,
  github: GitHub,
};

interface CatalogEntry {
  slug: string;
  labelKey: string;
  descriptionKey: string;
  iconId: string;
}

interface Connection {
  id: string;
  toolkitSlug: string;
  accountLabel: string | null;
  status: string;
}

export function ServiceCatalogGrid() {
  const t = useTranslations("Integrations");
  const { data: catalogData } = useSWR<{ services: CatalogEntry[] }>(
    "/api/integrations/catalog",
    fetcher,
  );
  const { data: connectionsData } = useSWR<{
    connections: Connection[];
  }>("/api/integrations/connections", fetcher);

  const services = catalogData?.services ?? [];
  const connections = connectionsData?.connections ?? [];

  const getConnectionsForSlug = (slug: string) =>
    connections.filter((c) => c.toolkitSlug === slug && c.status === "connected");

  async function handleConnect(slug: string) {
    try {
      const res = await fetch("/api/integrations/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolkitSlug: slug }),
      });
      if (!res.ok) throw new Error("connect_failed");
      const { redirectUrl } = await res.json();
      if (redirectUrl) window.location.assign(redirectUrl);
    } catch {
      toast.error(t("connectError"));
    }
  }

  if (!services.length) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <section>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground font-mono">
        {t("catalogTitle")}
      </h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {services.map((service) => {
          const Icon = ICON_MAP[service.iconId] ?? ICON_MAP["github"];
          const connected = getConnectionsForSlug(service.slug);

          return (
            <Card key={service.slug} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted/60">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">{t(`services.${service.slug}.label` as Parameters<typeof t>[0])}</span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-3 pt-0">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t(`services.${service.slug}.description` as Parameters<typeof t>[0])}
                </p>
                <div className="flex items-center justify-between gap-2">
                  {connected.length > 0 ? (
                    <>
                      <Badge variant="secondary" className="text-xs">
                        {t("status.connected")} ({connected.length})
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => handleConnect(service.slug)}
                      >
                        {t("actions.connect")}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => handleConnect(service.slug)}
                    >
                      {t("actions.connect")}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
