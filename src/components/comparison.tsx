import { getTranslations } from "next-intl/server";

export async function Comparison() {
  const t = await getTranslations("Comparison");

  const traditionalSteps = [
    { label: t("steps.step1"), time: t("steps.step1Time") },
    { label: t("steps.step2"), time: t("steps.step2Time") },
    { label: t("steps.step3"), time: t("steps.step3Time") },
    { label: t("steps.step4"), time: t("steps.step4Time") },
    { label: t("steps.step5"), time: t("steps.step5Time") },
    { label: t("steps.step6"), time: t("steps.step6Time") },
    { label: t("steps.step7"), time: t("steps.step7Time") },
    { label: t("steps.step8"), time: t("steps.step8Time") },
  ];

  const benefits = [
    t("benefits.benefit1"),
    t("benefits.benefit2"),
    t("benefits.benefit3"),
  ];

  return (
    <section className="mx-auto max-w-6xl px-6 py-24 border-t-2 border-border bg-gradient-mesh">
      <h2 className="mb-16 text-center text-4xl font-extrabold uppercase tracking-tight text-foreground sm:text-5xl">
        {t("title")}{" "}
        <span className="text-secondary drop-shadow-[2px_2px_0_rgba(255,87,34,1)]">
          {t("titleHighlight")}
        </span>
      </h2>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Traditional Column */}
        <div className="neo-card flex flex-col rounded-none border-2 border-border bg-card p-8 neo-shadow transition-transform hover:-translate-y-1">
          <h3 className="mb-8 text-2xl font-bold uppercase text-muted-foreground">
            {t("traditionalTitle")}
          </h3>
          <div className="space-y-3">
            {traditionalSteps.map((step, i) => (
              <div
                key={i}
                className="flex items-center justify-between border-b-2 border-border py-4"
              >
                <span className="text-base font-medium text-muted-foreground">
                  {step.label}
                </span>
                <span className="ml-4 whitespace-nowrap text-base font-bold text-muted-foreground">
                  {step.time}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-8 flex items-center justify-between bg-muted px-4 py-3 border-2 border-border">
            <span className="text-lg font-bold uppercase text-muted-foreground">
              {t("total")}
            </span>
            <span className="text-xl font-black text-muted-foreground">{t("totalTime")}</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {t("nonTechNote")}
          </p>
        </div>

        {/* PapayaClaw Column */}
        <div className="neo-card flex flex-col justify-center rounded-none border-2 border-primary bg-[#ff5722]/5 p-8 neo-shadow-lime transition-transform hover:-translate-y-1">
          <h3 className="mb-8 text-2xl font-bold uppercase text-foreground drop-shadow-[2px_2px_0_rgba(255,87,34,1)]">
            {t("papayaclawTitle")}
          </h3>
          <div className="animate-float mb-8 flex items-center gap-4">
            <span className="text-5xl font-black tracking-tighter text-secondary [-webkit-text-stroke:2px_#000] drop-shadow-[4px_4px_0_rgba(255,87,34,1)]">
              {t("fewWord")}
            </span>
            <span className="text-3xl font-bold uppercase text-primary">
              {t("minsWord")}
            </span>
          </div>
          <p className="mb-10 text-lg font-medium leading-relaxed text-muted-foreground border-l-4 border-secondary pl-4">
            {t("papayaclawDescription")}
          </p>
          <div className="w-full space-y-3">
            {benefits.map((benefit, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b-2 border-primary/30 py-4 last:border-0"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-none border-2 border-secondary bg-secondary text-black font-bold">
                  ✓
                </div>
                <span className="text-base font-bold text-foreground">
                  {benefit}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
