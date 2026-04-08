"use client";

import Image from "next/image";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

export function Header() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("Header");
  const locale = useLocale();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.refresh();
  };

  const switchLocale = () => {
    const newLocale = locale === "en" ? "es" : "en";
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b-2 border-border bg-background/90 backdrop-blur-xl">
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
          <span className="text-2xl font-bold tracking-tight text-foreground uppercase">
            PapayaClaw
          </span>
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/blog"
            className="text-sm font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:text-primary"
          >
            {t("blog")}
          </Link>
          <Link
            href="/pricing"
            className="text-sm font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:text-primary"
          >
            {t("pricing")}
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:text-primary"
          >
            {t("dashboard")}
          </Link>

          {/* Language Switcher */}
          <button
            onClick={switchLocale}
            className="flex items-center gap-1.5 rounded-full border-2 border-border bg-card px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground transition-all hover:border-primary hover:text-foreground cursor-pointer"
          >
            {locale === "en" ? "🇪🇸 ES" : "🇺🇸 EN"}
          </button>

          <ThemeToggle />

          {!isPending && session ? (
            <Button
              onClick={handleSignOut}
              className="cursor-pointer rounded-full border-2 border-red-500/50 bg-red-500/10 px-5 py-2 text-sm font-bold uppercase tracking-wide text-red-400 transition-all hover:bg-red-500/20 hover:text-red-300"
            >
              {t("logout")}
            </Button>
          ) : (
            <Link
              href="mailto:support@papayaclaw.com"
              className="rounded-full bg-primary px-5 py-2 text-sm font-bold uppercase tracking-wide text-black transition-all hover:bg-white neo-shadow-sm hover:neo-shadow"
            >
              {t("contact")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
