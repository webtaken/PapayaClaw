import { redirect } from "next/navigation";

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const path = locale === "es" ? "/es#pricing" : "/#pricing";
  redirect(path);
}
