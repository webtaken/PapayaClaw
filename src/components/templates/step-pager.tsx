import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight, Rocket } from "lucide-react";
import type { TemplateStepMeta } from "@/lib/template-docs";

interface StepPagerProps {
  templateSlug: string;
  prev: TemplateStepMeta | null;
  next: TemplateStepMeta | null;
  labels: { prevStep: string; nextStep: string; finishTitle: string; finishCta: string };
}

const cardBase =
  "group rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-violet-500/40 hover:shadow-[0_0_0_1px_rgba(139,92,246,0.15),0_8px_32px_-8px_rgba(139,92,246,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function StepPager({ templateSlug, prev, next, labels }: StepPagerProps) {
  return (
    <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {prev ? (
        <Link href={`/templates/${templateSlug}/${prev.slug}`} className={cardBase}>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowLeft className="h-3 w-3 transition-transform duration-150 group-hover:-translate-x-0.5" />
            {labels.prevStep}
          </span>
          <span className="mt-1.5 block text-sm font-medium text-foreground transition-colors duration-200 group-hover:text-violet-300">
            {prev.title}
          </span>
        </Link>
      ) : (
        <span aria-hidden="true" className="hidden sm:block" />
      )}
      {next ? (
        <Link href={`/templates/${templateSlug}/${next.slug}`} className={`${cardBase} text-right`}>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            {labels.nextStep}
            <ArrowRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5" />
          </span>
          <span className="mt-1.5 block text-sm font-medium text-foreground transition-colors duration-200 group-hover:text-violet-300">
            {next.title}
          </span>
        </Link>
      ) : (
        <Link
          href="/dashboard"
          className="group rounded-xl border border-violet-500/40 bg-gradient-to-r from-violet-500/10 to-blue-500/10 p-5 text-right transition-all duration-200 hover:border-violet-500/70 hover:shadow-[0_0_0_1px_rgba(139,92,246,0.15),0_8px_32px_-8px_rgba(139,92,246,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="inline-flex items-center gap-1.5 text-xs text-violet-400">
            {labels.finishTitle}
            <Rocket className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
          <span className="mt-1.5 block text-sm font-medium text-foreground">{labels.finishCta}</span>
        </Link>
      )}
    </div>
  );
}
