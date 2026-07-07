import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";
import { getTemplates, getTemplateSteps } from "@/lib/template-docs";
import type { Locale } from "@/lib/mdx";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Templates" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: locale === "es" ? "/es/templates" : "/templates",
      languages: { en: "/templates", es: "/es/templates" },
    },
  };
}

export default async function TemplatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Templates");
  const templates = await getTemplates(locale as Locale);
  const stepCounts = await Promise.all(
    templates.map(async (tmpl) => (await getTemplateSteps(tmpl.slug, locale as Locale)).length)
  );

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-20">
        <div className="mb-12">
          <p className="font-mono text-xs uppercase tracking-widest text-violet-400 mb-3">
            {t("tagPlural")}
          </p>
          <h1 className="text-4xl font-medium tracking-tight text-foreground">{t("title")}</h1>
          <p className="mt-3 text-base text-muted-foreground max-w-xl">{t("subtitle")}</p>
        </div>

        {templates.length === 0 ? (
          <div className="border-t border-border pt-10">
            <p className="font-mono text-sm text-muted-foreground">{t("empty")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((tmpl, i) => (
              <Link
                key={tmpl.slug}
                href={`/templates/${tmpl.slug}`}
                className={[
                  "group flex flex-col rounded-xl border border-border bg-card p-6",
                  "transition-all duration-200",
                  "hover:border-violet-500/40 hover:shadow-[0_0_0_1px_rgba(139,92,246,0.15),0_8px_32px_-8px_rgba(139,92,246,0.15)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                ].join(" ")}
              >
                <span className="mb-4 block text-4xl leading-none" aria-hidden="true">
                  {tmpl.emoji ?? "✨"}
                </span>
                <h2 className="text-lg font-medium text-foreground transition-colors duration-200 group-hover:text-violet-300">
                  {tmpl.title}
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed line-clamp-2">
                  {tmpl.tagline}
                </p>
                <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-violet-400">
                  {t("viewGuide")} · {t("stepsCount", { count: stepCounts[i] })}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
