import { getTranslations } from "next-intl/server";
import { HowItWorksStepper, type StepData } from "@/components/landing/how-it-works-stepper";

export async function HowItWorks() {
  const t = await getTranslations("HowItWorks");

  const steps: StepData[] = [
    {
      id: "step-1",
      number: t("step1Number"),
      title: t("step1Title"),
      description: t("step1Description"),
    },
    {
      id: "step-2",
      number: t("step2Number"),
      title: t("step2Title"),
      description: t("step2Description"),
    },
    {
      id: "step-3",
      number: t("step3Number"),
      title: t("step3Title"),
      description: t("step3Description"),
    },
    {
      id: "step-4",
      number: t("step4Number"),
      title: t("step4Title"),
      description: t("step4Description"),
    },
  ];

  return (
    <section
      id="how-it-works"
      className="border-b border-border scroll-mt-20"
    >
      <div className="mx-auto max-w-5xl px-6 py-20">
        <div className="mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("title")}{" "}
            <span className="text-primary">{t("titleHighlight")}</span>
          </h2>
        </div>

        <HowItWorksStepper steps={steps} />
      </div>
    </section>
  );
}
