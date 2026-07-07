import type { MetadataRoute } from 'next';
import { getBlogPosts, getBlogSlugs } from '@/lib/mdx';
import { getTemplateSlugs, getTemplateSteps, getTemplateOverview, getTemplateStep } from '@/lib/template-docs';

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
    {
      url: `${baseUrl}/templates`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
      alternates: {
        languages: {
          en: `${baseUrl}/templates`,
          es: `${baseUrl}/es/templates`,
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

  const templateSlugs = await getTemplateSlugs();
  const templateRoutes: MetadataRoute.Sitemap = [];
  for (const slug of templateSlugs) {
    const overview = await getTemplateOverview(slug, 'en');
    if (!overview) continue;
    const langs = (locales: ('en' | 'es')[], p: string) =>
      Object.fromEntries(
        locales.map((l) => [l, l === 'es' ? `${baseUrl}/es${p}` : `${baseUrl}${p}`])
      );
    templateRoutes.push({
      url: `${baseUrl}/templates/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
      alternates: { languages: langs(overview.availableLocales, `/templates/${slug}`) },
    });
    const steps = await getTemplateSteps(slug, 'en');
    for (const step of steps) {
      const doc = await getTemplateStep(slug, step.slug, 'en');
      if (!doc) continue;
      templateRoutes.push({
        url: `${baseUrl}/templates/${slug}/${step.slug}`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.6,
        alternates: {
          languages: langs(doc.availableLocales, `/templates/${slug}/${step.slug}`),
        },
      });
    }
  }

  return [...staticRoutes, ...dynamicRoutes, ...templateRoutes];
}
