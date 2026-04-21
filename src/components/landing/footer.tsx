import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

export async function Footer() {
  const t = await getTranslations("Footer");

  return (
    <footer className="border-t-2 border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-12 sm:flex-row sm:justify-between">
        <p className="text-base font-bold uppercase tracking-wide text-muted-foreground">
          {t("builtWith")}{" "}
          <a
            href="https://x.com/node_srojas1"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-primary decoration-4 underline-offset-4 transition-colors hover:text-secondary hover:decoration-secondary"
          >
            Saul Rojas
          </a>
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          <Link
            href="/blog"
            className="text-sm font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("blog")}
          </Link>
          <Link
            href="/privacy"
            className="text-sm font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("privacy")}
          </Link>
          <Link
            href="/terms"
            className="text-sm font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("terms")}
          </Link>
          <a
            href="https://x.com/node_srojas1"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
          >
            Saul Rojas
          </a>
          <a
            href="mailto:support@papayaclaw.com"
            className="text-sm font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("support")}
          </a>
        </div>
      </div>
    </footer>
  );
}
