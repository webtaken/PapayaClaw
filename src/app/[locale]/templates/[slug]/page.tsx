import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight, Rocket } from "lucide-react";
import { MDXRemote } from "next-mdx-remote/rsc";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";
import { buildMdxComponents, mdxRenderOptions } from "@/components/mdx/mdx-components";
import { getTemplateOverview, getTemplateSlugs, getTemplateSteps } from "@/lib/template-docs";
import type { Locale } from "@/lib/mdx";

export async function generateStaticParams() {
  const slugs = await getTemplateSlugs();
  return slugs.map((slug) => ({ slug }));
}

function canonicalPath(locale: string, slug: string) {
  return locale === "es" ? `/es/templates/${slug}` : `/templates/${slug}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = await getTemplateOverview(slug, locale as Locale);
  if (!page) return {};
  const available = page.availableLocales;
  const effectiveLocale = available.includes(locale as Locale) ? locale : available[0];
  return {
    title: page.frontmatter.title,
    description: page.frontmatter.tagline,
    alternates: {
      canonical: canonicalPath(effectiveLocale, slug),
      languages: Object.fromEntries(
        available.map((l) => [l, canonicalPath(l, slug)])
      ),
    },
  };
}

export default async function TemplateOverviewPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Templates");
  const page = await getTemplateOverview(slug, locale as Locale);
  if (!page) notFound();
  const steps = await getTemplateSteps(slug, locale as Locale);
  const components = buildMdxComponents({
    copyCode: t("copyCode"),
    codeCopied: t("codeCopied"),
  });

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-20">
        <Link
          href="/templates"
          className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-all duration-150 hover:text-foreground rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-x-0.5" />
          {t("back")}
        </Link>

        <div className="mt-10 flex items-start gap-5">
          <span className="text-5xl leading-none shrink-0 mt-0.5" aria-hidden="true">
            {page.frontmatter.emoji ?? "✨"}
          </span>
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-widest text-violet-400 mb-2">
              {t("tagSingular")}
            </p>
            <h1 className="text-3xl font-medium tracking-tight">{page.frontmatter.title}</h1>
            <p className="mt-2 text-base text-muted-foreground">{page.frontmatter.tagline}</p>
          </div>
        </div>

        <div className="mt-10 border-t border-border" />

        <div className="mdx-content prose-invert mt-8">
          <MDXRemote source={page.content} components={components} options={mdxRenderOptions} />
        </div>

        {steps.length > 0 && (
          <section className="mt-12">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t("stepsTitle")}
            </h2>
            <ol className="mt-5 space-y-2">
              {steps.map((step, i) => (
                <li key={step.slug}>
                  <Link
                    href={`/templates/${slug}/${step.slug}`}
                    className="group flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-all duration-200 hover:border-violet-500/40 hover:shadow-[0_0_0_1px_rgba(139,92,246,0.15),0_8px_32px_-8px_rgba(139,92,246,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <span className="font-mono text-sm text-violet-400 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{step.title}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">{step.description}</span>
                    </span>
                    <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className="mt-10 flex flex-wrap items-center gap-4">
          {steps.length > 0 && (
            <Link
              href={`/templates/${slug}/${steps[0].slug}`}
              className="inline-flex items-center gap-2.5 rounded-xl px-6 py-3.5 bg-gradient-to-r from-violet-500 to-blue-500 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-violet-500/35 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {t("startGuide")}
              <ArrowRight className="h-4 w-4 shrink-0" />
            </Link>
          )}
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2.5 rounded-xl px-6 py-3.5 border border-border bg-card text-sm font-semibold text-foreground transition-all duration-150 hover:border-violet-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Rocket className="h-4 w-4 shrink-0" />
            {t("deployCta")}
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
