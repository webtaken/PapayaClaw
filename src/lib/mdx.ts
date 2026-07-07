import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { z } from 'zod';
import { extractToc, type TocEntry } from './toc';

export type { TocEntry };

const FrontmatterSchema = z.object({
  title: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'date must be ISO (YYYY-MM-DD)'),
  summary: z.string().min(1),
  image: z.string().optional(),
});

const blogDir = path.join(process.cwd(), 'src/content/blog');

export type BlogPostFrontmatter = {
  title: string;
  date: string;
  summary: string;
  slug: string;
  image?: string;
};

export type BlogPost = {
  frontmatter: BlogPostFrontmatter;
  content: string;
  toc: TocEntry[];
};

export type Locale = 'en' | 'es';
const LOCALES: Locale[] = ['en', 'es'];
const DEFAULT_LOCALE: Locale = 'en';

function resolvePostFile(slug: string, locale: Locale): { filePath: string; resolvedLocale: Locale } | null {
  const folder = path.join(blogDir, slug);
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) return null;

  const tryOrder: Locale[] = [locale, ...LOCALES.filter((l) => l !== locale)];
  for (const l of tryOrder) {
    for (const ext of ['mdx', 'md'] as const) {
      const p = path.join(folder, `${l}.${ext}`);
      if (fs.existsSync(p)) return { filePath: p, resolvedLocale: l };
    }
  }
  return null;
}

function buildFrontmatter(
  data: Record<string, unknown>,
  slug: string,
  source: string
): BlogPostFrontmatter {
  const parsed = FrontmatterSchema.safeParse(data);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid frontmatter in ${source}: ${msg}`);
  }
  return { ...parsed.data, slug };
}

export async function getBlogPosts(locale: Locale = DEFAULT_LOCALE): Promise<BlogPostFrontmatter[]> {
  if (!fs.existsSync(blogDir)) return [];

  const entries = fs.readdirSync(blogDir, { withFileTypes: true });
  const posts: BlogPostFrontmatter[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const resolved = resolvePostFile(entry.name, locale);
    if (!resolved) continue;
    const fileContent = fs.readFileSync(resolved.filePath, 'utf8');
    const { data } = matter(fileContent);
    posts.push(buildFrontmatter(data, entry.name, resolved.filePath));
  }

  return posts.sort((a, b) => (new Date(a.date) > new Date(b.date) ? -1 : 1));
}

export async function getBlogSlugs(): Promise<string[]> {
  if (!fs.existsSync(blogDir)) return [];
  return fs
    .readdirSync(blogDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

export async function getBlogPost(slug: string, locale: Locale = DEFAULT_LOCALE): Promise<BlogPost | null> {
  const resolved = resolvePostFile(slug, locale);
  if (!resolved) return null;

  const fileContent = fs.readFileSync(resolved.filePath, 'utf8');
  const { data, content } = matter(fileContent);

  return {
    frontmatter: buildFrontmatter(data, slug, resolved.filePath),
    content,
    toc: extractToc(content),
  };
}
