"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Crown,
  Zap,
  ExternalLink,
  Plus,
  Server,
  CalendarDays,
  ArrowRight,
  AlertTriangle,
  Unlink,
  CircleDot,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

interface SubscriptionWithInstance {
  id: string;
  userId: string;
  polarCustomerId: string;
  productId: string;
  priceId: string | null;
  planType: string;
  status: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
  instance: {
    id: string;
    name: string;
    status: string;
    model: string;
    channel: string;
  } | null;
}

interface UnlinkedInstance {
  id: string;
  name: string;
  status: string;
  model: string;
  channel: string;
}

interface SubscriptionsContentProps {
  subscriptions: SubscriptionWithInstance[];
  unlinkedInstances: UnlinkedInstance[];
  user: { id: string; email: string };
}

const STATUS_CONFIG: Record<
  string,
  { dotClass: string; textClass: string }
> = {
  active: {
    dotClass: "bg-green-400",
    textClass: "text-green-400",
  },
  canceled: {
    dotClass: "bg-amber-400",
    textClass: "text-amber-400",
  },
  past_due: {
    dotClass: "bg-red-400",
    textClass: "text-red-400",
  },
  revoked: {
    dotClass: "bg-red-400",
    textClass: "text-red-400",
  },
  incomplete: {
    dotClass: "bg-zinc-500",
    textClass: "text-zinc-500",
  },
};

const INSTANCE_STATUS_CONFIG: Record<
  string,
  { label: string; className: string; dotClass: string }
> = {
  running: {
    label: "Running",
    className: "border-green-500/30 bg-green-500/10 text-green-400",
    dotClass: "bg-green-400",
  },
  stopped: {
    label: "Stopped",
    className: "border-red-500/30 bg-red-500/10 text-red-400",
    dotClass: "bg-red-400",
  },
  deploying: {
    label: "Deploying",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    dotClass: "bg-amber-400 animate-pulse",
  },
  error: {
    label: "Error",
    className: "border-red-500/30 bg-red-500/10 text-red-400",
    dotClass: "bg-red-400",
  },
};

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusLabel({
  statusKey,
  t,
}: {
  statusKey: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const statusMap: Record<string, string> = {
    active: "statusActive",
    canceled: "statusCanceled",
    past_due: "statusPastDue",
    revoked: "statusRevoked",
    incomplete: "statusIncomplete",
  };
  return <>{t(statusMap[statusKey] ?? "statusIncomplete")}</>;
}

export function SubscriptionsContent({
  subscriptions,
  unlinkedInstances,
  user,
}: SubscriptionsContentProps) {
  const t = useTranslations("Subscriptions");

  // Empty state
  if (subscriptions.length === 0 && unlinkedInstances.length === 0) {
    return (
      <div className="animate-fade-in-up flex flex-col gap-6 font-sans">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
          <div>
            <h1 className="text-xl font-medium tracking-tight text-white mb-1">
              {t("title")}
            </h1>
            <p className="text-xs font-mono text-zinc-500">
              {t("description")}
            </p>
          </div>
        </div>

        <div className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden mt-4">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-900/50 border border-zinc-800/80">
              <CircleDot className="h-7 w-7 text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-300 font-mono mb-1">
              {t("noSubscriptions")}
            </p>
            <p className="text-xs text-zinc-500 font-mono mb-8 max-w-sm leading-relaxed">
              {t("noSubscriptionsDescription")}
            </p>
            <Link href="/pricing">
              <Button className="bg-zinc-100 text-zinc-950 hover:bg-white font-medium shadow-none h-10 px-6 border border-transparent transition-all hover:border-zinc-300 gap-2 font-mono text-xs uppercase tracking-wider">
                {t("viewPlans")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up flex flex-col gap-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-white mb-1">
            {t("title")}
          </h1>
          <p className="text-xs font-mono text-zinc-500">
            {t("description")}
          </p>
        </div>
        <Link href="/pricing">
          <Button className="bg-zinc-100 text-zinc-950 hover:bg-white font-medium shadow-none h-9 px-4 border border-transparent transition-all hover:border-zinc-300 gap-2 font-mono text-xs uppercase tracking-wider">
            <Plus className="h-3.5 w-3.5" />
            {t("addSubscription")}
          </Button>
        </Link>
      </div>

      {/* Subscription Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {subscriptions.map((sub, i) => {
          const isPro = sub.planType === "pro";
          const statusCfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.incomplete;
          const instStatus = sub.instance
            ? INSTANCE_STATUS_CONFIG[sub.instance.status] ??
              INSTANCE_STATUS_CONFIG.stopped
            : null;

          return (
            <div
              key={sub.id}
              className={`flex flex-col rounded-xl border bg-zinc-950 shadow-2xl overflow-hidden transition-all duration-300 hover:border-zinc-700 ${
                i === 0
                  ? "animate-slide-up-fade"
                  : i === 1
                    ? "animate-slide-up-fade-delay-1"
                    : "animate-slide-up-fade-delay-2"
              } ${
                isPro ? "border-amber-500/20" : "border-zinc-800"
              }`}
            >
              {/* Card header */}
              <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/20 px-5 py-3.5">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-widest ${
                    isPro
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                  }`}
                >
                  {isPro ? (
                    <Crown className="h-2.5 w-2.5" />
                  ) : (
                    <Zap className="h-2.5 w-2.5" />
                  )}
                  {isPro ? t("pro") : t("basic")}
                </span>

                <div className="flex items-center gap-2">
                  {sub.cancelAtPeriodEnd && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider text-amber-400">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {t("cancelingAtEnd")}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${statusCfg.dotClass}`}
                    />
                    <span className={statusCfg.textClass}>
                      <StatusLabel statusKey={sub.status} t={t} />
                    </span>
                  </span>
                </div>
              </div>

              <div className="p-5 flex flex-col flex-1 gap-4">
                {/* VPS Spec + Billing Period */}
                <div className="grid grid-cols-2 gap-px bg-zinc-800/50 border border-zinc-800/50 rounded-lg overflow-hidden">
                  <div className="bg-zinc-950/80 p-3 flex flex-col gap-1.5">
                    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
                      <Server className="h-2.5 w-2.5" />
                      {t("vpsSpec")}
                    </span>
                    <span className="text-xs text-zinc-300 font-mono">
                      {isPro ? t("proSpec") : t("basicSpec")}
                    </span>
                  </div>
                  <div className="bg-zinc-950/80 p-3 flex flex-col gap-1.5">
                    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
                      <CalendarDays className="h-2.5 w-2.5" />
                      {t("billingPeriod")}
                    </span>
                    <span className="text-xs text-zinc-300 font-mono">
                      {formatDate(sub.currentPeriodStart)} {t("to")}{" "}
                      {formatDate(sub.currentPeriodEnd)}
                    </span>
                  </div>
                </div>

                {/* Linked Instance */}
                <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/30 p-4">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-3 block">
                    {t("linkedInstance")}
                  </span>

                  {sub.instance ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                            isPro
                              ? "border-amber-500/20 bg-amber-500/5"
                              : "border-sky-500/20 bg-sky-500/5"
                          }`}
                        >
                          {isPro ? (
                            <Crown className="h-3.5 w-3.5 text-amber-400" />
                          ) : (
                            <Zap className="h-3.5 w-3.5 text-sky-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {sub.instance.name}
                          </p>
                          <Badge
                            variant="outline"
                            className={`mt-0.5 gap-1 rounded-md px-1.5 py-0 text-[9px] font-mono uppercase tracking-wider ${instStatus?.className}`}
                          >
                            <span
                              className={`h-1 w-1 rounded-full ${instStatus?.dotClass}`}
                            />
                            {instStatus?.label}
                          </Badge>
                        </div>
                      </div>
                      <Link href={`/dashboard/${sub.instance.id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 gap-1.5 rounded-lg border-zinc-800 bg-zinc-900/50 text-[10px] font-mono uppercase tracking-wider text-zinc-400 transition-all hover:border-zinc-700 hover:bg-zinc-800 hover:text-white h-8 shadow-none"
                        >
                          View
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-zinc-500 font-mono">
                        {t("noInstanceLinked")}
                      </p>
                      {sub.status === "active" && (
                        <Link href="/dashboard">
                          <Button
                            size="sm"
                            className="gap-1.5 bg-zinc-100 text-zinc-950 hover:bg-white font-medium shadow-none h-8 px-3 border border-transparent transition-all hover:border-zinc-300 font-mono text-[10px] uppercase tracking-wider"
                          >
                            <Plus className="h-3 w-3" />
                            {t("deployInstance")}
                          </Button>
                        </Link>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer action */}
                <div className="mt-auto pt-1">
                  <a
                    href="/api/portal"
                    className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {t("managePlan")}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add subscription hint */}
      {subscriptions.length > 0 && (
        <div className="flex items-center justify-center py-2">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
            {t("addSubscriptionDescription")}
          </p>
        </div>
      )}

      {/* Unlinked instances (legacy) */}
      {unlinkedInstances.length > 0 && (
        <div className="animate-slide-up-fade-delay-2">
          <div className="flex items-center gap-2 mb-3">
            <Unlink className="h-3.5 w-3.5 text-zinc-600" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 font-semibold">
              {t("unlinked")}
            </span>
          </div>
          <div className="rounded-xl border border-zinc-800/50 bg-zinc-950/50 divide-y divide-zinc-800/50">
            {unlinkedInstances.map((inst) => {
              const instStatus =
                INSTANCE_STATUS_CONFIG[inst.status] ??
                INSTANCE_STATUS_CONFIG.stopped;
              return (
                <div
                  key={inst.id}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm text-zinc-400 truncate">
                      {inst.name}
                    </span>
                    <Badge
                      variant="outline"
                      className={`gap-1 rounded-md px-1.5 py-0 text-[9px] font-mono uppercase tracking-wider ${instStatus.className}`}
                    >
                      <span
                        className={`h-1 w-1 rounded-full ${instStatus.dotClass}`}
                      />
                      {instStatus.label}
                    </Badge>
                  </div>
                  <Link href={`/dashboard/${inst.id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5 rounded-lg border-zinc-800 bg-zinc-900/50 text-[10px] font-mono uppercase tracking-wider text-zinc-400 transition-all hover:border-zinc-700 hover:bg-zinc-800 hover:text-white h-7 shadow-none"
                    >
                      View
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
