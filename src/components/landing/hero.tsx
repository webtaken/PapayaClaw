import { getTranslations } from "next-intl/server";
import { HeroCTAs } from "@/components/landing/hero-ctas";

export async function Hero() {
  const t = await getTranslations("Hero");

  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="relative mx-auto max-w-4xl px-6 pb-24 pt-32 text-center">
        <div className="animate-slide-up-fade flex flex-col items-center justify-center">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
            {t("titleLine1")}{" "}
            <span className="text-primary">{t("titleLine2")}</span>
          </h1>

          <p className="animate-slide-up-fade-delay-1 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            {t("description")}{" "}
            <span className="font-semibold text-foreground">
              {t("descriptionHighlight")}
            </span>
            .
          </p>

          <HeroCTAs
            ctaPrimary={t("ctaPrimary")}
            ctaSecondary={t("ctaSecondary")}
          />
        </div>
      </div>
    </section>
  );
}
