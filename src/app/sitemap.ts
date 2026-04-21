import type { MetadataRoute } from 'next';
import { getBlogPosts, getBlogSlugs } from '@/lib/mdx';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
      alternates: {
        languages: {
          en: `${baseUrl}/`,
          es: `${baseUrl}/es`,
        },
      },
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
      alternates: {
        languages: {
          en: `${baseUrl}/pricing`,
          es: `${baseUrl}/es/pricing`,
        },
      },
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
      alternates: {
        languages: {
          en: `${baseUrl}/blog`,
          es: `${baseUrl}/es/blog`,
        },
      },
    },
  ];

  const slugs = await getBlogSlugs();
  const enPosts = await getBlogPosts('en');
  const dateBySlug = new Map(enPosts.map((p) => [p.slug, p.date]));
  const esPosts = await getBlogPosts('es');
  for (const p of esPosts) if (!dateBySlug.has(p.slug)) dateBySlug.set(p.slug, p.date);

  const dynamicRoutes: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${baseUrl}/blog/${slug}`,
    lastModified: new Date(dateBySlug.get(slug) || new Date()),
    changeFrequency: 'monthly',
    priority: 0.6,
    alternates: {
      languages: {
        en: `${baseUrl}/blog/${slug}`,
        es: `${baseUrl}/es/blog/${slug}`,
      },
    },
  }));

  return [...staticRoutes, ...dynamicRoutes];
}
