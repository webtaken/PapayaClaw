"use client";

import { useState } from "react";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { Plug, Copy, Check, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Gmail } from "@/components/icons/gmail";
import { Slack } from "@/components/icons/slack";
import { Notion } from "@/components/icons/notion";
import { GoogleDrive } from "@/components/icons/drive";
import { GoogleCalendar } from "@/components/icons/google-calendar";

type AppIcon = ComponentType<SVGProps<SVGSVGElement>>;

const APPS: ReadonlyArray<{ slug: string; label: string; Icon: AppIcon }> = [
  { slug: "gmail", label: "Gmail", Icon: Gmail },
  { slug: "slack", label: "Slack", Icon: Slack },
  { slug: "notion", label: "Notion", Icon: Notion },
  { slug: "googledrive", label: "Drive", Icon: GoogleDrive },
  { slug: "googlecalendar", label: "Calendar", Icon: GoogleCalendar },
];

interface CodeBlockProps {
  code: string;
  copyLabel: string;
  copiedLabel: string;
}

function CodeBlock({ code, copyLabel, copiedLabel }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(copiedLabel);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — swallow
    }
  }

  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 px-3 py-2.5 pr-10 font-mono text-xs leading-relaxed text-foreground/90">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copyLabel}
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded border border-border bg-card/80 text-muted-foreground opacity-0 transition hover:text-foreground focus:opacity-100 group-hover:opacity-100"
      >
        {copied ? (
          <Check className="h-3 w-3 text-emerald-400" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}

interface StepRowProps {
  num: string;
  title: string;
  children: ReactNode;
}

function StepRow({ num, title, children }: StepRowProps) {
  return (
    <div className="flex flex-col gap-3 border-t border-border px-5 py-5 md:flex-row md:gap-5 md:px-6">
      <div className="shrink-0">
        <span className="inline-flex items-center rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 font-mono text-xs font-semibold uppercase tracking-widest text-violet-400">
          {num}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-foreground/90">
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}

export function IntegrationsTab() {
  const t = useTranslations("InstanceDetail.integrations");
  const [selectedSlug, setSelectedSlug] = useState<string>(APPS[0].slug);

  const linkCmd = `composio link ${selectedSlug}`;
  const copyLabel = t("copy");
  const copiedLabel = t("copied");

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      {/* Header */}
      <div className="flex items-start gap-4 border-b border-border bg-muted/50 px-5 py-4 md:px-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60">
          <Plug className="h-5 w-5 text-violet-400" />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground/80">
              {t("title")}
              <span className="mx-1.5 text-muted-foreground/60">·</span>
              Composio
            </h2>
            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 font-mono text-xs font-medium uppercase tracking-widest text-violet-400">
              {t("badge")}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
      </div>

      {/* Step 01 */}
      <StepRow num="01" title={t("step1.title")}>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("step1.body")}
        </p>
        <div>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="gap-1.5 font-mono text-xs"
          >
            <a
              href="https://app.composio.dev"
              target="_blank"
              rel="noreferrer"
            >
              {t("step1.cta")}
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>
      </StepRow>

      {/* Step 02 */}
      <StepRow num="02" title={t("step2.title")}>
        <CodeBlock
          code={t("step2.install")}
          copyLabel={copyLabel}
          copiedLabel={copiedLabel}
        />
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("step2.loginHint")}
        </p>
        <CodeBlock
          code={t("step2.loginCmd")}
          copyLabel={copyLabel}
          copiedLabel={copiedLabel}
        />
      </StepRow>

      {/* Step 03 */}
      <StepRow num="03" title={t("step3.title")}>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("step3.body")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {APPS.map((app) => {
            const isActive = app.slug === selectedSlug;
            const Icon = app.Icon;
            return (
              <button
                key={app.slug}
                type="button"
                onClick={() => setSelectedSlug(app.slug)}
                aria-pressed={isActive}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs transition",
                  isActive
                    ? "border-violet-500/40 bg-violet-500/10 text-violet-300"
                    : "border-border bg-muted/40 text-muted-foreground hover:border-violet-500/30 hover:text-foreground/90",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {app.label}
              </button>
            );
          })}
        </div>
        <CodeBlock
          code={linkCmd}
          copyLabel={copyLabel}
          copiedLabel={copiedLabel}
        />
      </StepRow>

      {/* Step 04 */}
      <StepRow num="04" title={t("step4.title")}>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("step4.body")}
        </p>
        <CodeBlock
          code={t("step4.prompt")}
          copyLabel={copyLabel}
          copiedLabel={copiedLabel}
        />
        <div className="flex items-start gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <span
            className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
            aria-hidden
          />
          <p className="font-mono text-xs leading-relaxed text-emerald-300/80">
            {t("step4.security")}
          </p>
        </div>
      </StepRow>
    </div>
  );
}
