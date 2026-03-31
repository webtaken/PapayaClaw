"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useTranslations } from "next-intl";
import { PROVIDERS, CHANNELS } from "@/lib/ai-config";
import { getProviderIcon, getChannelIcon } from "@/lib/ai-config-ui";

const CONFIGURATOR_PROVIDERS = PROVIDERS.filter((p) => p.id !== "opencode");
const CONFIGURATOR_CHANNELS = CHANNELS.filter((c) => c.id !== "slack");

export function Configurator() {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const t = useTranslations("Configurator");

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

  return (
    <section className="animate-slide-up-fade-delay-2 mx-auto max-w-3xl px-6 pb-16 pt-16 relative z-10">
      <div className="neo-card border-2 border-border bg-[#18191f] p-8 neo-shadow">
        {/* Provider Selection */}
        <div className="mb-8">
          <h2 className="mb-4 text-center text-lg font-semibold text-white">
            {t("providerQuestion")}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {CONFIGURATOR_PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                onClick={() => setSelectedProvider(provider.id)}
                className={`neo-card flex flex-col items-center justify-center gap-2 border-2 p-4 text-center ${
                  selectedProvider === provider.id
                    ? "option-selected bg-secondary text-black"
                    : "border-border bg-[#0f1014] text-zinc-300 hover:border-primary hover:text-white neo-card-hover"
                }`}
              >
                <div className="flex items-center justify-center scale-125 mb-1 transition-transform group-hover:scale-150">
                  {getProviderIcon(provider.id)}
                </div>
                <span className="text-xs font-medium">{provider.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Channel Selection */}
        <div className="mb-8">
          <h2 className="mb-4 text-center text-lg font-semibold text-white">
            {t("channelQuestion")}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {CONFIGURATOR_CHANNELS.map((channel) => (
              <button
                key={channel.id}
                onClick={() => setSelectedChannel(channel.id)}
                className={`neo-card flex items-center gap-4 border-2 px-5 py-4 text-left ${
                  selectedChannel === channel.id
                    ? "option-selected bg-secondary text-black"
                    : "border-border bg-[#0f1014] text-zinc-300 hover:border-primary hover:text-white neo-card-hover"
                }`}
              >
                <span className="text-2xl scale-110">{getChannelIcon(channel.id)}</span>
                <span className="text-base font-bold uppercase tracking-wide">
                  {channel.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Sign In Button */}
        <div className="flex flex-col items-center gap-4">
          <Button
            onClick={handleSignIn}
            className="w-full max-w-md cursor-pointer border-2 border-black bg-white px-8 py-6 text-lg font-bold uppercase tracking-widest text-black transition-all hover:-translate-y-1 hover:bg-zinc-100 hover:neo-shadow sm:w-auto neo-shadow-sm"
          >
            <svg className="mr-3 h-6 w-6" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {t("signInWithGoogle")}
          </Button>
          <p className="max-w-sm text-center text-sm leading-relaxed text-zinc-400 mt-2 font-medium">
            {t("signInDescription")}
            <br />
            <span className="mt-2 inline-block rounded-full bg-primary/10 px-3 py-1 text-primary ring-1 ring-primary/30">
              {t("limitedServers")}
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
