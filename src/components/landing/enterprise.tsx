import { getTranslations } from "next-intl/server";
import { ArrowUpRight } from "lucide-react";

const CAL_URL =
  "https://cal.com/saul-rojas-zijrrm/30min?overlayCalendar=true";

export async function Enterprise() {
  const t = await getTranslations("Enterprise");

  return (
    <section className="border-b border-border/20 bg-zinc-950 dark:bg-zinc-900/80">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          {/* Text */}
          <div className="flex flex-col gap-4 md:max-w-xl">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
              {t("title")}
            </h2>
            <p className="text-base leading-relaxed text-zinc-400">
              {t("description")}
            </p>
          </div>

          {/* CTA */}
          <div className="shrink-0">
            <a
              href={CAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("ctaAriaLabel")}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-zinc-950 shadow-sm transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {t("cta")}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
