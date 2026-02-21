"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

const models = [
  {
    id: "claude",
    name: "Claude Opus 4.5",
    icon: "🟣",
  },
  {
    id: "gpt",
    name: "GPT-5.2",
    icon: "🟢",
  },
  {
    id: "gemini",
    name: "Gemini 3 Flash",
    icon: "🔵",
  },
];

const channels = [
  {
    id: "telegram",
    name: "Telegram",
    icon: "✈️",
  },
  {
    id: "discord",
    name: "Discord",
    icon: "🎮",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: "💬",
  },
];

export function Configurator() {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [serversLeft] = useState(11);

  const handleSignIn = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/dashboard",
    });
  };

  return (
    <section className="animate-fade-in-up-delay-2 mx-auto max-w-3xl px-6 pb-16">
      <div className="card-glow overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8">
        {/* Model Selection */}
        <div className="mb-8">
          <h2 className="mb-4 text-center text-lg font-semibold text-white">
            Which model do you want as default?
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => setSelectedModel(model.id)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-300 ${
                  selectedModel === model.id
                    ? "option-selected border-violet-500/50 bg-violet-500/10 text-white"
                    : "border-zinc-700/50 bg-zinc-800/50 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                <span className="text-xl">{model.icon}</span>
                <span className="text-sm font-medium">{model.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Channel Selection */}
        <div className="mb-8">
          <h2 className="mb-4 text-center text-lg font-semibold text-white">
            Which channel do you want to use for sending messages?
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {channels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => setSelectedChannel(channel.id)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-300 ${
                  selectedChannel === channel.id
                    ? "option-selected border-violet-500/50 bg-violet-500/10 text-white"
                    : "border-zinc-700/50 bg-zinc-800/50 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                <span className="text-xl">{channel.icon}</span>
                <span className="text-sm font-medium">{channel.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sign In Button */}
        <div className="flex flex-col items-center gap-4">
          <Button
            onClick={handleSignIn}
            className="w-full max-w-sm cursor-pointer rounded-xl bg-white px-6 py-3 text-base font-semibold text-black shadow-lg transition-all duration-300 hover:bg-zinc-100 hover:shadow-xl sm:w-auto"
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
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
            Sign in with Google
          </Button>
          <p className="max-w-sm text-center text-xs leading-relaxed text-zinc-500">
            Sign in to deploy your AI assistant and connect your channels.
            <br />
            <span className="text-zinc-400">
              Limited cloud servers — only{" "}
              <span className="font-semibold text-amber-400">
                {serversLeft}
              </span>{" "}
              left
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
