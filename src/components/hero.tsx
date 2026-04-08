import { getTranslations } from "next-intl/server";

export async function Hero() {
  const t = await getTranslations("Hero");

  return (
    <section className="relative overflow-hidden border-b-2 border-border">
      {/* Background effects */}
      <div className="cyber-grid absolute inset-0 opacity-20 pointer-events-none" />
      <div className="gradient-mesh absolute inset-0 opacity-30 pointer-events-none mix-blend-screen" />

      <div className="relative mx-auto max-w-5xl px-6 pb-20 pt-24 text-center">
        <div className="animate-slide-up-fade flex flex-col items-center justify-center">
          <div className="inline-block rounded-full border-2 border-lime-400 bg-lime-400/10 px-4 py-1.5 mb-8">
            <span className="text-sm font-bold leading-none tracking-wider text-lime-400 uppercase">
              {t("badge")}
            </span>
          </div>

          <h1 className="text-4xl font-extrabold uppercase leading-[0.9] tracking-tighter text-foreground sm:text-5xl md:text-6xl lg:text-[6rem]">
            {t("titleLine1")} <br />
            <span className="text-primary [-webkit-text-stroke:2px_#000] drop-shadow-[4px_4px_0_rgba(205,220,57,1)]">
              {t("titleLine2")}
            </span>
          </h1>

          <p className="animate-slide-up-fade-delay-1 mx-auto mt-12 max-w-2xl text-xl font-medium leading-relaxed text-muted-foreground md:text-2xl">
            {t("description")}{" "}
            <span className="font-bold text-foreground underline decoration-primary decoration-4 underline-offset-4">
              {t("descriptionHighlight")}
            </span>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
