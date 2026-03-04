"use client";

import Link from "next/link";
import Image from "next/image";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function Header() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b-2 border-border bg-[#0f1014]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-3 transition-transform hover:scale-105"
        >
          <Image
            src="/papayaclaw.png"
            width={56}
            height={56}
            alt="PapayaClaw Logo"
            className="object-contain"
          />
          <span className="text-2xl font-bold tracking-tight text-white uppercase">
            PapayaClaw
          </span>
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/pricing"
            className="text-sm font-bold uppercase tracking-wide text-zinc-300 transition-colors hover:text-primary"
          >
            Pricing
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-bold uppercase tracking-wide text-zinc-300 transition-colors hover:text-primary"
          >
            Dashboard
          </Link>
          {!isPending && session ? (
            <Button
              onClick={handleSignOut}
              className="cursor-pointer rounded-full border-2 border-red-500/50 bg-red-500/10 px-5 py-2 text-sm font-bold uppercase tracking-wide text-red-400 transition-all hover:bg-red-500/20 hover:text-red-300"
            >
              Logout
            </Button>
          ) : (
            <Link
              href="mailto:support@papayaclaw.com"
              className="rounded-full bg-primary px-5 py-2 text-sm font-bold uppercase tracking-wide text-black transition-all hover:bg-white neo-shadow-sm hover:neo-shadow"
            >
              Contact
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
