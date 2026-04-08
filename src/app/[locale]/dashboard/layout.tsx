import { auth } from "@/lib/auth";
import Image from "next/image";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Dashboard");

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/");
  }

  const initials = session.user.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
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
            <nav className="hidden items-center gap-6 sm:flex">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-foreground"
              >
                {t("navDashboard")}
              </Link>
              <Link
                href="/dashboard/subscriptions"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("navSubscriptions")}
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={session.user.image || undefined}
                  alt={session.user.name}
                />
                <AvatarFallback className="bg-violet-500/20 text-xs text-violet-300">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm text-muted-foreground sm:block">
                {session.user.name}
              </span>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      <Toaster />
    </div>
  );
}
