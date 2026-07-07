import { Children } from "react";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { CodeBlock } from "@/components/blog/code-block";
import type { MDXRemoteProps } from "next-mdx-remote/rsc";

function getRawText(node: any): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getRawText).join("");
  if (node?.props?.children) return getRawText(node.props.children);
  return "";
}

export function buildMdxComponents(labels: { copyCode: string; codeCopied: string }) {
  return {
  h1: (props: any) => <h1 className="text-4xl font-bold mb-6 text-foreground" {...props} />,
  h2: (props: any) => <h2 className="text-3xl font-semibold mt-10 mb-4 text-foreground" {...props} />,
  h3: (props: any) => <h3 className="text-2xl font-semibold mt-8 mb-4 text-foreground" {...props} />,
  p: ({ children, ...props }: any) => {
    const hasBlockChild =
      Children.toArray(children).some(
        (child: any) => child?.type === "figure" || child?.props?.src
      );
    return hasBlockChild ? (
      <div className="text-lg leading-relaxed mb-6 text-muted-foreground" {...props}>{children}</div>
    ) : (
      <p className="text-lg leading-relaxed mb-6 text-muted-foreground" {...props}>{children}</p>
    );
  },
  ul: (props: any) => <ul className="list-disc list-inside mb-6 text-muted-foreground space-y-2" {...props} />,
  ol: (props: any) => <ol className="list-decimal list-inside mb-6 text-muted-foreground space-y-2" {...props} />,
  li: (props: any) => <li className="pl-2" {...props} />,
  a: (props: any) => <a className="text-primary hover:underline font-medium" {...props} />,
  blockquote: (props: any) => <blockquote className="border-l-4 border-primary pl-4 italic my-6 text-muted-foreground bg-muted/50 py-2 pr-4 rounded-r" {...props} />,
  code: (props: any) => <code className="bg-muted text-pink-400 px-1.5 py-0.5 rounded text-sm font-mono" {...props} />,
  pre: ({ children, ...props }: any) => {
    const code = getRawText(children);
    return (
      <CodeBlock code={code} copyLabel={labels.copyCode} copiedLabel={labels.codeCopied} {...props}>
        {children}
      </CodeBlock>
    );
  },
  strong: (props: any) => <strong className="font-bold text-foreground" {...props} />,
  table: (props: any) => (
    <div className="overflow-x-auto mb-6">
      <table className="w-full text-sm text-left text-muted-foreground border-collapse border border-border" {...props} />
    </div>
  ),
  thead: (props: any) => <thead className="bg-muted text-foreground uppercase text-xs tracking-wider" {...props} />,
  tbody: (props: any) => <tbody className="divide-y divide-border" {...props} />,
  tr: (props: any) => <tr className="border-b border-border hover:bg-muted/50 transition-colors" {...props} />,
  th: (props: any) => <th className="px-4 py-3 font-bold border border-border" {...props} />,
  td: (props: any) => <td className="px-4 py-3 border border-border" {...props} />,
  img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <figure className="my-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={(props.src as string) || ""}
        alt={props.alt || ""}
        loading="lazy"
        decoding="async"
        className="w-full h-auto rounded-xl border border-border bg-muted/50"
      />
      {props.title && (
        <figcaption className="mt-2 text-center text-sm text-muted-foreground italic">
          {props.title}
        </figcaption>
      )}
    </figure>
  ),
  video: ({ title, className, ...props }: React.VideoHTMLAttributes<HTMLVideoElement> & { title?: string }) => (
    <figure className="my-8 flex flex-col items-center">
      <video
        controls
        playsInline
        preload="metadata"
        className={className ?? "max-h-[70vh] w-auto max-w-full rounded-xl border border-border bg-muted/50"}
        {...props}
      />
      {title && (
        <figcaption className="mt-2 text-center text-sm text-muted-foreground italic">
          {title}
        </figcaption>
      )}
    </figure>
  ),
  };
}

export const mdxRenderOptions: NonNullable<MDXRemoteProps["options"]> = {
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
};
