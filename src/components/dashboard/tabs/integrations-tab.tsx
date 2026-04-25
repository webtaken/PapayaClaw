"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { mutate as globalMutate } from "swr";
import { ServiceCatalogGrid } from "@/components/dashboard/integrations/service-catalog-grid";
import { InstanceToggles } from "@/components/dashboard/integrations/instance-toggles";
import { ConnectionList } from "@/components/dashboard/integrations/connection-list";
import { ActivityPanel } from "@/components/dashboard/integrations/activity-panel";

interface IntegrationsTabProps {
  instanceId: string;
}

export function IntegrationsTab({ instanceId }: IntegrationsTabProps) {
  const t = useTranslations("Integrations");
  const searchParams = useSearchParams();

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("integrationError");
    if (connected) {
      toast.success(t("connectSuccess"));
      void globalMutate("/api/integrations/connections");
    } else if (error) {
      toast.error(t("connectError"));
    }
  }, [searchParams, t]);

  return (
    <div className="flex flex-col gap-8">
      <ServiceCatalogGrid />
      <ConnectionList />
      <InstanceToggles instanceId={instanceId} />
      <ActivityPanel instanceId={instanceId} />
    </div>
  );
}
