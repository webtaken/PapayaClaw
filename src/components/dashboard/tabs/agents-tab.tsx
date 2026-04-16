"use client";

import { Bot } from "lucide-react";
import { useTranslations } from "next-intl";

export function AgentsTab() {
  const t = useTranslations("InstanceDetail");

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card shadow-2xl px-8 py-16 text-center">
      {/* Icon tile */}
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-xl border border-border bg-muted/60">
        <Bot className="h-8 w-8 text-muted-foreground/60" />
      </div>

      {/* Title + badge row */}
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-base font-semibold text-foreground/80 font-mono uppercase tracking-wider">
          {t("agents.title")}
        </h2>
        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-widest text-violet-400">
          {t("agents.comingSoon")}
        </span>
      </div>

      {/* Description */}
      <p className="max-w-sm text-sm text-muted-foreground leading-relaxed">
        {t("agents.description")}
      </p>

      {/* Decorative personality chip row */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        {["Research", "Writer", "Analyst", "Coder", "Support"].map((role) => (
          <span
            key={role}
            className="rounded-md border border-border bg-muted/40 px-3 py-1 text-[11px] font-mono text-muted-foreground/50"
            aria-hidden
          >
            {role}
          </span>
        ))}
      </div>
    </div>
  );
}
