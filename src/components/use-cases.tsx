import { Badge } from "@/components/ui/badge";
import { getTranslations } from "next-intl/server";

const useCaseKeys = [
  "customerSupport",
  "personalAssistant",
  "languageLearning",
  "codeReview",
  "contentWriting",
  "dataAnalysis",
  "socialMediaManager",
  "emailDrafting",
  "meetingSummarizer",
  "researchAssistant",
  "recipeGenerator",
  "travelPlanner",
  "studyBuddy",
  "healthFitnessCoach",
  "financialAdvisor",
  "legalDocumentReview",
  "interviewPrep",
  "newsSummarizer",
  "therapyChatbot",
  "languageTranslation",
] as const;

export async function UseCases() {
  const t = await getTranslations("UseCases");

  return (
    <section className="mx-auto max-w-5xl px-6 py-24 border-t-2 border-border relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-16 bg-linear-to-b from-border to-transparent" />
      <h2 className="mb-6 text-center text-3xl font-extrabold uppercase tracking-tight text-foreground md:text-4xl">
        {t("title")}{" "}
        <span className="text-secondary drop-shadow-[2px_2px_0_rgba(255,87,34,1)]">
          {t("titleHighlight")}
        </span>{" "}
        {t("titleEnd")}
      </h2>
      <p className="mb-14 text-center text-xl font-medium text-muted-foreground">
        {t("subtitle")}{" "}
        <span className="text-foreground underline decoration-wavy decoration-primary decoration-2 underline-offset-4">
          {t("subtitleHighlight")}
        </span>{" "}
        {t("subtitleEnd")}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {useCaseKeys.map((key, i) => (
          <Badge
            key={key}
            variant="secondary"
            className="cursor-default rounded-full border-2 border-border bg-card px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-muted-foreground transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:bg-primary hover:text-primary-foreground neo-shadow-sm hover:neo-shadow"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            {t(`cases.${key}`)}
          </Badge>
        ))}
      </div>
    </section>
  );
}
