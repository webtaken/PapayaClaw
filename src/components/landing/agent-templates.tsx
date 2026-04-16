import { getTranslations } from "next-intl/server";
import {
  Search,
  PencilLine,
  BarChart3,
  Settings,
  Mail,
  Radio,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

type TemplateKey =
  | "researchAnalyst"
  | "contentWriter"
  | "dataAnalyst"
  | "operationsAssistant"
  | "inboxManager"
  | "socialMediaMonitor";

type Template = {
  key: TemplateKey;
  icon: LucideIcon;
  accent: "primary" | "secondary";
};

const templates: Template[] = [
  { key: "researchAnalyst", icon: Search, accent: "primary" },
  { key: "contentWriter", icon: PencilLine, accent: "secondary" },
  { key: "dataAnalyst", icon: BarChart3, accent: "primary" },
  { key: "operationsAssistant", icon: Settings, accent: "secondary" },
  { key: "inboxManager", icon: Mail, accent: "primary" },
  { key: "socialMediaMonitor", icon: Radio, accent: "secondary" },
];

export async function AgentTemplates() {
  const t = await getTranslations("AgentTemplates");

  return (
    <section
      id="agent-templates"
      className="relative border-b border-border scroll-mt-20"
    >
      <div className="mx-auto max-w-5xl px-6 py-20">
        {/* Section Header */}
        <div className="mb-14 animate-slide-up-fade">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("title")}{" "}
            <span className="text-primary">{t("titleHighlight")}</span>{" "}
            {t("titleEnd")}
          </h2>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            {t("description")}
          </p>
        </div>

        {/* Template Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 animate-slide-up-fade-delay-1">
          {templates.map((template, i) => {
            const Icon = template.icon;
            const isPrimary = template.accent === "primary";

            return (
              <a
                key={template.key}
                href="#pricing"
                aria-label={t("ctaAriaLabel", {
                  name: t(`templates.${template.key}.name`),
                })}
                className={`group neo-card relative flex flex-col rounded-none border-2 border-border bg-card p-6 neo-shadow-sm transition-all hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  isPrimary
                    ? "hover:border-primary hover:neo-shadow focus-visible:ring-primary"
                    : "hover:border-secondary hover:neo-shadow-lime focus-visible:ring-secondary"
                }`}
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {/* Icon */}
                <div
                  className={`mb-5 flex h-11 w-11 items-center justify-center rounded-none border-2 ${
                    isPrimary
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-secondary bg-secondary/15 text-secondary-foreground dark:bg-secondary/20 dark:text-secondary"
                  }`}
                >
                  <Icon
                    className="h-5 w-5"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                </div>

                {/* Title */}
                <h3 className="mb-2 text-lg font-bold uppercase tracking-tight text-foreground">
                  {t(`templates.${template.key}.name`)}
                </h3>

                {/* Description */}
                <p className="mb-6 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {t(`templates.${template.key}.description`)}
                </p>

                {/* CTA */}
                <div
                  className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest transition-colors ${
                    isPrimary
                      ? "text-primary group-hover:text-primary"
                      : "text-foreground group-hover:text-secondary-foreground dark:group-hover:text-secondary"
                  }`}
                >
                  {t("useTemplate")}
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                    strokeWidth={3}
                  />
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
