"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  copyLabel: string;
  copiedLabel: string;
  children: React.ReactNode;
  className?: string;
}

export function CodeBlock({ code, copyLabel, copiedLabel, children, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(copiedLabel);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  return (
    <div className="relative group mb-6">
      <pre
        className={cn(
          "bg-muted p-4 pr-14 rounded-xl overflow-x-auto border border-border shadow-2xl",
          className
        )}
      >
        {children}
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copyLabel}
        title={copyLabel}
        className="absolute top-3 right-3 inline-flex items-center justify-center p-2 rounded-md bg-background/80 backdrop-blur border border-border text-muted-foreground hover:text-foreground hover:bg-background transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
