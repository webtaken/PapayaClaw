import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { z } from 'zod';
import { extractToc, type TocEntry } from './toc';
import type { Locale } from './mdx';

const LOCALES: Locale[] = ['en', 'es'];

const OverviewFrontmatterSchema = z.object({
  title: z.string().min(1),
  tagline: z.string().min(1),
  summary: z.string().min(1),
  emoji: z.string().optional(),
  draft: z.boolean().optional(),
  order: z.number().int().optional(),
});

const StepFrontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  order: z.number().int().positive(),
});

export type TemplateOverview = z.infer<typeof OverviewFrontmatterSchema> & { slug: string };
export type TemplateStepMeta = z.infer<typeof StepFrontmatterSchema> & { slug: string };

export type TemplateDocPage<F> = {
  frontmatter: F;
  content: string;
  toc: TocEntry[];
  availableLocales: Locale[];
};

const defaultDir = () => path.join(process.cwd(), 'src/content/templates');

function resolveDocFile(folder: string, locale: Locale): string | null {
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) return null;
  const tryOrder: Locale[] = [locale, ...LOCALES.filter((l) => l !== locale)];
  for (const l of tryOrder) {
    for (const ext of ['mdx', 'md'] as const) {
      const p = path.join(folder, `${l}.${ext}`);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

function localesIn(folder: string): Locale[] {
  return LOCALES.filter((l) =>
    (['mdx', 'md'] as const).some((ext) => fs.existsSync(path.join(folder, `${l}.${ext}`)))
  );
}

function parseValidated<S extends z.ZodTypeAny>(schema: S, filePath: string): { frontmatter: z.infer<S>; content: string } {
  const { data, content } = matter(fs.readFileSync(filePath, 'utf8'));
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid frontmatter in ${filePath}: ${msg}`);
  }
  return { frontmatter: parsed.data, content };
}

function readOverview(slug: string, locale: Locale, dir: string): TemplateDocPage<TemplateOverview> | null {
  const folder = path.join(dir, slug, 'index');
  const filePath = resolveDocFile(folder, locale);
  if (!filePath) return null;
  const { frontmatter, content } = parseValidated(OverviewFrontmatterSchema, filePath);
  return {
    frontmatter: { ...frontmatter, slug },
    content,
    toc: extractToc(content),
    availableLocales: localesIn(folder),
  };
}

export async function getTemplateSlugs(dir = defaultDir()): Promise<string[]> {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((slug) => {
      const overview = readOverview(slug, 'en', dir);
      return overview !== null && !overview.frontmatter.draft;
    });
}

export async function getTemplates(locale: Locale, dir = defaultDir()): Promise<TemplateOverview[]> {
  const slugs = await getTemplateSlugs(dir);
  return slugs
    .map((slug) => readOverview(slug, locale, dir)!.frontmatter)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title));
}

export async function getTemplateOverview(
  slug: string,
  locale: Locale,
  dir = defaultDir()
): Promise<TemplateDocPage<TemplateOverview> | null> {
  const page = readOverview(slug, locale, dir);
  if (!page || page.frontmatter.draft) return null;
  return page;
}

export async function getTemplateSteps(
  slug: string,
  locale: Locale,
  dir = defaultDir()
): Promise<TemplateStepMeta[]> {
  const templateDir = path.join(dir, slug);
  if (!fs.existsSync(templateDir)) return [];
  const steps: TemplateStepMeta[] = [];
  for (const entry of fs.readdirSync(templateDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'index') continue;
    const filePath = resolveDocFile(path.join(templateDir, entry.name), locale);
    if (!filePath) continue;
    const { frontmatter } = parseValidated(StepFrontmatterSchema, filePath);
    steps.push({ ...frontmatter, slug: entry.name });
  }
  return steps.sort((a, b) => a.order - b.order);
}

export async function getTemplateStep(
  slug: string,
  step: string,
  locale: Locale,
  dir = defaultDir()
): Promise<TemplateDocPage<TemplateStepMeta> | null> {
  const folder = path.join(dir, slug, step);
  if (step === 'index') return null;
  const filePath = resolveDocFile(folder, locale);
  if (!filePath) return null;
  const { frontmatter, content } = parseValidated(StepFrontmatterSchema, filePath);
  return {
    frontmatter: { ...frontmatter, slug: step },
    content,
    toc: extractToc(content),
    availableLocales: localesIn(folder),
  };
}
