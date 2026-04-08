"use client";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function SignOutButton() {
  const router = useRouter();
  const t = useTranslations("Dashboard");

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/");
  };

  return (
    <Button
      variant="ghost"
      onClick={handleSignOut}
      className="cursor-pointer text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      {t("signOut")}
    </Button>
  );
}
