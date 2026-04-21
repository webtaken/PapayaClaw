import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/landing/legal-page";

const SECTION_KEYS = [
  "dataWeCollect",
  "howWeUse",
  "sharing",
  "retention",
  "yourRights",
  "security",
  "cookies",
  "children",
  "changes",
  "contact",
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal.Privacy" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDescription"),
      url: "/privacy",
    },
    alternates: {
      canonical: locale === "es" ? "/es/privacy" : "/privacy",
      languages: {
        en: "/privacy",
        es: "/es/privacy",
      },
    },
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage namespace="Legal.Privacy" sectionKeys={SECTION_KEYS} />;
}
