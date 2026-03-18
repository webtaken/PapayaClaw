import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { Configurator } from "@/components/configurator";
import { Comparison } from "@/components/comparison";
import { UseCases } from "@/components/use-cases";
import { Footer } from "@/components/footer";
import { setRequestLocale } from "next-intl/server";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "PapayaClaw",
    url: "https://papayaclaw.com",
    description:
      "Deploy secure OpenClaw instances in a few minutes. Avoid all technical complexity.",
    publisher: {
      "@type": "Organization",
      name: "PapayaClaw",
    },
  };

  return (
    <div className="min-h-screen bg-[#07080a]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <main>
        <Hero />
        <Configurator />
        <Comparison />
        <UseCases />
      </main>
      <Footer />
    </div>
  );
}
