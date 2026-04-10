"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Google } from "@/components/icons/google";
import { cn } from "@/lib/utils";

export function LoginForm() {
  const t = useTranslations("LoginPage");
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });
    } catch (error) {
      console.error("Sign in error:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="animate-slide-up-fade w-full max-w-sm">
      <Card className="neo-card border-2 border-border bg-card neo-shadow overflow-hidden">
        {/* Top accent stripe */}
        <div className="h-1.5 w-full bg-primary" />

        <CardHeader className="items-center gap-4 pb-0 pt-8">
          <div className="relative">
            <div className="absolute -inset-2 rounded-2xl bg-primary/10 blur-sm" />
            <Image
              src="/papayaclaw.png"
              width={64}
              height={64}
              alt="PapayaClaw Logo"
              className="relative object-contain"
              priority
            />
          </div>
          <div className="space-y-1 text-center">
            <h1 className="text-xl font-bold uppercase tracking-tight text-foreground">
              {t("title")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <Button
            onClick={handleSignIn}
            disabled={isLoading}
            variant="outline"
            className={cn(
              "w-full gap-3 border-2 border-border bg-background py-5 text-sm font-bold uppercase tracking-wide text-foreground",
              "transition-all hover:border-primary hover:bg-primary/5 hover:text-foreground",
              "focus-visible:border-primary focus-visible:ring-primary/20",
              "disabled:opacity-60"
            )}
          >
            <Google className="size-5 shrink-0" />
            {isLoading ? "..." : t("signInWithGoogle")}
          </Button>
        </CardContent>

        <CardFooter className="justify-center pb-8 pt-2">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
            {t("securePrivateFree")}
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
