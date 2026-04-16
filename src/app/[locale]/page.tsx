import { AgentTemplates } from "@/components/landing/agent-templates";
import { ConnectTools } from "@/components/landing/connect-tools";
import { Header } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Pricing } from "@/components/landing/pricing";
import { Enterprise } from "@/components/landing/enterprise";
import { Footer } from "@/components/landing/footer";
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
        "Deploy AI employees powered by OpenClaw. Browse agent templates and hire AI employees that work 24/7.",
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
        "AI employees platform — browse templates and deploy AI agents powered by OpenClaw in minutes.",
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "PapayaClaw",
      url: baseUrl,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Browse agent templates and hire AI employees powered by OpenClaw. Online 24/7, set up in minutes. No technical skills required.",
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "USD",
        lowPrice: "11.90",
        highPrice: "17.90",
        availability: "https://schema.org/InStock",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is PapayaClaw?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "PapayaClaw is an AI employees platform powered by OpenClaw. Browse ready-made agent templates and deploy AI employees that work 24/7 — no technical knowledge required.",
          },
        },
        {
          "@type": "Question",
          name: "What is included in each plan?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Both Basic and Pro plans include a dedicated server where your AI employee runs 24/7, Telegram and SSH channels, a secure web dashboard, and bring-your-own API key support. Pro includes higher specs (4 vCPU, 8 GB RAM, 80 GB SSD), priority support, and exclusive templates.",
          },
        },
        {
          "@type": "Question",
          name: "Can I cancel my subscription anytime?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes, there are no hidden fees or setup costs. You can cancel your PapayaClaw subscription at any time through the Customer Portal.",
          },
        },
        {
          "@type": "Question",
          name: "Do I need technical knowledge to use PapayaClaw?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. PapayaClaw handles all the technical complexity. You just pick a template, choose a channel, and your AI employee is live in minutes.",
          },
        },
      ],
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
        <HowItWorks />
        <ConnectTools />
        <AgentTemplates />
        <Pricing />
        <Enterprise />
      </main>
      <Footer />
    </div>
  );
}
