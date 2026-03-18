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
      className="cursor-pointer text-sm text-zinc-400 transition-colors hover:text-white"
    >
      {t("signOut")}
    </Button>
  );
}
