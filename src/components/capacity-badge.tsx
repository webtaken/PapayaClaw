"use client";

import useSWR from "swr";
import { useTranslations } from "next-intl";
import { Server } from "lucide-react";

type CapacitySnapshot = {
  used: number;
  limit: number;
  remaining: number;
};

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("capacity fetch failed");
    return r.json() as Promise<CapacitySnapshot>;
  });

export function CapacityBadge({
  initial,
  className,
  align = "center",
}: {
  initial?: CapacitySnapshot;
  className?: string;
  align?: "center" | "start";
}) {
  const t = useTranslations("Capacity");
  const { data } = useSWR<CapacitySnapshot>("/api/capacity", fetcher, {
    fallbackData: initial,
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  });

  if (!data) return null;

  const { remaining, limit, used } = data;
  const isFull = remaining <= 0;
  const isLow = !isFull && remaining <= 2;

  const tone = isFull
    ? "border-red-500/30 bg-red-500/10 text-red-500"
    : isLow
      ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
      : "border-green-600/20 bg-green-600/5 text-green-500";

  const label = isFull ? t("full") : t("remaining", { count: remaining });

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono ${tone} ${
        align === "start" ? "self-start" : ""
      } ${className ?? ""}`}
      role="status"
      aria-live="polite"
    >
      <Server className="h-3 w-3" />
      <span>{label}</span>
    </div>
  );
}
