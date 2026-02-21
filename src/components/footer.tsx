import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-zinc-800/50 bg-zinc-900/30">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-8 sm:flex-row sm:justify-between">
        <p className="text-sm text-zinc-500">
          Built with ❤️ by{" "}
          <Link
            href="https://x.com/saviomartin7"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 underline decoration-zinc-700 underline-offset-4 transition-colors hover:text-white hover:decoration-zinc-400"
          >
            Savio Martin
          </Link>
        </p>
        <div className="flex items-center gap-6">
          <Link
            href="https://x.com/saviomartin7"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-500 transition-colors hover:text-white"
          >
            Savio Martin
          </Link>
          <Link
            href="mailto:support@papayaclaw.com?subject=PapayaClaw%20Support%20Inquiry"
            className="text-sm text-zinc-500 transition-colors hover:text-white"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </footer>
  );
}
