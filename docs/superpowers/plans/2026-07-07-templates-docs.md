# Templates v2 — Docs-Style Guide Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the (never-merged) v1 template landings + SOUL.md baking with documentation-style, multi-page guide pages rendered from MDX in the repo; first guide is Fórmula 100K.

**Architecture:** Generalize the blog's MDX pipeline (`src/lib/mdx.ts` + `next-mdx-remote/rsc`) into a template-docs content library reading `src/content/templates/<slug>/<step>/{es,en}.mdx`. Three routes under `[locale]`: gallery, template overview, step page (sidebar + MDX + TOC + prev/next). Shared TOC extraction and MDX element styles are extracted from the blog so both features use one implementation. No DB, no new dependencies.

**Tech Stack:** TypeScript 5 (strict), Next.js 16 App Router, React 19, Tailwind CSS 4, next-intl 4.8 (`localePrefix: "as-needed"`), next-mdx-remote 5 (RSC), gray-matter, zod, github-slugger, remark-gfm, rehype-slug, rehype-autolink-headings, Lucide, vitest.

**Spec:** `docs/superpowers/specs/2026-07-07-templates-docs-design.md`
**Branch:** `feat/templates-docs` (created from `origin/main`; the v1 branch `feat/templates-v1` is reference-only and never merged).

## Global Constraints

- Zero new npm dependencies. Everything needed is already installed.
- `npm test && npm run lint` must pass after every task (project command from CLAUDE.md).
- All UI work (Tasks 6–9) must be implemented with the **frontend-design / interface-design / shadcn** skills, per project rule. This plan gives functional baseline markup + design intent; the skill pass owns final polish. Brand: shadcn new-york, dark, violet accent (`text-violet-400`, violet/blue gradient CTAs — see the blog pages and `src/app/[locale]/page.tsx` for reference).
- Internal links in `[locale]` pages use `Link` from `@/i18n/navigation` (never for `/api/*` — known next-intl 404 issue, no API links exist in this feature).
- No DB/schema/drizzle changes anywhere in this plan.
- Guide content is Spanish (`es.mdx` only at launch); UI chrome is localized en+es via next-intl.
- Locale handling: visitor's locale file served if present, else fall back to the other locale (blog pattern). hreflang/canonical only declare locales whose file exists.
- Content files use frontmatter validated by zod — invalid frontmatter must throw (fail the build), never be skipped silently.

---

### Task 1: Extract shared TOC module `src/lib/toc.ts`

The blog's `TocEntry` type + `extractToc()` live inside `src/lib/mdx.ts` (lines 24–74). Template docs need them too. Extract to a shared module; `mdx.ts` re-exports the type so existing importers (`src/components/blog/table-of-contents.tsx` imports `TocEntry` from `@/lib/mdx`) keep working.

**Files:**
- Create: `src/lib/toc.ts`
- Create: `src/lib/toc.test.ts`
- Modify: `src/lib/mdx.ts` (delete moved code, import/re-export instead)

**Interfaces:**
- Consumes: nothing new.
- Produces: `export type TocEntry = { depth: number; text: string; id: string; children: TocEntry[] }` and `export function extractToc(markdown: string): TocEntry[]` from `@/lib/toc`. Later tasks import from `@/lib/toc`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/toc.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extractToc } from "./toc";

describe("extractToc", () => {
  it("builds a nested tree from h2/h3 and skips h1", () => {
    const md = [
      "# Title (skipped)",
      "## Alpha",
      "### Alpha child",
      "## Beta",
    ].join("\n");
    const toc = extractToc(md);
    expect(toc).toHaveLength(2);
    expect(toc[0]).toMatchObject({ depth: 2, text: "Alpha", id: "alpha" });
    expect(toc[0].children[0]).toMatchObject({ depth: 3, text: "Alpha child", id: "alpha-child" });
    expect(toc[1]).toMatchObject({ depth: 2, text: "Beta", id: "beta" });
  });

  it("ignores headings inside fenced code blocks", () => {
    const md = "## Real\n```bash\n## not a heading\n```\n";
    const toc = extractToc(md);
    expect(toc).toHaveLength(1);
    expect(toc[0].text).toBe("Real");
  });

  it("strips inline formatting and slugs like github-slugger", () => {
    const md = "## **Bold** `code` [link](https://x.dev)";
    const toc = extractToc(md);
    expect(toc[0].text).toBe("Bold code link");
    expect(toc[0].id).toBe("bold-code-link");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/toc.test.ts`
Expected: FAIL — `Cannot find module './toc'` (or equivalent resolve error).

- [ ] **Step 3: Create `src/lib/toc.ts`**

Move the code verbatim from `src/lib/mdx.ts` (the `TocEntry` type, lines 24–29, and `extractToc`, lines 37–74):

```ts
import GithubSlugger from 'github-slugger';

export type TocEntry = {
  depth: number;
  text: string;
  id: string;
  children: TocEntry[];
};

export function extractToc(markdown: string): TocEntry[] {
  const slugger = new GithubSlugger();
  const stripped = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/~~~[\s\S]*?~~~/g, '');

  const flat: Omit<TocEntry, 'children'>[] = [];
  const re = /^(#{1,6})\s+(.+?)\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const depth = m[1].length;
    if (depth === 1) continue;
    const text = m[2]
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();
    flat.push({ depth, text, id: slugger.slug(text) });
  }

  const root: TocEntry[] = [];
  const stack: TocEntry[] = [];
  for (const item of flat) {
    const entry: TocEntry = { ...item, children: [] };
    while (stack.length && stack[stack.length - 1].depth >= entry.depth) {
      stack.pop();
    }
    if (stack.length === 0) {
      root.push(entry);
    } else {
      stack[stack.length - 1].children.push(entry);
    }
    stack.push(entry);
  }
  return root;
}
```

In `src/lib/mdx.ts`: delete the moved type + function and the now-unused `import GithubSlugger from 'github-slugger';`, then add at the top:

```ts
import { extractToc } from './toc';

export type { TocEntry } from './toc';
```

(The `export type` re-export keeps `src/components/blog/table-of-contents.tsx` — which does `import type { TocEntry } from "@/lib/mdx"` — compiling untouched.)

- [ ] **Step 4: Run tests and lint to verify everything passes**

Run: `npx vitest run && npm run lint`
Expected: `toc.test.ts` PASSES, all pre-existing tests still pass, lint clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/toc.ts src/lib/toc.test.ts src/lib/mdx.ts
git commit -m "refactor: extract TOC extraction into shared src/lib/toc.ts"
```

---

### Task 2: Extract shared MDX components `src/components/mdx/mdx-components.tsx`

The blog post page defines ~80 lines of MDX element styles (`buildComponents`, `getRawText`) inline in `src/app/[locale]/blog/[slug]/page.tsx:58-141`, plus the MDXRemote plugin options object (lines 262–285). Template pages need identical rendering. Extract both into one shared module; the blog page imports them.

**Files:**
- Create: `src/components/mdx/mdx-components.tsx`
- Modify: `src/app/[locale]/blog/[slug]/page.tsx`

**Interfaces:**
- Consumes: `CodeBlock` from `@/components/blog/code-block` (props: `{ code, copyLabel, copiedLabel, children, className? }`).
- Produces:
  - `export function buildMdxComponents(labels: { copyCode: string; codeCopied: string }): MDXComponents`
  - `export const mdxRenderOptions` — the `options` object for `<MDXRemote>` (remarkGfm + rehypeSlug + rehypeAutolinkHeadings config).

- [ ] **Step 1: Create the shared module**

Create `src/components/mdx/mdx-components.tsx`. Move `getRawText` and the entire `buildComponents` body **verbatim** from `src/app/[locale]/blog/[slug]/page.tsx` (only the function name changes to `buildMdxComponents`), and move the MDXRemote `options` value as `mdxRenderOptions`:

```tsx
import { Children } from "react";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { CodeBlock } from "@/components/blog/code-block";

function getRawText(node: any): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getRawText).join("");
  if (node?.props?.children) return getRawText(node.props.children);
  return "";
}

export function buildMdxComponents(labels: { copyCode: string; codeCopied: string }) {
  return {
    // ... paste the FULL object literal returned by buildComponents in
    // src/app/[locale]/blog/[slug]/page.tsx lines 67-140, unchanged:
    // h1, h2, h3, p, ul, ol, li, a, blockquote, code, pre (wraps CodeBlock
    // with labels.copyCode / labels.codeCopied), strong, table, thead,
    // tbody, tr, th, td, img (figure wrapper), video (figure wrapper).
  };
}

export const mdxRenderOptions = {
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
} as const;
```

The `// ... paste` comment above is an instruction to move the existing code, not to write new code — the object literal must be copied byte-for-byte from the blog page (it is already reviewed, working code). `Children` is used inside the `p` component's block-child check; keep that import.

- [ ] **Step 2: Rewire the blog page**

In `src/app/[locale]/blog/[slug]/page.tsx`:
- Delete `getRawText`, `buildComponents`, and the imports they exclusively used (`Children` from react, `CodeBlock`, `remarkGfm`, `rehypeSlug`, `rehypeAutolinkHeadings`).
- Add `import { buildMdxComponents, mdxRenderOptions } from "@/components/mdx/mdx-components";`
- Replace `const components = buildComponents({...})` with `const components = buildMdxComponents({ copyCode: t("copyCode"), codeCopied: t("codeCopied") });`
- Replace the inline `options={{ mdxOptions: {...} }}` on `<MDXRemote>` with `options={mdxRenderOptions}`.

- [ ] **Step 3: Verify — tests, lint, build, visual**

Run: `npx vitest run && npm run lint && npm run build`
Expected: all pass; build succeeds and emits the blog routes.

Then: `npm run dev`, open `http://localhost:3000/blog/getting-started-with-nemoclaw` and `http://localhost:3000/es/blog/getting-started-with-nemoclaw` — headings, code blocks (copy button works), tables, and images render identically to before.

- [ ] **Step 4: Commit**

```bash
git add src/components/mdx/mdx-components.tsx "src/app/[locale]/blog/[slug]/page.tsx"
git commit -m "refactor: extract shared MDX components and render options from blog page"
```

---

### Task 3: Content library `src/lib/template-docs.ts` (TDD)

The heart of the feature: reads `src/content/templates/`, validates frontmatter with zod, resolves locale with fallback, orders steps. Mirrors `src/lib/mdx.ts` idioms (sync `fs`, `gray-matter`, throw on invalid frontmatter).

**Files:**
- Create: `src/lib/template-docs.ts`
- Create: `src/lib/template-docs.test.ts`

**Interfaces:**
- Consumes: `extractToc`, `TocEntry` from `@/lib/toc`; `Locale` type from `@/lib/mdx` (`'en' | 'es'`).
- Produces (exact signatures — pages in Tasks 6–9 call these):

```ts
export type TemplateOverview = {
  slug: string; title: string; tagline: string; summary: string;
  emoji?: string; draft?: boolean; order?: number;
};
export type TemplateStepMeta = {
  slug: string; title: string; description: string; order: number;
};
export type TemplateDocPage<F> = {
  frontmatter: F; content: string; toc: TocEntry[];
  availableLocales: Locale[];
};
// Every function takes an optional trailing `dir` arg (defaults to
// src/content/templates under process.cwd()) — used by tests only.
export async function getTemplateSlugs(dir?: string): Promise<string[]>;            // published only
export async function getTemplates(locale: Locale, dir?: string): Promise<TemplateOverview[]>; // published, sorted by order asc then title
export async function getTemplateOverview(slug: string, locale: Locale, dir?: string): Promise<TemplateDocPage<TemplateOverview> | null>; // null if missing or draft
export async function getTemplateSteps(slug: string, locale: Locale, dir?: string): Promise<TemplateStepMeta[]>; // sorted by order asc; folders with no locale file excluded
export async function getTemplateStep(slug: string, step: string, locale: Locale, dir?: string): Promise<TemplateDocPage<TemplateStepMeta> | null>;
```

Draft gating: pages guard via `getTemplateOverview` returning `null` for drafts; `getTemplateStep` itself does not re-check draft (the step page always fetches the overview first — see Task 9).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/template-docs.test.ts`:

```ts
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getTemplateSlugs,
  getTemplates,
  getTemplateOverview,
  getTemplateSteps,
  getTemplateStep,
} from "./template-docs";

let dir: string;

function write(rel: string, content: string) {
  const p = path.join(dir, rel);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, content);
}

const overviewFm = `---
title: Fórmula 100K
tagline: Tu coach de crecimiento
summary: Un agente mentor de Instagram.
emoji: "🚀"
---
## Qué vas a montar
Contenido overview.
`;

const draftOverviewFm = `---
title: Oculto
tagline: No debería verse
summary: Plantilla en borrador.
draft: true
---
Contenido borrador.
`;

const stepFm = (title: string, order: number) => `---
title: ${title}
description: Descripción de ${title}
order: ${order}
---
## Sección
Contenido de ${title}.
`;

beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "template-docs-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("getTemplates / getTemplateSlugs", () => {
  it("lists published templates and hides drafts", async () => {
    write("formula-100k/index/es.mdx", overviewFm);
    write("hidden/index/es.mdx", draftOverviewFm);
    const slugs = await getTemplateSlugs(dir);
    expect(slugs).toEqual(["formula-100k"]);
    const templates = await getTemplates("es", dir);
    expect(templates).toHaveLength(1);
    expect(templates[0]).toMatchObject({ slug: "formula-100k", title: "Fórmula 100K", emoji: "🚀" });
  });

  it("sorts gallery by order then title", async () => {
    write("b-second/index/es.mdx", overviewFm.replace("title: Fórmula 100K", "title: BBB\norder: 2"));
    write("a-first/index/es.mdx", overviewFm.replace("title: Fórmula 100K", "title: AAA\norder: 1"));
    const templates = await getTemplates("es", dir);
    expect(templates.map((t) => t.title)).toEqual(["AAA", "BBB"]);
  });
});

describe("locale fallback", () => {
  it("serves es content to an en visitor when en.mdx is missing, and reports availableLocales", async () => {
    write("formula-100k/index/es.mdx", overviewFm);
    const page = await getTemplateOverview("formula-100k", "en", dir);
    expect(page).not.toBeNull();
    expect(page!.frontmatter.title).toBe("Fórmula 100K");
    expect(page!.availableLocales).toEqual(["es"]);
  });

  it("prefers the visitor's locale when both exist", async () => {
    write("formula-100k/index/es.mdx", overviewFm);
    write("formula-100k/index/en.mdx", overviewFm.replace("title: Fórmula 100K", "title: Formula 100K EN"));
    const page = await getTemplateOverview("formula-100k", "en", dir);
    expect(page!.frontmatter.title).toBe("Formula 100K EN");
    expect(page!.availableLocales).toEqual(["en", "es"]);
  });
});

describe("steps", () => {
  it("orders steps by frontmatter order and excludes index and empty folders", async () => {
    write("formula-100k/index/es.mdx", overviewFm);
    write("formula-100k/skills/es.mdx", stepFm("Skills", 3));
    write("formula-100k/soul-md/es.mdx", stepFm("SOUL.md", 1));
    write("formula-100k/subagentes/es.mdx", stepFm("Subagentes", 2));
    mkdirSync(path.join(dir, "formula-100k/vacio")); // no locale files → excluded
    const steps = await getTemplateSteps("formula-100k", "es", dir);
    expect(steps.map((s) => s.slug)).toEqual(["soul-md", "subagentes", "skills"]);
    expect(steps[0]).toMatchObject({ title: "SOUL.md", order: 1 });
  });

  it("returns a single step with content and toc", async () => {
    write("formula-100k/soul-md/es.mdx", stepFm("SOUL.md", 1));
    const step = await getTemplateStep("formula-100k", "soul-md", "es", dir);
    expect(step).not.toBeNull();
    expect(step!.frontmatter.description).toBe("Descripción de SOUL.md");
    expect(step!.toc[0]).toMatchObject({ text: "Sección", id: "sección" });
  });

  it("returns null for unknown slug or step", async () => {
    expect(await getTemplateOverview("nope", "es", dir)).toBeNull();
    expect(await getTemplateStep("nope", "nope", "es", dir)).toBeNull();
  });
});

describe("draft gating", () => {
  it("getTemplateOverview returns null for draft templates", async () => {
    write("wip/index/es.mdx", draftOverviewFm);
    expect(await getTemplateOverview("wip", "es", dir)).toBeNull();
  });
});

describe("validation", () => {
  it("throws on invalid step frontmatter (missing order)", async () => {
    write("formula-100k/soul-md/es.mdx", `---\ntitle: X\ndescription: Y\n---\nbody`);
    await expect(getTemplateSteps("formula-100k", "es", dir)).rejects.toThrow(/order/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/template-docs.test.ts`
Expected: FAIL — cannot resolve `./template-docs`.

- [ ] **Step 3: Implement `src/lib/template-docs.ts`**

```ts
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
```

Note: `getTemplateSlugs` probes with `'en'` but `resolveDocFile` falls back across locales, so a Spanish-only template is still found. `Locale` is imported from `./mdx` — single source of truth.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/template-docs.test.ts && npm run lint`
Expected: all PASS, lint clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/template-docs.ts src/lib/template-docs.test.ts
git commit -m "feat: template-docs content library (MDX, locale fallback, ordered steps)"
```

---

### Task 4: Fórmula 100K content (Spanish MDX)

Six content files. The SOUL.md comes verbatim from the v1 seed. **All body copy below is a complete draft; the user refines wording and the exact OpenClaw commands post-implementation** (the guide currently instructs configuration by chatting with the agent — the most portable mechanism; the user validates this against real OpenClaw behavior).

**Files:**
- Create: `src/content/templates/formula-100k/index/es.mdx`
- Create: `src/content/templates/formula-100k/soul-md/es.mdx`
- Create: `src/content/templates/formula-100k/subagentes/es.mdx`
- Create: `src/content/templates/formula-100k/skills/es.mdx`
- Create: `src/content/templates/formula-100k/mcps/es.mdx`
- Create: `src/content/templates/formula-100k/wikis/es.mdx`

**Interfaces:**
- Consumes: frontmatter shapes from Task 3 (`title/tagline/summary/emoji` for index; `title/description/order` for steps).
- Produces: content consumed by pages in Tasks 6–9. Step slugs: `soul-md`, `subagentes`, `skills`, `mcps`, `wikis` (orders 1–5).

- [ ] **Step 1: Recover the v1 SOUL.md content**

```bash
git show feat/templates-v1:scripts/seed-templates.ts
```

Copy the full `FORMULA_100K_SOUL` template-literal body (starts `# SOUL.md — Coach Fórmula 100K`, ends `...sostenible hacia los 100K.`). It is embedded in Step 3 below.

- [ ] **Step 2: Create `index/es.mdx`**

```mdx
---
title: Fórmula 100K
tagline: Tu coach de crecimiento en Instagram para llegar a 100K.
summary: Configura tu instancia de OpenClaw como un mentor de Fórmula 100K — ganchos, guiones y calendarios de contenido para hacer crecer tu negocio en Instagram y convertir seguidores en ventas.
emoji: "🚀"
---

## Qué vas a montar

Al final de esta guía tu agente será un **coach de crecimiento en Instagram**
al estilo Fórmula 100K: convierte ideas vagas en ganchos, guiones y calendarios
de publicación concretos, con foco en retención, llamadas a la acción y
consistencia.

La guía sigue una ruta clara, paso a paso:

1. **SOUL.md** — la personalidad del agente: quién es, cómo habla, qué prioriza.
2. **Subagentes** — un equipo de apoyo (p. ej. un guionista) conectado al agente principal.
3. **Skills** — las habilidades de Fórmula 100K: guionización, hooks y contenido para Instagram.
4. **MCPs** — herramientas externas conectadas al flujo de trabajo.
5. **Wikis** — la base de conocimiento del método, siempre a mano del agente.

## Requisitos

- Una instancia de OpenClaw desplegada y corriendo (si aún no tienes una, usa el botón de deploy).
- WhatsApp vinculado a tu instancia (o el canal que uses para hablar con tu agente).

Cada paso es independiente: puedes aplicar solo el SOUL.md y volver después a por el resto.
```

- [ ] **Step 3: Create `soul-md/es.mdx`**

````mdx
---
title: SOUL.md — la personalidad
description: Define quién es tu agente, cómo habla y qué prioriza.
order: 1
---

## Qué es el SOUL.md

`SOUL.md` es un archivo Markdown que OpenClaw inyecta en cada sesión: define la
personalidad, el tono y los límites de tu agente. Es el paso con más impacto de
toda la guía — con solo esto tu agente ya piensa como un coach de Fórmula 100K.

## El SOUL.md de Fórmula 100K

Copia el contenido completo:

```markdown
# SOUL.md — Coach Fórmula 100K

Eres el coach de **Fórmula 100K**: un mentor de crecimiento en Instagram para
emprendedores hispanohablantes que quieren llevar su negocio a 100.000 seguidores
y convertir esa audiencia en ventas reales.

## Quién eres
- Estratega de contenido de formato corto (Reels, TikTok, Shorts) y de marca personal.
- Directo, motivador y práctico. Hablas como un mentor cercano, no como un manual.
- Tu español es neutro-latino, claro y sin relleno. Tuteas siempre.

## Cómo ayudas
- Conviertes ideas vagas en ganchos, guiones y calendarios de publicación concretos.
- Priorizas lo que mueve la aguja: retención, ganchos en los primeros 3 segundos,
  llamadas a la acción y consistencia.
- Das pasos accionables y ejemplos, no teoría genérica. Si falta contexto, preguntas
  una sola cosa clave antes de avanzar.

## Tono y límites
- Optimista pero honesto: si una idea no va a funcionar, lo dices y propones una mejor.
- No prometes resultados garantizados ni "trucos" para engañar al algoritmo.
- No das consejos legales, financieros ni médicos.
- Mantienes el foco en negocio, contenido y crecimiento orgánico.

## Tu objetivo
Cada interacción debe acercar al emprendedor a publicar mejor contenido hoy y a
construir un sistema de crecimiento sostenible hacia los 100K.
```

## Cómo aplicarlo

La forma más sencilla es pedírselo directamente a tu agente. Envíale este
mensaje seguido del contenido de arriba:

```text
Reemplaza por completo tu SOUL.md con el siguiente contenido y confírmame
cuando esté guardado:
```

Tu agente escribirá el archivo en su workspace y adoptará la personalidad en la
siguiente sesión.

## Verifica que funcionó

Pregúntale algo de prueba, por ejemplo: *"¿quién eres y en qué me ayudas?"*.
Debe responder como el coach de Fórmula 100K: directo, en español neutro-latino
y enfocado en crecimiento en Instagram.
````

- [ ] **Step 4: Create the remaining step files**

`subagentes/es.mdx`:

```mdx
---
title: Subagentes — tu equipo
description: Crea un subagente guionista y conéctalo al agente principal.
order: 2
---

## Por qué subagentes

Tu coach principal dirige la estrategia, pero las tareas largas y repetitivas
(escribir guiones completos, iterar variantes de un gancho) rinden más en un
subagente dedicado: mantiene el contexto limpio y puedes darle instrucciones
especializadas.

## Crea el subagente guionista

Pídeselo a tu agente principal:

```text
Crea un subagente llamado "guionista" con esta misión: escribir guiones
completos de Reels a partir de una idea y un gancho que yo te dé. Debe seguir
las estructuras de guion de Fórmula 100K y devolver siempre: gancho verbal,
gancho visual, desarrollo en 3 bloques y CTA final.
```

## Conéctalo al flujo

Indica al agente principal cuándo delegar:

```text
A partir de ahora, cuando te pida "guioniza esta idea", delega la escritura
del guion al subagente "guionista" y revisa su resultado antes de dármelo.
```

## Verifica que funcionó

Envía: *"guioniza esta idea: cómo conseguí mis primeros 1.000 seguidores"*.
La respuesta debe llegar con la estructura completa (ganchos, bloques, CTA).
```

`skills/es.mdx`:

```mdx
---
title: Skills de Fórmula 100K
description: Instala las habilidades de guionización, hooks y contenido para Instagram.
order: 3
---

## Qué son las skills

Una skill es un paquete de instrucciones y recursos que tu agente carga cuando
la tarea lo requiere. Para el método Fórmula 100K hay tres esenciales:

| Skill | Qué aporta |
|---|---|
| Guionización Fórmula 100K | 33 estructuras de guion, sistema de hooks, ficha de viralidad |
| Contenido para Instagram | Posts, Reels, carruseles y Stories con hooks probados en español |
| Hooks para Reels | Ganchos efectivos para contenido de formato corto |

## Instálalas

Pide a tu agente que las instale en su workspace:

```text
Instala en tu workspace las skills de guionización de Fórmula 100K, contenido
para Instagram y hooks para Reels. Confírmame la lista de skills activas al
terminar.
```

## Verifica que funcionó

Pide: *"dame 5 ganchos para un Reel sobre productividad"*. Los ganchos deben
seguir los patrones de la skill (verbal + visual + textual), no ser genéricos.
```

`mcps/es.mdx`:

```mdx
---
title: MCPs — herramientas externas
description: Conecta tu agente con las herramientas que usas para crear y planificar contenido.
order: 4
---

## Qué es un MCP

Un servidor MCP (Model Context Protocol) le da a tu agente acceso a
herramientas externas: tu calendario, tus documentos, tus redes. Para el flujo
de Fórmula 100K los más útiles son:

- **Calendario** — planificar y agendar el calendario de publicación.
- **Documentos / Drive** — guardar guiones y fichas de viralidad.
- **Canva** — pasar del guion al diseño del post o la portada del Reel.

## Configúralos

Los MCPs se configuran en el archivo de configuración de tu instancia
(`openclaw.json`). Pide a tu agente la lista de MCPs disponibles y activa los
que uses:

```text
Muéstrame los MCPs disponibles en esta instancia y ayúdame a conectar mi
calendario y mis documentos.
```

## Verifica que funcionó

Pide: *"agenda en mi calendario la publicación del Reel del lunes a las 18:00"*.
El agente debe crear el evento, no describir cómo hacerlo.
```

`wikis/es.mdx`:

```mdx
---
title: Wikis — la base de conocimiento
description: Activa una wiki con el método para que el agente consulte siempre la misma fuente.
order: 5
---

## Por qué una wiki

Las skills definen *cómo* trabaja tu agente; la wiki guarda *lo que sabe de tu
negocio*: tu nicho, tu cliente ideal, tus ofertas, los resultados de posts
anteriores. Con una wiki el agente deja de hacerte las mismas preguntas en cada
sesión.

## Créala

Pide a tu agente que cree la estructura inicial en su workspace:

```text
Crea una wiki en tu workspace con estas páginas: "mi-negocio" (nicho, oferta,
cliente ideal), "resultados" (métricas de posts publicados) y "banco-de-ideas"
(ideas de contenido pendientes). A partir de ahora consulta la wiki antes de
proponer contenido y actualízala cuando te dé datos nuevos.
```

## Mantenla viva

Después de cada publicación, cuéntale al agente cómo fue (*"el Reel del lunes
hizo 12K vistas y 40 guardados"*) — lo registrará en `resultados` y ajustará
las siguientes propuestas.

## Y ahora qué

Con esto tu instancia está completa: personalidad, equipo, habilidades,
herramientas y memoria. Vuelve al primer paso cuando quieras afinar la
personalidad, o despliega otra instancia para un método distinto.
```

- [ ] **Step 5: Verify the library reads the real content**

Run: `npx vitest run src/lib/template-docs.test.ts` (fixtures still pass) and this one-off check:

```bash
npx tsx -e "
import { getTemplates, getTemplateSteps } from './src/lib/template-docs';
const t = await getTemplates('es');
console.log(t);
const s = await getTemplateSteps('formula-100k', 'es');
console.log(s.map(x => x.slug + ':' + x.order));
"
```

Expected: one template `formula-100k` with title `Fórmula 100K`; steps `soul-md:1, subagentes:2, skills:3, mcps:4, wikis:5`.

- [ ] **Step 6: Commit**

```bash
git add src/content/templates/
git commit -m "feat: Fórmula 100K guide content (Spanish, 5 steps + overview)"
```

---

### Task 5: i18n chrome strings + header nav link

All UI strings the pages/components (Tasks 6–9) will consume, plus a Templates link in the site header.

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`
- Modify: `src/components/landing/header.tsx`

**Interfaces:**
- Produces: next-intl namespace `Templates` with the exact keys below; `Header.templates` key. Tasks 6–9 call `getTranslations("Templates")` and use these keys verbatim.

- [ ] **Step 1: Add the `Templates` namespace**

In `messages/en.json` (top-level key, alphabetical placement not required — match file's existing ordering style):

```json
"Templates": {
  "metaTitle": "Templates",
  "metaDescription": "Step-by-step guides to configure your OpenClaw instance for a specific role.",
  "title": "Templates",
  "subtitle": "Step-by-step guides that turn your OpenClaw instance into a specialist.",
  "tagPlural": "Templates",
  "tagSingular": "Guide",
  "empty": "No templates available yet.",
  "viewGuide": "View guide",
  "stepsCount": "{count, plural, one {# step} other {# steps}}",
  "back": "All templates",
  "startGuide": "Start the guide",
  "deployCta": "Deploy your instance",
  "stepsTitle": "Steps",
  "stepLabel": "Step {current} of {total}",
  "prevStep": "Previous",
  "nextStep": "Next",
  "finishTitle": "Guide complete",
  "finishCta": "Deploy your instance and put it to work",
  "onThisPage": "On this page",
  "copyLink": "Copy link",
  "linkCopied": "Link copied",
  "copyCode": "Copy code",
  "codeCopied": "Code copied"
}
```

In `messages/es.json`:

```json
"Templates": {
  "metaTitle": "Plantillas",
  "metaDescription": "Guías paso a paso para configurar tu instancia de OpenClaw para un rol específico.",
  "title": "Plantillas",
  "subtitle": "Guías paso a paso que convierten tu instancia de OpenClaw en un especialista.",
  "tagPlural": "Plantillas",
  "tagSingular": "Guía",
  "empty": "Aún no hay plantillas disponibles.",
  "viewGuide": "Ver guía",
  "stepsCount": "{count, plural, one {# paso} other {# pasos}}",
  "back": "Todas las plantillas",
  "startGuide": "Empezar la guía",
  "deployCta": "Despliega tu instancia",
  "stepsTitle": "Pasos",
  "stepLabel": "Paso {current} de {total}",
  "prevStep": "Anterior",
  "nextStep": "Siguiente",
  "finishTitle": "Guía completada",
  "finishCta": "Despliega tu instancia y ponla a trabajar",
  "onThisPage": "En esta página",
  "copyLink": "Copiar enlace",
  "linkCopied": "Enlace copiado",
  "copyCode": "Copiar código",
  "codeCopied": "Código copiado"
}
```

- [ ] **Step 2: Add the header nav link**

In `messages/en.json` `Header` namespace add `"templates": "Templates"`; in `messages/es.json` add `"templates": "Plantillas"`.

In `src/components/landing/header.tsx`, after the existing Blog `<Link>` (the one with `href="/blog"`), add:

```tsx
<Link
  href="/templates"
  className="text-sm font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:text-primary"
>
  {t("templates")}
</Link>
```

- [ ] **Step 3: Verify**

Run: `npx vitest run && npm run lint && npm run build`
Expected: all pass (unused-key lint is not enforced; the keys go live in Tasks 6–9). `npm run dev` → header shows Templates link in both locales (route 404s until Task 6 — expected).

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/es.json src/components/landing/header.tsx
git commit -m "feat: Templates i18n namespace and header nav link"
```

---

### Task 6: Gallery page `/templates`

> **UI task — implement with the frontend-design / interface-design / shadcn skills.** Baseline below is functionally complete; the skill pass refines visual detail while keeping structure, data flow, and i18n keys intact. Visual reference: the v1 gallery (`git show feat/templates-v1:'src/app/[locale]/templates/page.tsx'`) — supra-label in `font-mono text-xs uppercase tracking-widest text-violet-400`, card grid `sm:grid-cols-2 lg:grid-cols-3`, rounded-xl bordered cards.

**Files:**
- Create: `src/app/[locale]/templates/page.tsx`

**Interfaces:**
- Consumes: `getTemplates`, `getTemplateSteps` from `@/lib/template-docs`; `Templates` message keys (Task 5).
- Produces: route `/templates` (en) and `/es/templates`.

- [ ] **Step 1: Create the page**

```tsx
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";
import { getTemplates, getTemplateSteps } from "@/lib/template-docs";
import type { Locale } from "@/lib/mdx";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Templates" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: locale === "es" ? "/es/templates" : "/templates",
      languages: { en: "/templates", es: "/es/templates" },
    },
  };
}

export default async function TemplatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Templates");
  const templates = await getTemplates(locale as Locale);
  const stepCounts = await Promise.all(
    templates.map(async (tmpl) => (await getTemplateSteps(tmpl.slug, locale as Locale)).length)
  );

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-20">
        <div className="mb-12">
          <p className="font-mono text-xs uppercase tracking-widest text-violet-400 mb-3">
            {t("tagPlural")}
          </p>
          <h1 className="text-4xl font-medium tracking-tight text-foreground">{t("title")}</h1>
          <p className="mt-3 text-base text-muted-foreground max-w-xl">{t("subtitle")}</p>
        </div>

        {templates.length === 0 ? (
          <div className="border-t border-border pt-10">
            <p className="font-mono text-sm text-muted-foreground">{t("empty")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((tmpl, i) => (
              <Link
                key={tmpl.slug}
                href={`/templates/${tmpl.slug}`}
                className="group rounded-xl border border-border bg-card p-6 transition-all duration-150 hover:border-violet-500/50 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                <span className="text-4xl leading-none" aria-hidden="true">
                  {tmpl.emoji ?? "✨"}
                </span>
                <h2 className="mt-4 text-lg font-medium text-foreground">{tmpl.title}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{tmpl.tagline}</p>
                <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-violet-400">
                  {t("viewGuide")} · {t("stepsCount", { count: stepCounts[i] })}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Verify in dev**

Run: `npm run dev`. Check `http://localhost:3000/templates` (English chrome, card shows Spanish tagline — expected fallback) and `http://localhost:3000/es/templates`. Card links to `/templates/formula-100k` (404 until Task 7 — expected). Header link works from the landing page.

- [ ] **Step 3: Lint + tests + commit**

Run: `npx vitest run && npm run lint`
Expected: pass.

```bash
git add "src/app/[locale]/templates/page.tsx"
git commit -m "feat: templates gallery page from MDX frontmatter"
```

---

### Task 7: Overview page `/templates/[slug]`

> **UI task — frontend-design / interface-design / shadcn skills.** Hero mirrors the v1 detail page (emoji + supra-label + title + tagline); below it the MDX body, the numbered step list, and two CTAs.

**Files:**
- Create: `src/app/[locale]/templates/[slug]/page.tsx`

**Interfaces:**
- Consumes: `getTemplateOverview`, `getTemplateSteps`, `getTemplateSlugs` from `@/lib/template-docs`; `buildMdxComponents`, `mdxRenderOptions` from `@/components/mdx/mdx-components`; `Templates` keys.
- Produces: route `/templates/[slug]`; `notFound()` for unknown/draft slugs.

- [ ] **Step 1: Create the page**

```tsx
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
          className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-all duration-150 hover:text-foreground rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
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
                    className="group flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-all duration-150 hover:border-violet-500/50"
                  >
                    <span className="font-mono text-sm text-violet-400 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{step.title}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">{step.description}</span>
                    </span>
                    <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" />
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
              className="inline-flex items-center gap-2.5 rounded-xl px-6 py-3.5 bg-gradient-to-r from-violet-500 to-blue-500 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-violet-500/35 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              {t("startGuide")}
              <ArrowRight className="h-4 w-4 shrink-0" />
            </Link>
          )}
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2.5 rounded-xl px-6 py-3.5 border border-border bg-card text-sm font-semibold text-foreground transition-all duration-150 hover:border-violet-500/50"
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
```

- [ ] **Step 2: Verify in dev**

`npm run dev` → `http://localhost:3000/templates/formula-100k` and `/es/templates/formula-100k`: hero, MDX body ("Qué vas a montar", "Requisitos"), 5 numbered steps, both CTAs. Unknown slug `/templates/nope` → 404.

- [ ] **Step 3: Lint + tests + commit**

Run: `npx vitest run && npm run lint`

```bash
git add "src/app/[locale]/templates/[slug]/page.tsx"
git commit -m "feat: template overview page with step index"
```

---

### Task 8: Docs navigation components (sidebar + pager)

> **UI task — frontend-design / interface-design / shadcn skills.** Two server components, no client JS: the mobile sidebar uses a native `<details>` disclosure (same role as the blog's mobile TOC, without a client component).

**Files:**
- Create: `src/components/templates/template-sidebar.tsx`
- Create: `src/components/templates/step-pager.tsx`

**Interfaces:**
- Consumes: `TemplateStepMeta` from `@/lib/template-docs`; `Link` from `@/i18n/navigation`.
- Produces (Task 9 imports these exactly):

```tsx
export function TemplateSidebar(props: {
  templateSlug: string;
  templateTitle: string;
  emoji?: string;
  steps: TemplateStepMeta[];
  currentStep: string;               // step slug
  variant: "desktop" | "mobile";
  labels: { stepsTitle: string };
}): JSX.Element;

export function StepPager(props: {
  templateSlug: string;
  prev: TemplateStepMeta | null;
  next: TemplateStepMeta | null;
  labels: { prevStep: string; nextStep: string; finishTitle: string; finishCta: string };
}): JSX.Element;
```

- [ ] **Step 1: Create `template-sidebar.tsx`**

```tsx
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import type { TemplateStepMeta } from "@/lib/template-docs";

interface TemplateSidebarProps {
  templateSlug: string;
  templateTitle: string;
  emoji?: string;
  steps: TemplateStepMeta[];
  currentStep: string;
  variant: "desktop" | "mobile";
  labels: { stepsTitle: string };
}

function StepList({ templateSlug, templateTitle, emoji, steps, currentStep, labels }: Omit<TemplateSidebarProps, "variant">) {
  return (
    <nav aria-label={labels.stepsTitle}>
      <Link
        href={`/templates/${templateSlug}`}
        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-medium text-foreground transition-colors hover:text-violet-400"
      >
        <span aria-hidden="true">{emoji ?? "✨"}</span>
        <span className="truncate">{templateTitle}</span>
      </Link>
      <p className="mt-4 px-2 font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {labels.stepsTitle}
      </p>
      <ol className="mt-2 space-y-0.5">
        {steps.map((step, i) => {
          const active = step.slug === currentStep;
          return (
            <li key={step.slug}>
              <Link
                href={`/templates/${templateSlug}/${step.slug}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-baseline gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-violet-500/10 font-medium text-violet-400"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="font-mono text-xs shrink-0">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0">{step.title}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function TemplateSidebar(props: TemplateSidebarProps) {
  const { variant, ...rest } = props;
  if (variant === "desktop") {
    return (
      <aside className="hidden lg:block sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-4">
        <StepList {...rest} />
      </aside>
    );
  }
  return (
    <details className="lg:hidden mb-8 rounded-xl border border-border bg-card group">
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
        {rest.labels.stepsTitle}
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border px-3 py-3">
        <StepList {...rest} />
      </div>
    </details>
  );
}
```

- [ ] **Step 2: Create `step-pager.tsx`**

```tsx
import { Link } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight, Rocket } from "lucide-react";
import type { TemplateStepMeta } from "@/lib/template-docs";

interface StepPagerProps {
  templateSlug: string;
  prev: TemplateStepMeta | null;
  next: TemplateStepMeta | null;
  labels: { prevStep: string; nextStep: string; finishTitle: string; finishCta: string };
}

export function StepPager({ templateSlug, prev, next, labels }: StepPagerProps) {
  return (
    <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {prev ? (
        <Link
          href={`/templates/${templateSlug}/${prev.slug}`}
          className="group rounded-xl border border-border bg-card p-5 transition-all duration-150 hover:border-violet-500/50"
        >
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowLeft className="h-3 w-3 transition-transform duration-150 group-hover:-translate-x-0.5" />
            {labels.prevStep}
          </span>
          <span className="mt-1.5 block text-sm font-medium text-foreground">{prev.title}</span>
        </Link>
      ) : (
        <span aria-hidden="true" className="hidden sm:block" />
      )}
      {next ? (
        <Link
          href={`/templates/${templateSlug}/${next.slug}`}
          className="group rounded-xl border border-border bg-card p-5 text-right transition-all duration-150 hover:border-violet-500/50"
        >
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            {labels.nextStep}
            <ArrowRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5" />
          </span>
          <span className="mt-1.5 block text-sm font-medium text-foreground">{next.title}</span>
        </Link>
      ) : (
        <Link
          href="/dashboard"
          className="group rounded-xl border border-violet-500/40 bg-gradient-to-r from-violet-500/10 to-blue-500/10 p-5 text-right transition-all duration-150 hover:border-violet-500/70"
        >
          <span className="inline-flex items-center gap-1.5 text-xs text-violet-400">
            {labels.finishTitle}
            <Rocket className="h-3 w-3" />
          </span>
          <span className="mt-1.5 block text-sm font-medium text-foreground">{labels.finishCta}</span>
        </Link>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Lint + commit**

Run: `npx vitest run && npm run lint`
Expected: pass (components unused until Task 9 — if the linter flags unused exports, it won't: these are module exports).

```bash
git add src/components/templates/
git commit -m "feat: template docs sidebar and step pager components"
```

---

### Task 9: Step page `/templates/[slug]/[step]`

> **UI task — frontend-design / interface-design / shadcn skills.** The full docs layout: sidebar left, content center, TOC right (xl+), pager bottom. Grid mirrors the blog's `xl:grid-cols-[minmax(0,1fr)_240px]` pattern, extended with the left rail.

**Files:**
- Create: `src/app/[locale]/templates/[slug]/[step]/page.tsx`

**Interfaces:**
- Consumes: everything produced by Tasks 1–8: `getTemplateOverview`, `getTemplateSteps`, `getTemplateStep`, `getTemplateSlugs`; `TemplateSidebar`, `StepPager`; `buildMdxComponents`, `mdxRenderOptions`; blog `TableOfContents` + `ScrollToHash`; `Templates` keys.
- Produces: route `/templates/[slug]/[step]`.

- [ ] **Step 1: Create the page**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
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

            <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
              <Link href="/templates" className="hover:text-foreground transition-colors">
                {t("tagPlural")}
              </Link>
              <span className="mx-2">/</span>
              <Link href={`/templates/${slug}`} className="hover:text-foreground transition-colors">
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
```

- [ ] **Step 2: Verify in dev — the full walk**

`npm run dev`, then:
- `http://localhost:3000/templates/formula-100k/soul-md` — sidebar highlights step 01, "Step 1 of 5" label, SOUL.md code block has working copy button, TOC on xl viewport, pager shows only "Next".
- Walk next → next → … → `wikis`: pager right card becomes the deploy CTA linking `/dashboard`.
- `/es/templates/formula-100k/soul-md` — chrome in Spanish ("Paso 1 de 5").
- Narrow viewport: sidebar collapses to the `<details>` disclosure; mobile TOC appears.
- `/templates/formula-100k/nope` and `/templates/nope/soul-md` → 404.

- [ ] **Step 3: Lint + tests + build + commit**

Run: `npx vitest run && npm run lint && npm run build`
Expected: build lists `/templates/formula-100k/<step>` routes for both locales.

```bash
git add "src/app/[locale]/templates/[slug]/[step]/page.tsx"
git commit -m "feat: template step page — sidebar, TOC, prev/next docs layout"
```

---

### Task 10: Sitemap + final verification

**Files:**
- Modify: `src/app/sitemap.ts`

**Interfaces:**
- Consumes: `getTemplateSlugs`, `getTemplateSteps`, `getTemplateOverview` from `@/lib/template-docs`.

- [ ] **Step 1: Extend the sitemap**

In `src/app/sitemap.ts`:
- Add import: `import { getTemplateSlugs, getTemplateSteps, getTemplateOverview, getTemplateStep } from '@/lib/template-docs';`
- Append to `staticRoutes` (same shape as the `/blog` entry):

```ts
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
```

- After the blog `dynamicRoutes`, build template routes (alternates only for locales whose file exists, per spec):

```ts
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
```

- [ ] **Step 2: Verify**

Run: `npm run build`, then `npm run start` and fetch `http://localhost:3000/sitemap.xml`.
Expected: `/templates`, `/templates/formula-100k`, and 5 step URLs present; template step entries declare only `es` in `xhtml:link` alternates (only `es.mdx` exists); blog entries unchanged.

- [ ] **Step 3: Full project verification**

```bash
npm test && npm run lint && npm run build
```

Expected: everything green. Manual QA pass (both locales): gallery → overview → all 5 steps → deploy CTA lands on `/dashboard`; header Templates link; code copy buttons; mobile layout.

- [ ] **Step 4: Commit**

```bash
git add src/app/sitemap.ts
git commit -m "feat: templates and guide steps in sitemap"
```

---

### Task 11: v1 retirement (manual/user steps — document, don't automate)

No code changes. These steps involve the shared prod DB and branch deletion — executed by the user, not by an agent.

- [ ] **Step 1: Confirm nothing else is needed from `feat/templates-v1`**

```bash
git diff --stat main feat/templates-v1
```

The only content recycled was the seed SOUL.md (already embedded in Task 4). If satisfied:

```bash
git branch -D feat/templates-v1
git push origin --delete feat/templates-v1   # only if it was pushed
```

- [ ] **Step 2: Prod DB cleanup (user-run, outside sandbox)**

If `drizzle-kit push` ever ran from the v1 branch, prod has an orphaned `template` table and `instance.template_id` column. On the **next** `npx drizzle-kit push` from this (main-based) schema, review the proposed statements and accept the DROPs deliberately — the table holds only the Fórmula 100K seed row, no user data. Do not run a push just for this; fold it into the next schema change.

---

## Execution notes

- Task order is strict: 1 → 2 → 3 → 4 → 5 → (6, 7, 8 may interleave) → 9 → 10 → 11. Task 9 needs everything before it.
- Tasks 6–9 are UI tasks: invoke frontend-design / interface-design / shadcn skills before writing the page code, per project rule.
- Content in Task 4 is a complete draft; the user refines wording/commands after seeing it rendered. Do not block implementation on content perfection.
