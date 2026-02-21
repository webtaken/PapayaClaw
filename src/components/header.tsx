import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800/50 bg-[#07080a]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <span className="text-xl font-bold tracking-tight text-white">
            🥭 PapayaClaw
          </span>
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-400 transition-colors hover:text-white"
          >
            Dashboard
          </Link>
          <Link
            href="mailto:support@papayaclaw.com?subject=PapayaClaw%20Support%20Inquiry"
            className="text-sm text-zinc-400 transition-colors hover:text-white"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </header>
  );
}
