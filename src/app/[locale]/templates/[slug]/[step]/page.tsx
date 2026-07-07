import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ChevronRight } from "lucide-react";
import { MDXRemote } from "next-mdx-remote/rsc";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";
import { TableOfContents } from "@/components/blog/table-of-contents";
import { ScrollToHash } from "@/components/blog/scroll-to-hash";
import { buildMdxComponents, mdxRenderOptions } from "@/components/mdx/mdx-components";
import { TemplateSidebar } from "@/components/templates/template-sidebar";
import { StepPager } from "@/components/templates/step-pager";
import {
  getTemplateOverview,
  getTemplateSlugs,
  getTemplateStep,
  getTemplateSteps,
} from "@/lib/template-docs";
import type { Locale } from "@/lib/mdx";

export async function generateStaticParams() {
  const slugs = await getTemplateSlugs();
  const params: { slug: string; step: string }[] = [];
  for (const slug of slugs) {
    const steps = await getTemplateSteps(slug, "en");
    for (const step of steps) params.push({ slug, step: step.slug });
  }
  return params;
}

function stepPath(locale: string, slug: string, step: string) {
  return locale === "es" ? `/es/templates/${slug}/${step}` : `/templates/${slug}/${step}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string; step: string }>;
}): Promise<Metadata> {
  const { locale, slug, step } = await params;
  const [overview, doc] = await Promise.all([
    getTemplateOverview(slug, locale as Locale),
    getTemplateStep(slug, step, locale as Locale),
  ]);
  if (!overview || !doc) return {};
  const available = doc.availableLocales;
  const effectiveLocale = available.includes(locale as Locale) ? locale : available[0];
  return {
    title: `${doc.frontmatter.title} — ${overview.frontmatter.title}`,
    description: doc.frontmatter.description,
    alternates: {
      canonical: stepPath(effectiveLocale, slug, step),
      languages: Object.fromEntries(available.map((l) => [l, stepPath(l, slug, step)])),
    },
  };
}

export default async function TemplateStepPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; step: string }>;
}) {
  const { locale, slug, step } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Templates");
  const [overview, steps, doc] = await Promise.all([
    getTemplateOverview(slug, locale as Locale),
    getTemplateSteps(slug, locale as Locale),
    getTemplateStep(slug, step, locale as Locale),
  ]);
  if (!overview || !doc) notFound();

  const index = steps.findIndex((s) => s.slug === step);
  if (index === -1) notFound();
  const prev = index > 0 ? steps[index - 1] : null;
  const next = index < steps.length - 1 ? steps[index + 1] : null;

  const components = buildMdxComponents({
    copyCode: t("copyCode"),
    codeCopied: t("codeCopied"),
  });
  const tocLabels = {
    onThisPage: t("onThisPage"),
    copyLink: t("copyLink"),
    linkCopied: t("linkCopied"),
  };
  const sidebarLabels = { stepsTitle: t("stepsTitle") };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://papayaclaw.com";
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: `${doc.frontmatter.title} — ${overview.frontmatter.title}`,
      description: doc.frontmatter.description,
      inLanguage: "es",
      url: `${baseUrl}${stepPath(locale, slug, step)}`,
      author: [{ "@type": "Organization", name: "PapayaClaw", url: baseUrl }],
      publisher: { "@type": "Organization", name: "PapayaClaw", url: baseUrl },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
        { "@type": "ListItem", position: 2, name: "Templates", item: `${baseUrl}/templates` },
        {
          "@type": "ListItem",
          position: 3,
          name: overview.frontmatter.title,
          item: `${baseUrl}/templates/${slug}`,
        },
        {
          "@type": "ListItem",
          position: 4,
          name: doc.frontmatter.title,
          item: `${baseUrl}${stepPath(locale, slug, step)}`,
        },
      ],
    },
  ];

  const breadcrumbLinkClass =
    "rounded-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ScrollToHash />
      <Header />
      <main className="flex-1 w-full px-6 py-16">
        <div className="mx-auto w-full max-w-7xl lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[220px_minmax(0,1fr)_240px]">
          <TemplateSidebar
            templateSlug={slug}
            templateTitle={overview.frontmatter.title}
            emoji={overview.frontmatter.emoji}
            steps={steps}
            currentStep={step}
            variant="desktop"
            labels={sidebarLabels}
          />

          <div className="min-w-0 max-w-3xl">
            <TemplateSidebar
              templateSlug={slug}
              templateTitle={overview.frontmatter.title}
              emoji={overview.frontmatter.emoji}
              steps={steps}
              currentStep={step}
              variant="mobile"
              labels={sidebarLabels}
            />

            <nav aria-label="Breadcrumb" className="flex items-center text-sm">
              <Link href="/templates" className={breadcrumbLinkClass}>
                {t("tagPlural")}
              </Link>
              <ChevronRight
                aria-hidden="true"
                className="mx-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50"
              />
              <Link
                href={`/templates/${slug}`}
                className={`${breadcrumbLinkClass} truncate`}
              >
                {overview.frontmatter.title}
              </Link>
            </nav>

            <p className="mt-6 font-mono text-xs uppercase tracking-widest text-violet-400">
              {t("stepLabel", { current: index + 1, total: steps.length })}
            </p>
            <h1 className="mt-2 text-3xl md:text-4xl font-medium tracking-tight text-foreground">
              {doc.frontmatter.title}
            </h1>
            <p className="mt-3 text-base text-muted-foreground">{doc.frontmatter.description}</p>

            <div className="mt-8 border-t border-border" />

            <TableOfContents items={doc.toc} variant="mobile" labels={tocLabels} />

            <article className="mdx-content prose-invert mt-10">
              <MDXRemote source={doc.content} components={components} options={mdxRenderOptions} />
            </article>

            <StepPager
              templateSlug={slug}
              prev={prev}
              next={next}
              labels={{
                prevStep: t("prevStep"),
                nextStep: t("nextStep"),
                finishTitle: t("finishTitle"),
                finishCta: t("finishCta"),
              }}
            />
          </div>

          <TableOfContents items={doc.toc} variant="desktop" labels={tocLabels} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
