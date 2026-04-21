import { Header } from "@/components/landing/header";
import { Footer } from "@/components/landing/footer";
import { getTranslations } from "next-intl/server";

type SectionKey = string;

export async function LegalPage({
  namespace,
  sectionKeys,
}: {
  namespace: "Legal.Privacy" | "Legal.Terms";
  sectionKeys: SectionKey[];
}) {
  const t = await getTranslations(namespace);
  const tLegal = await getTranslations("Legal");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-20">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          {tLegal("lastUpdated")}: {tLegal("lastUpdatedDate")}
        </p>
        <p className="text-base text-muted-foreground leading-relaxed mb-12">
          {t("intro")}
        </p>
        <div className="space-y-10">
          {sectionKeys.map((key) => (
            <section key={key}>
              <h2 className="text-xl md:text-2xl font-bold text-foreground mb-3">
                {t(`sections.${key}.title`)}
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                {t(`sections.${key}.body`)}
              </p>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
