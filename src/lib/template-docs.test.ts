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

describe("path traversal", () => {
  it("getTemplateOverview returns null for an unsafe slug", async () => {
    expect(await getTemplateOverview("../x", "es", dir)).toBeNull();
  });

  it("getTemplateStep returns null for an unsafe step", async () => {
    write("formula-100k/index/es.mdx", overviewFm);
    expect(await getTemplateStep("formula-100k", "../../x", "es", dir)).toBeNull();
  });

  it("getTemplateSteps returns [] for an unsafe slug", async () => {
    expect(await getTemplateSteps("../x", "es", dir)).toEqual([]);
  });
});
