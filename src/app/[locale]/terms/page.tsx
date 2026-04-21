import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/landing/legal-page";

const SECTION_KEYS = [
  "accounts",
  "service",
  "subscriptions",
  "acceptableUse",
  "userContent",
  "intellectualProperty",
  "thirdParty",
  "disclaimer",
  "liability",
  "termination",
  "governingLaw",
  "changes",
  "contact",
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal.Terms" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDescription"),
      url: "/terms",
    },
    alternates: {
      canonical: locale === "es" ? "/es/terms" : "/terms",
      languages: {
        en: "/terms",
        es: "/es/terms",
      },
    },
  };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage namespace="Legal.Terms" sectionKeys={SECTION_KEYS} />;
}
