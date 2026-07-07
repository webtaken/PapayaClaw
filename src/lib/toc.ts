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
