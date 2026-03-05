import { Check, Zap, Crown } from "lucide-react";
import Link from "next/link";

const plans = [
  {
    name: "Basic",
    price: "39.90",
    interval: "month",
    description: "Everything you need to deploy and run your OpenClaw bot.",
    accentColor: "primary",
    shadow: "neo-shadow",
    borderColor: "border-border",
    bgTint: "bg-[#0f1014]",
    icon: Zap,
    features: [
      "1 bot deployment",
      "2 vCPU, 4 GB RAM, 40 GB SSD",
      "Telegram & SSH channels",
      "Secure web dashboard",
      "10$ in credits, Claude Sonnet 4.6, GPT-5.2",
      "BYOK Anthropic, OpenAI, Z.AI, Minimax, etc.",
      "Basic support",
    ],
    cta: "Get Started",
    ctaStyle:
      "bg-white text-black border-2 border-white hover:bg-primary hover:border-primary hover:neo-shadow transition-all font-bold uppercase tracking-wider",
    envVar: "NEXT_PUBLIC_POLAR_BASIC_PRODUCT_ID",
  },
  {
    name: "Pro",
    price: "59.90",
    interval: "month",
    description: "Maximum power for serious deployments.",
    accentColor: "secondary",
    shadow: "neo-shadow-lime",
    borderColor: "border-secondary",
    bgTint: "bg-[#cddc39]/[0.03]",
    icon: Crown,
    popular: true,
    features: [
      "1 bot instance",
      "4 vCPU, 8 GB RAM, 80 GB SSD",
      "Telegram & SSH channels",
      "Secure web dashboard",
      "10$ in credits, Claude Sonnet 4.6, GPT-5.2",
      "BYOK Anthropic, OpenAI, Z.AI, Minimax, etc.",
      "Priority support",
      "Exclusive templates and tutorials",
    ],
    cta: "Go Pro",
    ctaStyle:
      "bg-secondary text-black border-2 border-secondary hover:bg-lime-300 hover:border-lime-300 neo-shadow-sm hover:neo-shadow-lime transition-all font-bold uppercase tracking-wider",
    envVar: "NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID",
  },
];

export function Pricing() {
  const basicProductId = process.env.NEXT_PUBLIC_POLAR_BASIC_PRODUCT_ID;
  const proProductId = process.env.NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID;
  const productIds: Record<string, string | undefined> = {
    NEXT_PUBLIC_POLAR_BASIC_PRODUCT_ID: basicProductId,
    NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID: proProductId,
  };

  return (
    <section className="relative overflow-hidden border-b-2 border-border">
      {/* Background effects — matching hero */}
      <div className="cyber-grid absolute inset-0 opacity-20 pointer-events-none" />
      <div className="gradient-mesh absolute inset-0 opacity-20 pointer-events-none mix-blend-screen" />

      <div className="relative mx-auto max-w-5xl px-6 py-24">
        {/* Section Header */}
        <div className="text-center mb-20 animate-slide-up-fade">
          <div className="inline-block rounded-full border-2 border-primary bg-primary/10 px-4 py-1.5 mb-8">
            <span className="text-sm font-bold leading-none tracking-wider text-primary uppercase">
              Simple Pricing
            </span>
          </div>
          <h1 className="text-4xl font-extrabold uppercase leading-[0.95] tracking-tighter text-white sm:text-5xl md:text-6xl">
            Pick Your{" "}
            <span className="text-primary [-webkit-text-stroke:2px_#000] drop-shadow-[4px_4px_0_rgba(205,220,57,1)]">
              Power
            </span>
          </h1>
          <p className="mx-auto mt-8 max-w-xl text-lg font-medium text-zinc-400">
            No hidden fees. No setup costs. Cancel anytime.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 animate-slide-up-fade-delay-1">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const productId = productIds[plan.envVar];
            const checkoutUrl = productId
              ? `/api/checkout?products=${productId}`
              : "/dashboard";

            return (
              <div
                key={plan.name}
                className={`neo-card relative flex flex-col rounded-none border-2 ${plan.borderColor} ${plan.bgTint} p-0 ${plan.shadow} transition-transform hover:-translate-y-1`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-px -right-px bg-secondary text-black px-4 py-1.5 text-xs font-black uppercase tracking-widest border-l-2 border-b-2 border-secondary">
                    Popular
                  </div>
                )}

                {/* Card Header */}
                <div className={`p-8 pb-0`}>
                  <div className="flex items-center gap-3 mb-6">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-none border-2 ${
                        plan.accentColor === "secondary"
                          ? "border-secondary bg-secondary text-black"
                          : "border-primary bg-primary text-black"
                      }`}
                    >
                      <Icon className="h-5 w-5" strokeWidth={2.5} />
                    </div>
                    <h3 className="text-2xl font-bold uppercase tracking-tight text-white">
                      {plan.name}
                    </h3>
                  </div>

                  <p className="text-sm font-medium text-zinc-400 mb-8">
                    {plan.description}
                  </p>

                  {/* Price */}
                  <div className="flex items-baseline gap-1 mb-8">
                    <span className="text-sm font-bold text-zinc-500">$</span>
                    <span
                      className={`text-6xl font-black tracking-tighter ${
                        plan.accentColor === "secondary"
                          ? "text-secondary [-webkit-text-stroke:1px_#000] drop-shadow-[3px_3px_0_rgba(255,87,34,1)]"
                          : "text-white"
                      }`}
                    >
                      {plan.price}
                    </span>
                    <span className="text-base font-bold text-zinc-500 uppercase ml-1">
                      / {plan.interval}
                    </span>
                  </div>
                </div>

                {/* Divider */}
                <div
                  className={`mx-8 border-t-2 ${
                    plan.accentColor === "secondary"
                      ? "border-secondary/30"
                      : "border-border"
                  }`}
                />

                {/* Features */}
                <div className="p-8 flex-1">
                  <div className="space-y-0">
                    {plan.features.map((feature, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-4 py-3.5 ${
                          i < plan.features.length - 1
                            ? `border-b-2 ${
                                plan.accentColor === "secondary"
                                  ? "border-secondary/10"
                                  : "border-border/50"
                              }`
                            : ""
                        }`}
                      >
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-none border-2 ${
                            plan.accentColor === "secondary"
                              ? "border-secondary bg-secondary text-black"
                              : "border-zinc-600 bg-zinc-800 text-zinc-400"
                          } text-xs font-bold`}
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </div>
                        <span className="text-sm font-semibold text-zinc-300">
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <div className="p-8 pt-0">
                  <Link
                    href={checkoutUrl}
                    className={`flex w-full items-center justify-center rounded-none px-6 py-4 text-sm ${plan.ctaStyle}`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom note */}
        <div className="mt-16 text-center animate-slide-up-fade-delay-2">
          <p className="text-sm font-medium text-zinc-500">
            Both plans include a{" "}
            <span className="font-bold text-zinc-300">
              dedicated VPS instance
            </span>{" "}
            — your bot runs 24/7 on its own server.
          </p>
          <p className="mt-2 text-xs text-zinc-600">
            Manage your subscription anytime via the{" "}
            <span className="text-primary font-semibold">Customer Portal</span>.
          </p>
        </div>
      </div>
    </section>
  );
}
