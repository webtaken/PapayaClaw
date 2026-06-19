"use client";

import { AlertCircle, Bot, Inbox, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import useSWR from "swr";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OpenClawAgent } from "@/lib/ssh";

interface AgentsResponse {
  agents?: OpenClawAgent[];
  error?: string;
}

/**
 * Renders a bindingDetail entry as "{type}: {detail}" when it looks like
 * "<channel> <kv...>", otherwise returns the raw string.
 */
function formatBinding(detail: string): string {
  const trimmed = detail.trim();
  if (!trimmed) return trimmed;
  const space = trimmed.indexOf(" ");
  if (space === -1) return trimmed;
  return `${trimmed.slice(0, space)}: ${trimmed.slice(space + 1)}`;
}

function RefreshButton({
  loading,
  onClick,
  label,
  ariaLabel,
}: {
  loading: boolean;
  onClick: () => void;
  label: string;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
    >
      <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
      {label}
    </button>
  );
}

function CenteredMessage({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card shadow-2xl px-8 py-16 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-xl border border-border bg-muted/60">
        {icon}
      </div>
      <h2 className="mb-2 text-base font-semibold text-foreground/80 font-mono uppercase tracking-wider">
        {title}
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

function AgentCard({ agent }: { agent: OpenClawAgent }) {
  const t = useTranslations("InstanceDetail");
  const name = agent.identityName ?? agent.id;

  return (
    <div className="rounded-xl border border-border bg-card shadow-2xl p-4">
      <div className="flex items-start gap-3">
        {/* Avatar tile */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50 text-xl">
          <span aria-hidden>{agent.identityEmoji || "🤖"}</span>
        </div>

        {/* Identity + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-foreground">
              {name}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {agent.id}
            </span>
            {agent.isDefault ? (
              <Badge
                variant="outline"
                className="border-violet-500/30 bg-violet-500/10 px-2 py-0 text-xs font-mono uppercase tracking-widest text-violet-400"
              >
                {t("agents.defaultBadge")}
              </Badge>
            ) : null}
          </div>
          {agent.model ? (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="font-mono text-xs text-muted-foreground">
                {t("agents.model")}:
              </span>
              <span className="font-mono text-xs text-foreground/80">
                {agent.model}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Binding chips */}
      {agent.bindingDetails.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
          <span className="sr-only">{t("agents.bindings")}</span>
          {agent.bindingDetails.map((detail, i) => (
            <span
              key={`${detail}-${i}`}
              className="rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-xs text-muted-foreground"
            >
              {formatBinding(detail)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AgentsTab({
  instanceId,
  isProvisioning,
}: {
  instanceId: string;
  isProvisioning: boolean;
}) {
  const t = useTranslations("InstanceDetail");

  const { data, error, isLoading, isValidating, mutate } = useSWR<AgentsResponse>(
    ["agents", instanceId],
    () =>
      fetch(`/api/instances/${instanceId}/agents`).then((res) => res.json()),
  );

  if (isProvisioning) {
    return (
      <CenteredMessage
        icon={<Bot className="h-8 w-8 text-muted-foreground/60" />}
        title={t("agents.provisioningTitle")}
        description={t("agents.provisioningDescription")}
      />
    );
  }

  const fetchError = error || data?.error;
  const agents = data?.agents ?? [];

  if (isLoading && !data) {
    return (
      <div aria-busy="true" aria-label={t("agents.loadingAria")} className="flex flex-col gap-3">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border border-border bg-card shadow-2xl"
          />
        ))}
      </div>
    );
  }

  if (fetchError) {
    return (
      <CenteredMessage
        icon={<AlertCircle className="h-8 w-8 text-red-500/70" />}
        title={t("agents.errorTitle")}
        description={t("agents.errorDescription")}
        action={
          <RefreshButton
            loading={isValidating}
            onClick={() => mutate()}
            label={t("agents.retry")}
            ariaLabel={t("agents.retry")}
          />
        }
      />
    );
  }

  if (agents.length === 0) {
    return (
      <CenteredMessage
        icon={<Inbox className="h-8 w-8 text-muted-foreground/60" />}
        title={t("agents.emptyTitle")}
        description={t("agents.emptyDescription")}
        action={
          <RefreshButton
            loading={isValidating}
            onClick={() => mutate()}
            label={t("agents.refresh")}
            ariaLabel={t("agents.refreshAria")}
          />
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground/80 font-mono uppercase tracking-wider">
            {t("agents.title")}
          </h2>
          <span className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
            {t("agents.count", { count: agents.length })}
          </span>
        </div>
        <RefreshButton
          loading={isValidating}
          onClick={() => mutate()}
          label={t("agents.refresh")}
          ariaLabel={t("agents.refreshAria")}
        />
      </div>

      {/* Card list */}
      <div className="flex flex-col gap-3">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
}
