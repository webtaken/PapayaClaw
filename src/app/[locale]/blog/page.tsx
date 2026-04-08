import Link from "next/link";
import Image from "next/image";
import { getBlogPosts } from "@/lib/mdx";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Blog" });

  return {
    title: t("title"),
    description: t("description"),
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: "/blog",
    },
    alternates: {
      canonical: locale === "es" ? "/es/blog" : "/blog",
      languages: {
        en: "/blog",
        es: "/es/blog",
      },
    },
  };
}

export default async function BlogIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const posts = await getBlogPosts();
  const t = await getTranslations("Blog");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-20">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
          {t("title")}
        </h1>
        <p className="text-lg text-muted-foreground mb-12 max-w-2xl">
          {t("description")}
        </p>

        {posts.length === 0 ? (
          <div className="text-muted-foreground py-10 border-t border-border">
            {t("noPosts")}
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group flex flex-col justify-between rounded-2xl border border-border bg-muted/40 p-6 transition-all hover:bg-muted/60 hover:border-border"
              >
                {post.image && (
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden mb-4">
                    <Image
                      src={post.image}
                      alt={post.title}
                      fill
                      sizes="400px"
                      className="object-cover"
                    />
                  </div>
                )}
                <div>
                  <div className="text-xs text-primary font-bold uppercase tracking-wider mb-2">
                    {new Date(post.date).toLocaleDateString(
                      locale === "es" ? "es-419" : "en-US",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {post.summary}
                  </p>
                </div>
                <div className="mt-6 flex items-center text-sm font-semibold text-foreground">
                  {t("readArticle")}{" "}
                  <span className="ml-2 transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
