"use client";

import { Check, Zap, Crown } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export function Pricing() {
  const { data: session, isPending } = authClient.useSession();
  const t = useTranslations("Pricing");

  const handleSignIn = async () => {
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });
    } catch (error) {
      console.error("Error signing in:", error);
    }
  };

  const basicProductId = process.env.NEXT_PUBLIC_POLAR_BASIC_PRODUCT_ID;
  const proProductId = process.env.NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID;

  const plans = [
    {
      nameKey: "plans.basic.name" as const,
      price: "11.90",
      interval: "month",
      descriptionKey: "plans.basic.description" as const,
      accentColor: "primary",
      icon: Zap,
      featureKeys: [
        "plans.basic.features.f1",
        "plans.basic.features.f2",
        "plans.basic.features.f3",
        "plans.basic.features.f4",
        "plans.basic.features.f5",
        "plans.basic.features.f6",
      ] as const,
      ctaKey: "plans.basic.cta" as const,
      ctaStyle:
        "bg-foreground text-background hover:bg-primary transition-colors font-semibold",
      productId: basicProductId,
    },
    {
      nameKey: "plans.pro.name" as const,
      price: "17.90",
      interval: "month",
      descriptionKey: "plans.pro.description" as const,
      accentColor: "secondary",
      icon: Crown,
      popular: true,
      featureKeys: [
        "plans.pro.features.f1",
        "plans.pro.features.f2",
        "plans.pro.features.f3",
        "plans.pro.features.f4",
        "plans.pro.features.f5",
        "plans.pro.features.f6",
        "plans.pro.features.f7",
      ] as const,
      ctaKey: "plans.pro.cta" as const,
      ctaStyle:
        "bg-secondary text-black hover:bg-lime-300 transition-colors font-semibold",
      productId: proProductId,
    },
  ];

  return (
    <section
      id="pricing"
      className="relative overflow-hidden border-b-2 border-border scroll-mt-24"
    >
      {/* Background effects — matching hero */}
      <div className="cyber-grid absolute inset-0 opacity-20 pointer-events-none" />
      <div className="gradient-mesh absolute inset-0 opacity-20 pointer-events-none mix-blend-screen" />

      <div className="relative mx-auto max-w-5xl px-6 py-24">
        {/* Section Header */}
        <div className="text-center mb-20">
          <Badge className="mb-8 rounded-full border-2 border-primary bg-primary/10 px-4 py-1.5 text-sm font-bold leading-none tracking-wider text-primary uppercase">
            {t("badge")}
          </Badge>
          <h2 className="text-4xl font-extrabold uppercase leading-[0.95] tracking-tighter text-foreground">
            {t("title")}{" "}
            <span className="text-primary [-webkit-text-stroke:2px_#000] drop-shadow-[4px_4px_0_rgba(205,220,57,1)]">
              {t("titleHighlight")}
            </span>
          </h2>
          <p className="mx-auto mt-8 max-w-xl text-lg font-medium text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const checkoutUrl = plan.productId
              ? `/api/checkout?products=${plan.productId}`
              : "/dashboard";

            return (
              <Card
                key={plan.nameKey}
                className={`relative gap-0 py-0 overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg ${
                  plan.popular
                    ? "border-secondary/40 ring-1 ring-secondary/30 shadow-md"
                    : "border-border"
                }`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <Badge className="absolute top-4 right-4 rounded-full bg-secondary text-black px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                    {t("popular")}
                  </Badge>
                )}

                {/* Card Header */}
                <CardHeader className="p-8 pb-0">
                  <div className="flex items-center gap-3 mb-6">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        plan.accentColor === "secondary"
                          ? "bg-secondary/15 text-secondary-foreground"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      <Icon className="h-5 w-5" strokeWidth={2} />
                    </div>
                    <h3 className="text-xl font-semibold tracking-tight text-foreground">
                      {t(plan.nameKey)}
                    </h3>
                  </div>

                  <p className="text-sm text-muted-foreground mb-8">
                    {t(plan.descriptionKey)}
                  </p>

                  {/* Price */}
                  <div className="flex items-baseline gap-1 mb-8">
                    <span className="text-sm font-medium text-muted-foreground">
                      $
                    </span>
                    <span className="text-5xl font-bold tracking-tight text-foreground">
                      {plan.price}
                    </span>
                    <span className="text-sm font-medium text-muted-foreground ml-1">
                      / {plan.interval}
                    </span>
                  </div>
                </CardHeader>

                {/* Divider */}
                <Separator className="mx-8 w-auto bg-border" />

                {/* Features */}
                <CardContent className="p-8 flex-1">
                  <div className="space-y-3">
                    {plan.featureKeys.map((featureKey) => (
                      <div
                        key={featureKey}
                        className="flex items-center gap-3"
                      >
                        <div
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                            plan.accentColor === "secondary"
                              ? "bg-secondary/20 text-secondary-foreground"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {t(featureKey)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>

                {/* CTA */}
                <CardFooter className="p-8 pt-0">
                  {isPending ? (
                    <Button
                      disabled
                      className={`w-full h-11 opacity-50 cursor-not-allowed ${plan.ctaStyle}`}
                    >
                      {t("loading")}
                    </Button>
                  ) : !session ? (
                    <Button
                      onClick={handleSignIn}
                      className={`w-full h-11 cursor-pointer ${plan.ctaStyle}`}
                    >
                      {t(plan.ctaKey)}
                    </Button>
                  ) : plan.productId ? (
                    // Raw <a>, not next-intl <Link>: /api/checkout is a global
                    // API route with no [locale] segment. Locale-prefixing it
                    // (e.g. /es/api/checkout) 404s before reaching Polar.
                    <Button
                      asChild
                      className={`w-full h-11 ${plan.ctaStyle}`}
                    >
                      <a
                        href={`${checkoutUrl}&customerExternalId=${session.user.id}&customerEmail=${encodeURIComponent(session.user.email)}`}
                      >
                        {t(plan.ctaKey)}
                      </a>
                    </Button>
                  ) : (
                    <Button
                      asChild
                      className={`w-full h-11 ${plan.ctaStyle}`}
                    >
                      <Link href="/dashboard">{t(plan.ctaKey)}</Link>
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Bottom note */}
        <div className="mt-16 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {t("bottomNote")}{" "}
            <span className="font-bold text-muted-foreground">
              {t("bottomNoteHighlight")}
            </span>{" "}
            {t("bottomNoteEnd")}
          </p>
          <p className="mt-2 text-xs text-muted-foreground/60">
            {t("portalNote")}{" "}
            <span className="text-primary font-semibold">
              {t("portalLink")}
            </span>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
