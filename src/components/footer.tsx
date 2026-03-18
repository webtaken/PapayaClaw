import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

export async function Footer() {
  const t = await getTranslations("Footer");

  return (
    <footer className="border-t-2 border-border bg-[#0f1014]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-12 sm:flex-row sm:justify-between">
        <p className="text-base font-bold uppercase tracking-wide text-zinc-500">
          {t("builtWith")}{" "}
          <a
            href="https://x.com/node_srojas1"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white underline decoration-primary decoration-4 underline-offset-4 transition-colors hover:text-secondary hover:decoration-secondary"
          >
            Saul Rojas
          </a>
        </p>
        <div className="flex items-center gap-8">
          <Link
            href="/blog"
            className="text-sm font-bold uppercase tracking-wide text-zinc-500 transition-colors hover:text-white"
          >
            {t("blog")}
          </Link>
          <a
            href="https://x.com/node_srojas1"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-bold uppercase tracking-wide text-zinc-500 transition-colors hover:text-white"
          >
            Saul Rojas
          </a>
          <a
            href="mailto:support@papayaclaw.com"
            className="text-sm font-bold uppercase tracking-wide text-zinc-500 transition-colors hover:text-white"
          >
            {t("support")}
          </a>
        </div>
      </div>
    </footer>
  );
}
