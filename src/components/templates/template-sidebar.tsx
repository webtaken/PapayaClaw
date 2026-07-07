import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import type { TemplateStepMeta } from "@/lib/template-docs";

interface TemplateSidebarProps {
  templateSlug: string;
  templateTitle: string;
  emoji?: string;
  steps: TemplateStepMeta[];
  currentStep: string;
  variant: "desktop" | "mobile";
  labels: { stepsTitle: string };
}

const linkFocusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function StepList({
  templateSlug,
  templateTitle,
  emoji,
  steps,
  currentStep,
  labels,
}: Omit<TemplateSidebarProps, "variant">) {
  return (
    <nav aria-label={labels.stepsTitle}>
      <Link
        href={`/templates/${templateSlug}`}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-medium text-foreground transition-colors duration-150 hover:text-violet-400",
          linkFocusRing
        )}
      >
        <span aria-hidden="true">{emoji ?? "✨"}</span>
        <span className="truncate">{templateTitle}</span>
      </Link>
      <p className="mt-4 px-2 font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {labels.stepsTitle}
      </p>
      <ol className="mt-2 space-y-0.5">
        {steps.map((step, i) => {
          const active = step.slug === currentStep;
          return (
            <li key={step.slug}>
              <Link
                href={`/templates/${templateSlug}/${step.slug}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-baseline gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150",
                  active
                    ? "bg-violet-500/10 font-medium text-violet-400"
                    : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground",
                  linkFocusRing
                )}
              >
                <span className="font-mono text-xs shrink-0">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0">{step.title}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function TemplateSidebar(props: TemplateSidebarProps) {
  const { variant, ...rest } = props;
  if (variant === "desktop") {
    return (
      <aside className="hidden lg:block sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-4">
        <StepList {...rest} />
      </aside>
    );
  }
  return (
    <details className="lg:hidden mb-8 rounded-xl border border-border bg-card group">
      <summary
        className={cn(
          "flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden",
          linkFocusRing
        )}
      >
        {rest.labels.stepsTitle}
        <ChevronDown aria-hidden="true" className="h-4 w-4 text-muted-foreground transition-transform duration-150 group-open:rotate-180" />
      </summary>
      <div className="border-t border-border px-3 py-3">
        <StepList {...rest} />
      </div>
    </details>
  );
}
