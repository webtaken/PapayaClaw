"use client";

import { useEffect, useMemo, useState } from "react";
import { Link2, Check, List } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { TocEntry } from "@/lib/mdx";

interface TableOfContentsProps {
  items: TocEntry[];
  variant: "desktop" | "mobile";
  labels: {
    onThisPage: string;
    copyLink: string;
    linkCopied: string;
  };
}

function flatten(items: TocEntry[]): TocEntry[] {
  const out: TocEntry[] = [];
  for (const item of items) {
    out.push(item);
    if (item.children.length) out.push(...flatten(item.children));
  }
  return out;
}

export function TableOfContents({ items, variant, labels }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const flat = useMemo(() => flatten(items), [items]);

  useEffect(() => {
    if (flat.length === 0) return;

    const ids = flat.map((i) => i.id);
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          if (entry.isIntersecting) {
            visible.set(id, entry.intersectionRatio);
          } else {
            visible.delete(id);
          }
        }
        if (visible.size > 0) {
          const top = ids.find((id) => visible.has(id));
          if (top) setActiveId(top);
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: [0, 1] }
    );

    const elements = flat
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null);
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [flat]);

  async function copyLink(id: string) {
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      toast.success(labels.linkCopied);
      setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 2000);
    } catch {
      // clipboard blocked — swallow
    }
  }

  if (items.length === 0) return null;

  const renderList = (entries: TocEntry[]) => (
    <ul className="space-y-1 text-sm">
      {entries.map((entry) => {
        const isActive = activeId === entry.id;
        const displayText = entry.text.replace(/^\d+(\.\d+)*\s+/, "");
        return (
          <li key={entry.id}>
            <div className="group flex items-start gap-1">
              <a
                href={`#${entry.id}`}
                className={cn(
                  "flex-1 block py-1 border-l-2 pl-3 transition-colors leading-snug",
                  isActive
                    ? "border-primary text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                {displayText}
              </a>
              <button
                type="button"
                onClick={() => copyLink(entry.id)}
                aria-label={labels.copyLink}
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1 text-muted-foreground hover:text-foreground transition-opacity"
              >
                {copiedId === entry.id ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Link2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            {entry.children.length > 0 && (
              <div className="ml-3 mt-1">{renderList(entry.children)}</div>
            )}
          </li>
        );
      })}
    </ul>
  );

  if (variant === "desktop") {
    return (
      <aside className="hidden xl:block">
        <div className="sticky top-24 max-h-[calc(100vh-8rem)] flex flex-col">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <List className="h-4 w-4" />
            {labels.onThisPage}
          </div>
          <nav
            aria-label={labels.onThisPage}
            className="flex-1 overflow-y-auto pr-2 -mr-2"
          >
            {renderList(items)}
          </nav>
        </div>
      </aside>
    );
  }

  return (
    <details className="xl:hidden mb-8 rounded-lg border border-border bg-muted/30">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <List className="h-4 w-4" />
        {labels.onThisPage}
      </summary>
      <nav aria-label={labels.onThisPage} className="px-4 pb-4">
        {renderList(items)}
      </nav>
    </details>
  );
}
