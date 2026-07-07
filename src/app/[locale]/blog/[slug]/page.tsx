import { notFound } from "next/navigation";
import { getBlogPost, getBlogSlugs } from "@/lib/mdx";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";
import { TableOfContents } from "@/components/blog/table-of-contents";
import { ScrollToHash } from "@/components/blog/scroll-to-hash";
import { MDXRemote } from "next-mdx-remote/rsc";
import Image from "next/image";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { buildMdxComponents, mdxRenderOptions } from "@/components/mdx/mdx-components";

interface BlogPostPageProps {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateStaticParams() {
  const slugs = await getBlogSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps) {
  const resolvedParams = await params;
  const post = await getBlogPost(resolvedParams.slug, resolvedParams.locale as "en" | "es");
  if (!post) return { title: "Post Not Found" };

  return {
    title: post.frontmatter.title,
    description: post.frontmatter.summary,
    openGraph: {
      title: post.frontmatter.title,
      description: post.frontmatter.summary,
      type: "article",
      publishedTime: post.frontmatter.date,
      url: `/blog/${post.frontmatter.slug}`,
      ...(post.frontmatter.image && {
        images: [{ url: post.frontmatter.image }],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: post.frontmatter.title,
      description: post.frontmatter.summary,
      ...(post.frontmatter.image && {
        images: [post.frontmatter.image],
      }),
    },
    alternates: {
      canonical: `/blog/${post.frontmatter.slug}`,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const resolvedParams = await params;
  setRequestLocale(resolvedParams.locale);
  const post = await getBlogPost(resolvedParams.slug, resolvedParams.locale as "en" | "es");
  const t = await getTranslations("Blog");

  if (!post) {
    notFound();
  }

  const { frontmatter, content, toc } = post;
  const tocLabels = {
    onThisPage: t("onThisPage"),
    copyLink: t("copyLink"),
    linkCopied: t("linkCopied"),
  };
  const components = buildMdxComponents({
    copyCode: t("copyCode"),
    codeCopied: t("codeCopied"),
  });
  const dateLocale = resolvedParams.locale === "es" ? "es-419" : "en-US";

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://papayaclaw.com";

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: frontmatter.title,
      description: frontmatter.summary,
      datePublished: frontmatter.date,
      url: `${baseUrl}/blog/${frontmatter.slug}`,
      author: [{
        "@type": "Organization",
        name: "PapayaClaw",
        url: baseUrl,
      }],
      publisher: {
        "@type": "Organization",
        name: "PapayaClaw",
        url: baseUrl,
      },
      ...(frontmatter.image && { image: `${baseUrl}${frontmatter.image}` }),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: baseUrl,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Blog",
          item: `${baseUrl}/blog`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: frontmatter.title,
          item: `${baseUrl}/blog/${frontmatter.slug}`,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ScrollToHash />
      <Header />
      <main className="flex-1 w-full px-6 py-20">
        <div className="mx-auto w-full max-w-3xl xl:max-w-6xl xl:grid xl:grid-cols-[minmax(0,1fr)_240px] xl:gap-12">
          <div className="min-w-0">
            <Link href="/blog" className="inline-flex items-center text-sm font-semibold text-primary hover:text-foreground transition-colors mb-8">
              <span className="mr-2">←</span> {t("readArticle") === "Leer artículo" ? "Volver al Blog" : "Back to Blog"}
            </Link>

            <TableOfContents items={toc} variant="mobile" labels={tocLabels} />

            <article>
          <header className="mb-12 border-b border-border pb-8">
            {frontmatter.image && (
              <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-border mb-8">
                <Image
                  src={frontmatter.image}
                  alt={frontmatter.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 720px"
                  className="object-cover"
                  priority
                />
              </div>
            )}
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-6 leading-tight">
              {frontmatter.title}
            </h1>
            <div className="flex items-center text-sm text-muted-foreground font-medium tracking-wide uppercase">
              <time dateTime={frontmatter.date}>
                {new Date(frontmatter.date).toLocaleDateString(dateLocale, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            </div>
          </header>
          
          <div className="mdx-content prose-invert">
            <MDXRemote
              source={content}
              components={components}
              options={mdxRenderOptions}
            />
          </div>
        </article>
          </div>
          <TableOfContents items={toc} variant="desktop" labels={tocLabels} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
