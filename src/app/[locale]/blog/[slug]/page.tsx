import { Children } from "react";
import { notFound } from "next/navigation";
import { getBlogPost, getBlogSlugs } from "@/lib/mdx";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";
import { TableOfContents } from "@/components/blog/table-of-contents";
import { CodeBlock } from "@/components/blog/code-block";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import Image from "next/image";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";

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

function getRawText(node: any): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getRawText).join("");
  if (node?.props?.children) return getRawText(node.props.children);
  return "";
}

function buildComponents(labels: { copyCode: string; codeCopied: string }) {
  return {
  h1: (props: any) => <h1 className="text-4xl font-bold mb-6 text-foreground" {...props} />,
  h2: (props: any) => <h2 className="text-3xl font-semibold mt-10 mb-4 text-foreground" {...props} />,
  h3: (props: any) => <h3 className="text-2xl font-semibold mt-8 mb-4 text-foreground" {...props} />,
  p: ({ children, ...props }: any) => {
    const hasBlockChild =
      Children.toArray(children).some(
        (child: any) => child?.type === "figure" || child?.props?.src
      );
    return hasBlockChild ? (
      <div className="text-lg leading-relaxed mb-6 text-muted-foreground" {...props}>{children}</div>
    ) : (
      <p className="text-lg leading-relaxed mb-6 text-muted-foreground" {...props}>{children}</p>
    );
  },
  ul: (props: any) => <ul className="list-disc list-inside mb-6 text-muted-foreground space-y-2" {...props} />,
  ol: (props: any) => <ol className="list-decimal list-inside mb-6 text-muted-foreground space-y-2" {...props} />,
  li: (props: any) => <li className="pl-2" {...props} />,
  a: (props: any) => <a className="text-primary hover:underline font-medium" {...props} />,
  blockquote: (props: any) => <blockquote className="border-l-4 border-primary pl-4 italic my-6 text-muted-foreground bg-muted/50 py-2 pr-4 rounded-r" {...props} />,
  code: (props: any) => <code className="bg-muted text-pink-400 px-1.5 py-0.5 rounded text-sm font-mono" {...props} />,
  pre: ({ children, ...props }: any) => {
    const code = getRawText(children);
    return (
      <CodeBlock code={code} copyLabel={labels.copyCode} copiedLabel={labels.codeCopied} {...props}>
        {children}
      </CodeBlock>
    );
  },
  strong: (props: any) => <strong className="font-bold text-foreground" {...props} />,
  table: (props: any) => (
    <div className="overflow-x-auto mb-6">
      <table className="w-full text-sm text-left text-muted-foreground border-collapse border border-border" {...props} />
    </div>
  ),
  thead: (props: any) => <thead className="bg-muted text-foreground uppercase text-xs tracking-wider" {...props} />,
  tbody: (props: any) => <tbody className="divide-y divide-border" {...props} />,
  tr: (props: any) => <tr className="border-b border-border hover:bg-muted/50 transition-colors" {...props} />,
  th: (props: any) => <th className="px-4 py-3 font-bold border border-border" {...props} />,
  td: (props: any) => <td className="px-4 py-3 border border-border" {...props} />,
  img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <figure className="my-8">
      <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-border bg-muted/50">
        <Image
          src={(props.src as string) || ""}
          alt={props.alt || ""}
          fill
          sizes="(max-width: 768px) 100vw, 720px"
          className="object-contain"
        />
      </div>
      {props.title && (
        <figcaption className="mt-2 text-center text-sm text-muted-foreground italic">
          {props.title}
        </figcaption>
      )}
    </figure>
  ),
  video: ({ title, className, ...props }: React.VideoHTMLAttributes<HTMLVideoElement> & { title?: string }) => (
    <figure className="my-8 flex flex-col items-center">
      <video
        controls
        playsInline
        preload="metadata"
        className={className ?? "max-h-[70vh] w-auto max-w-full rounded-xl border border-border bg-muted/50"}
        {...props}
      />
      {title && (
        <figcaption className="mt-2 text-center text-sm text-muted-foreground italic">
          {title}
        </figcaption>
      )}
    </figure>
  ),
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
  const components = buildComponents({
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
              options={{
                mdxOptions: {
                  remarkPlugins: [remarkGfm],
                  rehypePlugins: [
                    rehypeSlug,
                    [
                      rehypeAutolinkHeadings,
                      {
                        behavior: "append",
                        properties: {
                          className: ["heading-anchor"],
                          ariaLabel: "Link to section",
                        },
                        content: {
                          type: "element",
                          tagName: "span",
                          properties: { className: ["heading-anchor-icon"] },
                          children: [{ type: "text", value: "#" }],
                        },
                      },
                    ],
                  ],
                },
              }}
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
