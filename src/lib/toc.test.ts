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
