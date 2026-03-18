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
import { toast } from "sonner";
import type { Instance } from "./dashboard-content";
import { ClaudeAI } from "@/components/icons/claudeai";
import { OpenAI } from "@/components/icons/openai";
import { MistralAI } from "@/components/icons/mistralai";
import { OpenRouter } from "@/components/icons/openrouter";
import { OpenCode } from "@/components/icons/opencode";
import { Telegram } from "../icons/telegram";
import { Discord } from "../icons/discord";
import { WhatsApp } from "../icons/whatsapp";
import { Slack } from "../icons/slack";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

const PROVDERS = [
  {
    id: "anthropic",
    name: "Anthropic",
    icon: <ClaudeAI className="h-5 w-5" />,
  },
  { id: "openai", name: "OpenAI", icon: <OpenAI className="h-5 w-5" /> },
  {
    id: "zai",
    name: "Z.AI",
    icon: (
      <Image
        src="/icons/Zai.png"
        alt="Z.AI"
        width={20}
        height={20}
        className="object-contain"
      />
    ),
  },
  { id: "mistral", name: "Mistral", icon: <MistralAI className="h-5 w-5" /> },
  {
    id: "minimax",
    name: "MiniMax",
    icon: (
      <Image
        src="/icons/MiniMax.jpg"
        alt="MiniMax"
        width={20}
        height={20}
        className="object-contain"
      />
    ),
    badge: "recommended",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    icon: <OpenRouter className="h-5 w-5 fill-current" />,
  },
  {
    id: "opencode",
    name: "OpenCode Zen",
    icon: <OpenCode className="h-5 w-5" />,
  },
];

const MODELS_BY_PROVIDER: Record<
  string,
  { id: string; name: string; badge?: string }[]
> = {
  anthropic: [
    { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
  ],
  openai: [
    { id: "gpt-5.2", name: "GPT-5.2" },
    { id: "gpt-5.1-codex", name: "GPT-5.1 Codex" },
    { id: "gpt-5.1-codex-mini", name: "GPT-5.1 Codex-Mini" },
    { id: "gpt-5-mini", name: "GPT-5 Mini" },
    { id: "gpt-4.1-mini", name: "GPT-4.1 Mini" },
  ],
  mistral: [{ id: "mistral-large-latest", name: "Mistral Large" }],
  zai: [
    { id: "glm-4.7", name: "GLM 4.7" },
    { id: "glm-5", name: "GLM 5", badge: "Requires Pro+" },
  ],
  minimax: [{ id: "MiniMax-M2.1", name: "MiniMax M2.1" }],
};

const channels = [
  {
    id: "telegram",
    name: "Telegram",
    icon: <Telegram className="h-5 w-5" />,
    available: true,
  },
  {
    id: "discord",
    name: "Discord",
    icon: <Discord className="h-5 w-5" />,
    available: false,
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: <WhatsApp className="h-5 w-5" />,
    available: false,
  },
  {
    id: "slack",
    name: "Slack",
    icon: <Slack className="h-5 w-5" />,
    available: false,
  },
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
  const router = useRouter();
  const t = useTranslations("DeployDialog");
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [customModelId, setCustomModelId] = useState("");
  const [modelApiKey, setModelApiKey] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [botToken, setBotToken] = useState("");
  const [isDeploying, setIsDeploying] = useState(false);

  const steps = [
    { number: 1, label: t("step1") },
    { number: 2, label: t("step2") },
    { number: 3, label: t("step3") },
  ];

  const resetForm = () => {
    setStep(1);
    setName("");
    setSelectedProvider(null);
    setSelectedModel(null);
    setCustomModelId("");
    setModelApiKey("");
    setSelectedChannel(null);
    setBotToken("");
    setIsDeploying(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetForm();
    onOpenChange(newOpen);
  };

  const isCustomProvider =
    selectedProvider === "openrouter" || selectedProvider === "opencode";

  const finalModelId = isCustomProvider
    ? `${selectedProvider}/${customModelId}`
    : selectedModel;

  const activeApiKey = modelApiKey.trim();

  const canProceedStep1 =
    name.trim() && selectedProvider && finalModelId && activeApiKey;
  const canProceedStep2 = selectedChannel && botToken.trim();

  const handleDeploy = async () => {
    setIsDeploying(true);
    try {
      const res = await fetch("/api/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          model: finalModelId,
          modelApiKey: activeApiKey,
          channel: selectedChannel,
          botToken: botToken.trim(),
        }),
      });

      if (res.ok) {
        const newInstance = await res.json();
        onInstanceCreated(newInstance);
        resetForm();
        router.push(`/dashboard/${newInstance.id}`);
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || t("deployError"));
        setIsDeploying(false);
      }
    } catch {
      toast.error(t("networkError"));
      setIsDeploying(false);
    }
  };

  const selectedProviderData = PROVDERS.find((p) => p.id === selectedProvider);
  const selectedChannelData = channels.find((c) => c.id === selectedChannel);

  const getModelName = () => {
    if (isCustomProvider) return finalModelId;
    if (!selectedProvider || !selectedModel) return "—";
    const modelObj = MODELS_BY_PROVIDER[selectedProvider]?.find(
      (m) => m.id === selectedModel,
    );
    return modelObj ? modelObj.name : selectedModel;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-y-auto border-zinc-800 bg-zinc-900 p-0 text-white">
        <DialogHeader className="border-b border-zinc-800 px-6 pt-6 pb-4">
          <DialogTitle className="text-lg font-semibold text-white">
            {t("title")}
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

        <div className="px-5 py-4">
          {/* Step 1: Name & Model */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in-up">
              <div>
                <Label
                  htmlFor="instance-name"
                  className="mb-1.5 block text-xs font-medium text-zinc-300"
                >
                  {t("instanceName")}
                </Label>
                <Input
                  id="instance-name"
                  placeholder={t("instanceNamePlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 rounded-lg border-zinc-700 bg-zinc-800/50 text-sm text-white placeholder:text-zinc-500 focus:border-violet-500 focus:ring-violet-500/20"
                />
              </div>

              <div>
                <Label className="mb-2 block text-xs font-medium text-zinc-300">
                  {t("selectProvider")}
                </Label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                  {PROVDERS.map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => {
                        setSelectedProvider(provider.id);
                        setSelectedModel(null);
                        setCustomModelId("");
                      }}
                      className={`relative flex flex-col items-center justify-center gap-1.5 rounded-lg border p-2 text-center transition-all duration-300 ${
                        selectedProvider === provider.id
                          ? "option-selected border-violet-500/50 bg-violet-500/10 text-white"
                          : "border-zinc-700/50 bg-zinc-800/50 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
                      }`}
                    >
                      <div className="flex h-5 items-center justify-center scale-75">
                        {provider.icon}
                      </div>
                      <span className="text-[10px] font-medium leading-none">
                        {provider.name}
                      </span>
                      {provider.badge && (
                        <Badge
                          variant="secondary"
                          className="absolute -top-1.5 -right-1.5 bg-violet-500 text-[8px] leading-none hover:bg-violet-600 text-white rounded px-1 py-0.5 border-none"
                        >
                          {t("recommended")}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {selectedProvider && !isCustomProvider && (
                <div className="animate-fade-in-up">
                  <Label className="mb-2 block text-xs font-medium text-zinc-300">
                    {t("selectModel")}
                  </Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {MODELS_BY_PROVIDER[selectedProvider]?.map((m) => {
                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            setSelectedModel(m.id);
                          }}
                          className={`relative flex flex-col gap-0.5 rounded-lg border px-2.5 py-1.5 text-left transition-all duration-300 ${
                            selectedModel === m.id
                              ? "option-selected border-violet-500/50 bg-violet-500/10 text-white"
                              : "border-zinc-700/50 bg-zinc-800/50 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
                          }`}
                        >
                          <span className="text-xs font-medium truncate w-full pr-4">
                            {m.name}
                          </span>
                          <span className="text-[9px] text-zinc-500 font-mono truncate w-full flex-1">
                            {m.id}
                          </span>
                          {m.badge && (
                            <span className="absolute right-1.5 top-1.5 text-[8px] font-medium text-amber-400">
                              ★
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedProvider && isCustomProvider && (
                <div className="animate-fade-in-up">
                  <Label
                    htmlFor="custom-model-id"
                    className="mb-1.5 block text-xs font-medium text-zinc-300"
                  >
                    {t("customModelString")}
                  </Label>
                  <div className="flex rounded-lg overflow-hidden border border-zinc-700 bg-zinc-800/50 shadow-sm focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500/20">
                    <div className="bg-zinc-800 px-2.5 py-1.5 text-xs font-mono text-zinc-400 flex items-center border-r border-zinc-700">
                      {selectedProvider}/
                    </div>
                    <input
                      id="custom-model-id"
                      type="text"
                      placeholder={t("customModelPlaceholder")}
                      value={customModelId}
                      onChange={(e) => setCustomModelId(e.target.value)}
                      className="flex-1 bg-transparent px-2.5 py-1.5 text-xs text-white font-mono placeholder:text-zinc-600 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {selectedProvider && (
                <div className="animate-fade-in-up mt-2">
                  <Label
                    htmlFor="model-api-key"
                    className="mb-1.5 block text-xs font-medium text-zinc-300"
                  >
                    {t("apiKeyFor", { provider: selectedProviderData?.name ?? "" })}
                  </Label>
                  <Input
                    id="model-api-key"
                    type="password"
                    placeholder="sk-..."
                    value={modelApiKey}
                    onChange={(e) => setModelApiKey(e.target.value)}
                    className="h-8 rounded-lg border-zinc-700 bg-zinc-800/50 font-mono text-xs text-white placeholder:text-zinc-500 focus:border-violet-500 focus:ring-violet-500/20"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Channel & Token */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in-up">
              <div>
                <Label className="mb-2 block text-xs font-medium text-zinc-300">
                  {t("selectChannel")}
                </Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {channels.map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() =>
                        channel.available && setSelectedChannel(channel.id)
                      }
                      disabled={!channel.available}
                      className={`relative flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-left transition-all duration-300 ${
                        !channel.available
                          ? "cursor-not-allowed border-zinc-800 bg-zinc-850/30 opacity-50"
                          : selectedChannel === channel.id
                            ? "option-selected border-violet-500/50 bg-violet-500/10 text-white"
                            : "border-zinc-700/50 bg-zinc-800/50 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
                      }`}
                    >
                      <span className="text-sm">{channel.icon}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium leading-none">
                          {channel.name}
                        </span>
                        {!channel.available && (
                          <Badge
                            variant="secondary"
                            className="rounded bg-zinc-700/50 px-1 py-0 text-[8px] tracking-wide text-zinc-400"
                          >
                            {t("soon")}
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedChannel === "telegram" && (
                <div className="space-y-2 animate-fade-in-up mt-2">
                  <Label
                    htmlFor="bot-token"
                    className="mb-1 block text-xs font-medium text-zinc-300"
                  >
                    {t("telegramBotToken")}
                  </Label>
                  <Input
                    id="bot-token"
                    type="password"
                    placeholder="123456:ABC-DEF..."
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    className="h-8 rounded-lg border-zinc-700 bg-zinc-800/50 font-mono text-xs text-white placeholder:text-zinc-500 focus:border-violet-500 focus:ring-violet-500/20"
                  />
                  <p className="text-[10px] leading-relaxed text-zinc-500">
                    {t("telegramTokenHelp")}{" "}
                    <a
                      href="https://t.me/BotFather"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-400 underline decoration-violet-400/30 underline-offset-2 hover:text-violet-300"
                    >
                      @BotFather
                    </a>{" "}
                    {t("telegramTokenHelpEnd")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Review & Deploy */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-4">
                <h4 className="mb-3 text-xs font-semibold text-white uppercase tracking-wider">
                  {t("summary")}
                </h4>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">{t("name")}</span>
                    <span className="text-xs font-medium text-white">
                      {name}
                    </span>
                  </div>
                  <div className="h-px bg-zinc-800/60" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">{t("selectModel")}</span>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-white">
                      <div className="scale-75 origin-right">
                        {selectedProviderData?.icon}
                      </div>
                      {getModelName()}
                    </span>
                  </div>
                  <div className="h-px bg-zinc-800/60" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">{t("selectChannel")}</span>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-white">
                      <span className="text-[10px]">
                        {selectedChannelData?.icon}
                      </span>
                      {selectedChannelData?.name}
                    </span>
                  </div>
                  <div className="h-px bg-zinc-800/60" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">{t("token")}</span>
                    <span className="font-mono text-[10px] text-zinc-400">
                      {botToken.slice(0, 8)}•••••
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2.5">
                <p className="text-[10px] leading-relaxed text-zinc-400">
                  <span className="font-medium text-violet-400">{t("deployNoteLabel")}</span>{" "}
                  {t("deployNote")}
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
              {t("back")}
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
              {t("next")}
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
                  {t("deploying")}
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4" />
                  {t("deployInstance")}
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
