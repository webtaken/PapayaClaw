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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://papayaclaw.com";

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "PapayaClaw",
      url: baseUrl,
      description:
        "Deploy secure OpenClaw instances in a few minutes. Avoid all technical complexity.",
      publisher: {
        "@type": "Organization",
        name: "PapayaClaw",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "PapayaClaw",
      url: baseUrl,
      description:
        "Managed deployment platform for OpenClaw — deploy your own AI assistant to a VPS in minutes.",
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "PapayaClaw",
      url: baseUrl,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      description:
        "One-click deploy secure OpenClaw AI assistant instances to dedicated VPS servers. No technical knowledge required.",
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
    },
  ];

  return (
    <div className="min-h-screen bg-background">
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
