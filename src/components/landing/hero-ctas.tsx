"use client";

import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeroCTAs({
  ctaPrimary,
  ctaSecondary,
}: {
  ctaPrimary: string;
  ctaSecondary: string;
}) {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="animate-slide-up-fade-delay-2 mt-10 flex flex-col items-center gap-3 sm:flex-row">
      <Button
        onClick={() => scrollTo("how-it-works")}
        size="lg"
        className="cursor-pointer px-8"
      >
        {ctaPrimary}
      </Button>
      <Button
        variant="outline"
        size="lg"
        onClick={() => scrollTo("pricing")}
        className="group cursor-pointer px-8"
      >
        {ctaSecondary}
        <ArrowDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
      </Button>
    </div>
  );
}
