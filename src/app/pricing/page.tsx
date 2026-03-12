import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Pricing } from "@/components/pricing";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — PapayaClaw",
  description:
    "Choose your PapayaClaw plan. Basic or Pro — deploy secure OpenClaw instances in minutes.",
  openGraph: {
    title: "Pricing — PapayaClaw",
    description: "Choose your PapayaClaw plan. Basic or Pro — deploy secure OpenClaw instances in minutes.",
    url: '/pricing',
  },
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#07080a]">
      <Header />
      <main>
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}
