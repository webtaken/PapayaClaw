import { getTranslations } from "next-intl/server";

import { ToolsBeam } from "@/components/landing/connect-tools-beam";

export async function ConnectTools() {
  const t = await getTranslations("ConnectTools");

  return (
    <section
      id="connect-tools"
      className="border-b border-border scroll-mt-20"
    >
      <div className="mx-auto max-w-5xl px-6 py-20">
        <div className="mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("title")}{" "}
            <span className="text-primary">{t("titleHighlight")}</span>
          </h2>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            {t("description")}
          </p>
        </div>

        <ToolsBeam
          ariaLabel={t("diagramAriaLabel")}
          centerLabel={t("centerLabel")}
        />
      </div>
    </section>
  );
}
