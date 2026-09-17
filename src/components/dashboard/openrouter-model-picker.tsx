"use client";

/**
 * OpenRouter model picker.
 *
 * Who: a workshop student on step 1 of "Contratar Empleado", API key in the
 * clipboard, unsure what a "model string" is. What: pick a model that works
 * with tools, see roughly what it costs, never be able to paste the key here.
 * Feel: guided — a short recommended list first, the full catalog a keystroke
 * away, manual entry tucked behind an explicit toggle.
 */

import { useMemo, useState } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { Info, Loader2, PencilLine } from "lucide-react";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { OpenRouterModel } from "@/lib/openrouter-models";
import { validateModelRef } from "@/lib/model-ref";

const PROVIDER = "openrouter";

const fetcher = async (url: string): Promise<{ models: OpenRouterModel[] }> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
};

function formatPrice(perMillion: number): string {
  if (perMillion === 0) return "$0";
  if (perMillion < 1) return `$${perMillion.toFixed(2)}`;
  return `$${perMillion.toFixed(perMillion >= 10 ? 0 : 1)}`;
}

function formatContext(tokens: number): string {
  if (!tokens) return "";
  if (tokens >= 1_000_000) return `${Math.round(tokens / 100_000) / 10}M`;
  return `${Math.round(tokens / 1000)}K`;
}

/** Returns the i18n key for a bad manual entry, or null when it's fine/empty. */
export function manualModelErrorKey(
  modelWithoutPrefix: string,
): "modelLooksLikeKey" | "modelInvalidFormat" | null {
  if (!modelWithoutPrefix.trim()) return null;
  const r = validateModelRef(`${PROVIDER}/${modelWithoutPrefix}`);
  if (r.ok) return null;
  return r.reason === "api-key" ? "modelLooksLikeKey" : "modelInvalidFormat";
}

export function OpenRouterModelPicker({
  value,
  onChange,
  inputId = "openrouter-model",
}: {
  /** Model id without the `openrouter/` prefix. */
  value: string;
  onChange: (modelId: string) => void;
  inputId?: string;
}) {
  const t = useTranslations("DeployDialog");
  const { data, error, isLoading } = useSWR("/api/openrouter/models", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  const models = useMemo(() => data?.models ?? [], [data]);
  const [manualToggle, setManual] = useState(false);
  // Catalog unavailable → the only way forward is typing the id.
  const manual = manualToggle || !!error;

  const selected = useMemo(
    () => models.find((m) => m.id === value) ?? null,
    [models, value],
  );
  const manualError = manual ? manualModelErrorKey(value) : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label
          htmlFor={inputId}
          className="text-xs font-medium text-foreground/80"
        >
          {t("openrouterModel")}
        </Label>
        {!error && (
          <button
            type="button"
            onClick={() => setManual((m) => !m)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <PencilLine className="size-3" />
            {manual ? t("openrouterSearch") : t("openrouterAdvanced")}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <Info className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
          <p className="text-xs leading-relaxed text-foreground/80">
            {t("openrouterLoadError")}
          </p>
        </div>
      )}

      {manual ? (
        <div className="flex flex-col gap-1.5">
          <div
            className={cn(
              "flex overflow-hidden rounded-lg border bg-muted/50 shadow-sm focus-within:ring-1",
              manualError
                ? "border-destructive/60 focus-within:border-destructive focus-within:ring-destructive/20"
                : "border-border focus-within:border-violet-500 focus-within:ring-violet-500/20",
            )}
          >
            <div className="flex items-center border-r border-border bg-muted px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
              {PROVIDER}/
            </div>
            <input
              id={inputId}
              type="text"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-invalid={!!manualError}
              placeholder={t("customModelPlaceholder")}
              value={value}
              onChange={(e) => onChange(e.target.value.trim())}
              className="flex-1 bg-transparent px-2.5 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            />
          </div>
          {manualError && (
            <p className="text-xs text-destructive">{t(manualError)}</p>
          )}
        </div>
      ) : (
        <Combobox
          items={models}
          value={selected}
          onValueChange={(m: OpenRouterModel | null) => onChange(m?.id ?? "")}
          itemToStringLabel={(m: OpenRouterModel) => m.name}
          isItemEqualToValue={(a: OpenRouterModel, b: OpenRouterModel) =>
            a.id === b.id
          }
          filter={(m: OpenRouterModel, query: string) => {
            const q = query.trim().toLowerCase();
            if (!q) return true;
            return (
              m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
            );
          }}
          disabled={isLoading}
        >
          <ComboboxInput
            id={inputId}
            placeholder={isLoading ? "…" : t("openrouterSearch")}
            showClear={!!selected}
            autoComplete="off"
            className="w-full border-border bg-muted/50 focus-within:border-violet-500 focus-within:ring-violet-500/20"
          >
            {isLoading && (
              <Loader2 className="absolute right-9 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </ComboboxInput>
          <ComboboxContent
            align="start"
            className="pointer-events-auto"
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <ComboboxEmpty>{t("openrouterNoResults")}</ComboboxEmpty>
            <ComboboxList className="max-h-64 overflow-y-auto">
              {(m: OpenRouterModel) => (
                <ComboboxItem key={m.id} value={m}>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-medium">
                        {m.name}
                      </span>
                      {m.featured && (
                        <Badge
                          variant="secondary"
                          className="border-none bg-violet-500 px-1.5 text-[10px] font-medium text-white"
                        >
                          {t("openrouterFeatured")}
                        </Badge>
                      )}
                      {!m.supportsTools && (
                        <span className="text-[10px] text-muted-foreground">
                          {t("openrouterNoTools")}
                        </span>
                      )}
                    </span>
                    <span className="truncate font-mono text-[11px] text-muted-foreground">
                      {m.id}
                    </span>
                  </div>
                  <span className="ml-auto shrink-0 pl-2 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                    {formatPrice(m.promptPerMillion)}
                    <span className="text-muted-foreground/50"> → </span>
                    {formatPrice(m.completionPerMillion)}
                    {m.contextLength ? (
                      <span className="block text-[10px] text-muted-foreground/60">
                        {formatContext(m.contextLength)} ctx
                      </span>
                    ) : null}
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      )}

      {!manual && selected && (
        <p className="font-mono text-[11px] text-muted-foreground">
          {PROVIDER}/{selected.id}
          <span className="text-muted-foreground/60">
            {" "}
            · {formatPrice(selected.promptPerMillion)} →{" "}
            {formatPrice(selected.completionPerMillion)} {t("perMillion")}
          </span>
        </p>
      )}
    </div>
  );
}
