"use client";

import { useState } from "react";
import { InstanceCard } from "./instance-card";
import { DeployDialog } from "./deploy-dialog";
import { Button } from "@/components/ui/button";
import { Plus, Crown, ExternalLink, CreditCard } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export interface Instance {
  id: string;
  name: string;
  model: string;
  modelApiKey: string | null;
  channel: string;
  botToken: string;
  status: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  id: string;
  planType: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
}

interface DashboardProps {
  initialInstances: Instance[];
  subscription: Subscription | null;
  user: { id: string; email: string };
}

const BASIC_PRODUCT_ID = process.env.NEXT_PUBLIC_POLAR_BASIC_PRODUCT_ID;
const PRO_PRODUCT_ID = process.env.NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID;

function getCheckoutUrl(productId: string, userId: string, email: string) {
  return `/api/checkout?products=${productId}&customerExternalId=${userId}&customerEmail=${encodeURIComponent(email)}`;
}

export function DashboardContent({
  initialInstances,
  subscription,
  user,
}: DashboardProps) {
  const [instances, setInstances] = useState<Instance[]>(initialInstances);
  const [deployOpen, setDeployOpen] = useState(false);
  const t = useTranslations("Dashboard");

  const planLabel =
    subscription?.planType === "pro"
      ? "Pro"
      : subscription?.planType === "basic"
        ? "Basic"
        : "Free";

  const handleInstanceCreated = (newInstance: Instance) => {
    setInstances((prev) => [newInstance, ...prev]);
    setDeployOpen(false);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const res = await fetch(`/api/instances/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      const updated = await res.json();
      setInstances((prev) =>
        prev.map((inst) => (inst.id === id ? updated : inst)),
      );
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/instances/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setInstances((prev) => prev.filter((inst) => inst.id !== id));
    }
  };

  return (
    <div className="animate-fade-in-up flex flex-col gap-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-medium tracking-tight text-white">
              {t("yourInstances")}
            </h1>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-widest ${
                planLabel === "Pro"
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : planLabel === "Basic"
                    ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                    : "bg-zinc-800 text-zinc-500 border border-zinc-700"
              }`}
            >
              {planLabel === "Pro" && <Crown className="h-2.5 w-2.5" />}
              {planLabel}
            </span>
          </div>
          <p className="text-xs font-mono text-zinc-500">
            {t("manageDescription")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Subscription actions */}
          <Link
            href="/dashboard/subscriptions"
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 border border-zinc-800 px-3 h-9 text-xs font-mono text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all"
          >
            <CreditCard className="h-3 w-3" />
            {t("navSubscriptions")}
          </Link>
          {subscription ? (
            <a
              href="/api/portal"
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 border border-zinc-800 px-3 h-9 text-xs font-mono text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all"
            >
              {t("managePlan")}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <>
              {BASIC_PRODUCT_ID && (
                <a
                  href={getCheckoutUrl(BASIC_PRODUCT_ID, user.id, user.email)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 px-3 h-9 text-xs font-mono text-sky-400 hover:bg-sky-500/20 hover:text-sky-300 transition-all"
                >
                  Basic · $39.90/mo
                </a>
              )}
              {PRO_PRODUCT_ID && (
                <a
                  href={getCheckoutUrl(PRO_PRODUCT_ID, user.id, user.email)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 h-9 text-xs font-mono text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 transition-all"
                >
                  <Crown className="h-3 w-3" />
                  Pro · $59.90/mo
                </a>
              )}
            </>
          )}
          <Button
            onClick={() => setDeployOpen(true)}
            className="bg-zinc-100 text-zinc-950 hover:bg-white font-medium shadow-none h-9 px-4 border border-transparent transition-all hover:border-zinc-300 gap-2 font-mono text-xs uppercase tracking-wider"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("deployNew")}
          </Button>
        </div>
      </div>

      {/* Subscription CTA Banner — shown when user has no active plan */}
      {!subscription && (
        <div className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Crown className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                {t("subscribeBanner")}
              </p>
              <p className="text-xs text-zinc-500 font-mono">
                {t("subscribeBannerDescription")}
              </p>
            </div>
          </div>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 h-9 text-xs font-bold uppercase tracking-wider text-black hover:bg-amber-400 transition-colors"
          >
            {t("viewPlans")}
          </Link>
        </div>
      )}

      {/* Instance Grid */}
      {instances.length === 0 ? (
        <div className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden mt-4">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900/50 border border-zinc-800/80">
              <Plus className="h-6 w-6 text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-300 font-mono mb-1">
              {t("noInstances")}
            </p>
            <p className="text-xs text-zinc-500 font-mono mb-6 max-w-xs leading-relaxed">
              {t("noInstancesDescription")}
            </p>
            <Button
              onClick={() => setDeployOpen(true)}
              className="bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700 hover:text-white font-medium shadow-none gap-2 font-mono text-xs uppercase tracking-wider h-10 px-6"
            >
              <Plus className="h-3.5 w-3.5 text-zinc-400" />
              {t("initializeDeployment")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {instances.map((inst) => (
            <InstanceCard
              key={inst.id}
              instance={inst}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Deploy Dialog */}
      <DeployDialog
        open={deployOpen}
        onOpenChange={setDeployOpen}
        onInstanceCreated={handleInstanceCreated}
      />
    </div>
  );
}
