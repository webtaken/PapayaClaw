import { notFound } from "next/navigation";
import { getBlogPost, getBlogPosts } from "@/lib/mdx";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { MDXRemote } from "next-mdx-remote/rsc";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";

interface BlogPostPageProps {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateStaticParams() {
  const posts = await getBlogPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: BlogPostPageProps) {
  const resolvedParams = await params;
  const post = await getBlogPost(resolvedParams.slug);
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
    },
    twitter: {
      card: "summary_large_image",
      title: post.frontmatter.title,
      description: post.frontmatter.summary,
    },
    alternates: {
      canonical: `/blog/${post.frontmatter.slug}`,
    },
  };
}

const components = {
  h1: (props: any) => <h1 className="text-4xl font-bold mb-6 text-white" {...props} />,
  h2: (props: any) => <h2 className="text-3xl font-semibold mt-10 mb-4 text-white" {...props} />,
  h3: (props: any) => <h3 className="text-2xl font-semibold mt-8 mb-4 text-zinc-100" {...props} />,
  p: (props: any) => <p className="text-lg leading-relaxed mb-6 text-zinc-300" {...props} />,
  ul: (props: any) => <ul className="list-disc list-inside mb-6 text-zinc-300 space-y-2" {...props} />,
  ol: (props: any) => <ol className="list-decimal list-inside mb-6 text-zinc-300 space-y-2" {...props} />,
  li: (props: any) => <li className="pl-2" {...props} />,
  a: (props: any) => <a className="text-primary hover:underline font-medium" {...props} />,
  blockquote: (props: any) => <blockquote className="border-l-4 border-primary pl-4 italic my-6 text-zinc-400 bg-zinc-900/50 py-2 pr-4 rounded-r" {...props} />,
  code: (props: any) => <code className="bg-zinc-800 text-pink-400 px-1.5 py-0.5 rounded text-sm font-mono" {...props} />,
  pre: (props: any) => <pre className="bg-[#111] p-4 rounded-xl overflow-x-auto mb-6 border border-zinc-800 shadow-2xl" {...props} />,
  strong: (props: any) => <strong className="font-bold text-white" {...props} />,
};

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const resolvedParams = await params;
  setRequestLocale(resolvedParams.locale);
  const post = await getBlogPost(resolvedParams.slug);
  const t = await getTranslations("Blog");

  if (!post) {
    notFound();
  }

  const { frontmatter, content } = post;
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
    <div className="min-h-screen bg-[#07080a] text-zinc-100 flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-20">
        <Link href="/blog" className="inline-flex items-center text-sm font-semibold text-primary hover:text-white transition-colors mb-8">
          <span className="mr-2">←</span> {t("readArticle") === "Leer artículo" ? "Volver al Blog" : "Back to Blog"}
        </Link>
        
        <article>
          <header className="mb-12 border-b border-zinc-800 pb-8">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-6 leading-tight">
              {frontmatter.title}
            </h1>
            <div className="flex items-center text-sm text-zinc-400 font-medium tracking-wide uppercase">
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
            <MDXRemote source={content} components={components} />
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
