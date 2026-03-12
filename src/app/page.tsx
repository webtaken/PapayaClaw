import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { Configurator } from "@/components/configurator";
import { Comparison } from "@/components/comparison";
import { UseCases } from "@/components/use-cases";
import { Footer } from "@/components/footer";

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "PapayaClaw",
    url: "https://papayaclaw.com", // Assuming domain, fallback handled
    description: "Deploy secure OpenClaw instances in a few minutes. Avoid all technical complexity.",
    publisher: {
      "@type": "Organization",
      name: "PapayaClaw"
    }
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
