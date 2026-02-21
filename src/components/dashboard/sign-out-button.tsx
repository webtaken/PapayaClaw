"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();

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
      Sign Out
    </Button>
  );
}
