import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Pricing } from "@/components/pricing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PricingPage" });

  return {
    title: t("title"),
    description: t("description"),
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: "/pricing",
    },
    alternates: {
      canonical: locale === "es" ? "/es/pricing" : "/pricing",
      languages: {
        en: "/pricing",
        es: "/es/pricing",
      },
    },
  };
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is PapayaClaw?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "PapayaClaw is a managed deployment platform for OpenClaw, an open-source personal AI assistant. It lets you deploy your own OpenClaw instance to a dedicated VPS in minutes, without any technical knowledge.",
        },
      },
      {
        "@type": "Question",
        name: "What is included in each plan?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Both Basic and Pro plans include a dedicated VPS instance where your bot runs 24/7, Telegram and SSH channels, a secure web dashboard, and bring-your-own API key support. Pro includes higher specs (4 vCPU, 8 GB RAM, 80 GB SSD), priority support, and exclusive templates.",
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
          text: "No. PapayaClaw handles all the technical complexity — servers, SSH, and the OpenClaw environment are already set up. You just pick a model, connect Telegram, and deploy.",
        },
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#07080a]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Header />
      <main>
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}
