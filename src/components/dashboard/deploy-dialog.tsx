"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Rocket, Check } from "lucide-react";
import type { Instance } from "./dashboard-content";

const models = [
  {
    id: "claude-opus-4.5",
    name: "Claude Opus 4.5",
    icon: "🟣",
    provider: "Anthropic",
  },
  {
    id: "gpt-5.2",
    name: "GPT-5.2",
    icon: "🟢",
    provider: "OpenAI",
  },
  {
    id: "gemini-3-flash",
    name: "Gemini 3 Flash Preview",
    icon: "🔵",
    provider: "Google",
  },
  {
    id: "custom",
    name: "Custom / Other",
    icon: "⚪",
    provider: "Bring your own API key",
  },
];

const channels = [
  {
    id: "telegram",
    name: "Telegram",
    icon: "✈️",
    available: true,
  },
  {
    id: "discord",
    name: "Discord",
    icon: "🎮",
    available: false,
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: "💬",
    available: false,
  },
  {
    id: "slack",
    name: "Slack",
    icon: "💼",
    available: false,
  },
];

const steps = [
  { number: 1, label: "Name & Model" },
  { number: 2, label: "Channel" },
  { number: 3, label: "Deploy" },
];

export function DeployDialog({
  open,
  onOpenChange,
  onInstanceCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstanceCreated: (instance: Instance) => void;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [modelApiKey, setModelApiKey] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [botToken, setBotToken] = useState("");
  const [isDeploying, setIsDeploying] = useState(false);

  const resetForm = () => {
    setStep(1);
    setName("");
    setSelectedModel(null);
    setModelApiKey("");
    setSelectedChannel(null);
    setBotToken("");
    setIsDeploying(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetForm();
    onOpenChange(newOpen);
  };

  const canProceedStep1 = name.trim() && selectedModel;
  const canProceedStep2 = selectedChannel && botToken.trim();

  const handleDeploy = async () => {
    setIsDeploying(true);
    try {
      const res = await fetch("/api/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          model: selectedModel,
          modelApiKey: selectedModel === "custom" ? modelApiKey : null,
          channel: selectedChannel,
          botToken: botToken.trim(),
        }),
      });

      if (res.ok) {
        const newInstance = await res.json();
        onInstanceCreated(newInstance);
        resetForm();
      }
    } catch {
      setIsDeploying(false);
    }
  };

  const selectedModelData = models.find((m) => m.id === selectedModel);
  const selectedChannelData = channels.find((c) => c.id === selectedChannel);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg border-zinc-800 bg-zinc-900 p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-zinc-800 px-6 pt-6 pb-4">
          <DialogTitle className="text-lg font-semibold text-white">
            Deploy New Instance
          </DialogTitle>

          {/* Step Indicator */}
          <div className="mt-4 flex items-center justify-between">
            {steps.map((s, i) => (
              <div key={s.number} className="flex items-center">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
                      step >= s.number
                        ? "bg-violet-500 text-white shadow-lg shadow-violet-500/25"
                        : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {step > s.number ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      s.number
                    )}
                  </div>
                  <span
                    className={`text-xs font-medium transition-colors ${
                      step >= s.number ? "text-white" : "text-zinc-500"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`mx-3 h-px w-8 transition-colors sm:w-12 ${
                      step > s.number ? "bg-violet-500" : "bg-zinc-700"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="px-6 py-6">
          {/* Step 1: Name & Model */}
          {step === 1 && (
            <div className="space-y-6 animate-fade-in-up">
              <div>
                <Label
                  htmlFor="instance-name"
                  className="mb-2 block text-sm font-medium text-zinc-300"
                >
                  Instance Name
                </Label>
                <Input
                  id="instance-name"
                  placeholder="My Assistant"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl border-zinc-700 bg-zinc-800/50 text-white placeholder:text-zinc-500 focus:border-violet-500 focus:ring-violet-500/20"
                />
              </div>

              <div>
                <Label className="mb-3 block text-sm font-medium text-zinc-300">
                  Select AI Model
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {models.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => setSelectedModel(model.id)}
                      className={`flex flex-col gap-1 rounded-xl border px-4 py-3 text-left transition-all duration-300 ${
                        selectedModel === model.id
                          ? "option-selected border-violet-500/50 bg-violet-500/10 text-white"
                          : "border-zinc-700/50 bg-zinc-800/50 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{model.icon}</span>
                        <span className="text-sm font-medium">
                          {model.name}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-500">
                        {model.provider}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedModel === "custom" && (
                <div className="animate-fade-in-up">
                  <Label
                    htmlFor="model-api-key"
                    className="mb-2 block text-sm font-medium text-zinc-300"
                  >
                    Model API Key
                  </Label>
                  <Input
                    id="model-api-key"
                    type="password"
                    placeholder="sk-..."
                    value={modelApiKey}
                    onChange={(e) => setModelApiKey(e.target.value)}
                    className="rounded-xl border-zinc-700 bg-zinc-800/50 font-mono text-sm text-white placeholder:text-zinc-500 focus:border-violet-500 focus:ring-violet-500/20"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Channel & Token */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in-up">
              <div>
                <Label className="mb-3 block text-sm font-medium text-zinc-300">
                  Select Channel
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {channels.map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() =>
                        channel.available && setSelectedChannel(channel.id)
                      }
                      disabled={!channel.available}
                      className={`relative flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-300 ${
                        !channel.available
                          ? "cursor-not-allowed border-zinc-800 bg-zinc-850/30 opacity-50"
                          : selectedChannel === channel.id
                            ? "option-selected border-violet-500/50 bg-violet-500/10 text-white"
                            : "border-zinc-700/50 bg-zinc-800/50 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
                      }`}
                    >
                      <span className="text-xl">{channel.icon}</span>
                      <div>
                        <span className="text-sm font-medium">
                          {channel.name}
                        </span>
                        {!channel.available && (
                          <Badge
                            variant="secondary"
                            className="ml-2 rounded-md bg-zinc-700/50 px-1.5 py-0 text-[10px] text-zinc-400"
                          >
                            Soon
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedChannel === "telegram" && (
                <div className="space-y-3 animate-fade-in-up">
                  <Label
                    htmlFor="bot-token"
                    className="mb-2 block text-sm font-medium text-zinc-300"
                  >
                    Telegram Bot Token
                  </Label>
                  <Input
                    id="bot-token"
                    type="password"
                    placeholder="123456:ABC-DEF..."
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    className="rounded-xl border-zinc-700 bg-zinc-800/50 font-mono text-sm text-white placeholder:text-zinc-500 focus:border-violet-500 focus:ring-violet-500/20"
                  />
                  <p className="text-xs leading-relaxed text-zinc-500">
                    Create a bot via{" "}
                    <a
                      href="https://t.me/BotFather"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-400 underline decoration-violet-400/30 underline-offset-2 hover:text-violet-300"
                    >
                      @BotFather
                    </a>{" "}
                    on Telegram and paste the token here.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Review & Deploy */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="rounded-xl border border-zinc-800 bg-zinc-800/30 p-5">
                <h4 className="mb-4 text-sm font-semibold text-white">
                  Deployment Summary
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">Instance Name</span>
                    <span className="text-sm font-medium text-white">
                      {name}
                    </span>
                  </div>
                  <div className="h-px bg-zinc-800" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">AI Model</span>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-white">
                      <span className="text-xs">{selectedModelData?.icon}</span>
                      {selectedModelData?.name}
                    </span>
                  </div>
                  <div className="h-px bg-zinc-800" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">Channel</span>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-white">
                      <span className="text-xs">
                        {selectedChannelData?.icon}
                      </span>
                      {selectedChannelData?.name}
                    </span>
                  </div>
                  <div className="h-px bg-zinc-800" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">Bot Token</span>
                    <span className="font-mono text-xs text-zinc-400">
                      {botToken.slice(0, 8)}•••••
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3">
                <p className="text-xs leading-relaxed text-zinc-400">
                  <span className="font-medium text-violet-400">Note:</span>{" "}
                  Your instance will be deployed to a secure cloud server. You
                  can stop or delete it anytime from the dashboard.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4">
          {step > 1 ? (
            <Button
              variant="ghost"
              onClick={() => setStep(step - 1)}
              className="cursor-pointer gap-1.5 text-sm text-zinc-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
              className="cursor-pointer gap-1.5 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black shadow-lg transition-all duration-300 hover:bg-zinc-100 hover:shadow-xl disabled:opacity-40"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleDeploy}
              disabled={isDeploying}
              className="cursor-pointer gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-blue-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/30 disabled:opacity-60"
            >
              {isDeploying ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Deploying...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4" />
                  Deploy Instance
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
