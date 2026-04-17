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
import { ArrowLeft, ArrowRight, Rocket, Check, Info, ExternalLink } from "lucide-react";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { toast } from "sonner";
import type { Instance } from "./dashboard-content";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  PROVIDERS,
  CHANNELS,
  getModelsByProvider,
  getProvider,
  type ProviderId,
  type ChannelId,
} from "@/lib/ai-config";
import { getProviderIcon, getChannelIcon } from "@/lib/ai-config-ui";

const AVAILABLE_CHANNELS = new Set<ChannelId>(["telegram", "whatsapp"]);

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
  const [whatsappPhone, setWhatsappPhone] = useState("");
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
    setWhatsappPhone("");
    setIsDeploying(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetForm();
    onOpenChange(newOpen);
  };

  const isCustomProvider =
    selectedProvider === "openrouter" ||
    selectedProvider === "opencode" ||
    selectedProvider === "huggingface" ||
    selectedProvider === "litellm";

  const finalModelId = isCustomProvider
    ? `${selectedProvider}/${customModelId}`
    : selectedModel;

  const activeApiKey = modelApiKey.trim();

  const canProceedStep1 =
    name.trim() && selectedProvider && finalModelId && activeApiKey;
  const canProceedStep2 =
    selectedChannel &&
    ((selectedChannel === "telegram" && botToken.trim()) ||
      (selectedChannel === "whatsapp" && whatsappPhone.trim()));

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
          ...(selectedChannel === "telegram"
            ? { botToken: botToken.trim() }
            : {}),
          ...(selectedChannel === "whatsapp"
            ? { channelPhone: whatsappPhone.trim() }
            : {}),
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

  const selectedProviderData = PROVIDERS.find((p) => p.id === selectedProvider);
  const selectedChannelData = CHANNELS.find((c) => c.id === selectedChannel);

  const getModelName = () => {
    if (isCustomProvider) return finalModelId;
    if (!selectedProvider || !selectedModel) return "—";
    const models = getModelsByProvider(selectedProvider as ProviderId);
    const modelObj = models.find((m) => m.id === selectedModel);
    return modelObj ? modelObj.name : selectedModel;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-y-auto border-border bg-muted p-0 text-foreground">
        <DialogHeader className="border-b border-border px-6 pt-6 pb-4">
          <DialogTitle className="text-lg font-semibold text-foreground">
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
                        : "bg-muted text-muted-foreground"
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
                      step >= s.number
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`mx-3 h-px w-8 transition-colors sm:w-12 ${
                      step > s.number ? "bg-violet-500" : "bg-border"
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label
                    htmlFor="instance-name"
                    className="mb-1.5 block text-xs font-medium text-foreground/80"
                  >
                    {t("instanceName")}
                  </Label>
                  <Input
                    id="instance-name"
                    placeholder={t("instanceNamePlaceholder")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-8 rounded-lg border-border bg-muted/50 text-sm text-foreground placeholder:text-muted-foreground focus:border-violet-500 focus:ring-violet-500/20"
                  />
                </div>

                <div>
                  <Label className="mb-1.5 block text-xs font-medium text-foreground/80">
                    {t("selectProvider")}
                  </Label>
                  <Combobox
                  items={PROVIDERS.filter((p) => !p.deprecated).map((p) => p.id)}
                  value={selectedProvider ?? ""}
                  onValueChange={(val) => {
                    setSelectedProvider(val || null);
                    setSelectedModel(null);
                    setCustomModelId("");
                  }}
                  itemToStringLabel={(val) =>
                    PROVIDERS.find((p) => p.id === val)?.name ?? val
                  }
                >
                  <ComboboxInput
                    placeholder="Search AI provider..."
                    showClear={!!selectedProvider}
                    className="w-full border-border bg-muted/50 focus-within:border-violet-500 focus-within:ring-violet-500/20"
                  />
                  <ComboboxContent
                    align="start"
                    className="pointer-events-auto"
                    onWheel={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                  >
                    <ComboboxEmpty>No provider found.</ComboboxEmpty>
                    <ComboboxList className="max-h-56 overflow-y-auto">
                      {(id: string) => {
                        const provider = PROVIDERS.find((p) => p.id === id);
                        if (!provider) return null;
                        return (
                          <ComboboxItem key={id} value={id}>
                            <span className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4">
                              {getProviderIcon(provider.id)}
                            </span>
                            <span className="flex-1">{provider.name}</span>
                            {provider.badge && (
                              <Badge
                                variant="secondary"
                                className="ml-auto bg-violet-500 px-1.5 text-[9px] font-medium text-white border-none"
                              >
                                {t("recommended")}
                              </Badge>
                            )}
                          </ComboboxItem>
                        );
                      }}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                </div>
              </div>

              {selectedProvider &&
                (selectedProviderData?.setupNote ||
                  selectedProviderData?.docsUrl) && (
                  <div className="animate-fade-in-up rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <div className="flex-1 space-y-1">
                        {selectedProviderData?.setupNote && (
                          <p className="text-[11px] leading-relaxed text-foreground/80">
                            {selectedProviderData.setupNote}
                          </p>
                        )}
                        {selectedProviderData?.docsUrl && (
                          <a
                            href={selectedProviderData.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:text-amber-300"
                          >
                            View setup documentation
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              {selectedProvider && !isCustomProvider && (
                <div className="animate-fade-in-up">
                  <Label className="mb-2 block text-xs font-medium text-foreground/80">
                    {t("selectModel")}
                  </Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {getModelsByProvider(selectedProvider as ProviderId).map(
                      (m) => {
                        return (
                          <button
                            key={m.id}
                            onClick={() => {
                              setSelectedModel(m.id);
                            }}
                            className={`relative flex flex-col gap-0.5 rounded-lg border px-2.5 py-1.5 text-left transition-all duration-300 ${
                              selectedModel === m.id
                                ? "option-selected border-violet-500/50 bg-violet-500/10 text-white"
                                : "border-border/50 bg-muted/50 text-foreground/80 hover:border-border hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            <span className="text-xs font-medium truncate w-full pr-4">
                              {m.name}
                            </span>
                            <span className="text-[9px] text-muted-foreground font-mono truncate w-full flex-1">
                              {m.id}
                            </span>
                            {m.badge && (
                              <span className="absolute right-1.5 top-1.5 text-[8px] font-medium text-amber-400">
                                ★
                              </span>
                            )}
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>
              )}

              {selectedProvider && isCustomProvider && (
                <div className="animate-fade-in-up">
                  <Label
                    htmlFor="custom-model-id"
                    className="mb-1.5 block text-xs font-medium text-foreground/80"
                  >
                    {t("customModelString")}
                  </Label>
                  <div className="flex rounded-lg overflow-hidden border border-border bg-muted/50 shadow-sm focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500/20">
                    <div className="bg-muted px-2.5 py-1.5 text-xs font-mono text-muted-foreground flex items-center border-r border-border">
                      {selectedProvider}/
                    </div>
                    <input
                      id="custom-model-id"
                      type="text"
                      placeholder={t("customModelPlaceholder")}
                      value={customModelId}
                      onChange={(e) => setCustomModelId(e.target.value)}
                      className="flex-1 bg-transparent px-2.5 py-1.5 text-xs text-foreground font-mono placeholder:text-muted-foreground/60 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {selectedProvider && (
                <div className="animate-fade-in-up mt-2">
                  <Label
                    htmlFor="model-api-key"
                    className="mb-1.5 block text-xs font-medium text-foreground/80"
                  >
                    {t("apiKeyFor", {
                      provider: selectedProviderData?.name ?? "",
                    })}
                  </Label>
                  <Input
                    id="model-api-key"
                    type="password"
                    placeholder="sk-..."
                    value={modelApiKey}
                    onChange={(e) => setModelApiKey(e.target.value)}
                    className="h-8 rounded-lg border-border bg-muted/50 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-violet-500 focus:ring-violet-500/20"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Channel & Token */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in-up">
              <div>
                <Label className="mb-2 block text-xs font-medium text-foreground/80">
                  {t("selectChannel")}
                </Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CHANNELS.map((channel) => {
                    const available = AVAILABLE_CHANNELS.has(channel.id);
                    return (
                      <button
                        key={channel.id}
                        onClick={() =>
                          available && setSelectedChannel(channel.id)
                        }
                        disabled={!available}
                        className={`relative flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-left transition-all duration-300 ${
                          !available
                            ? "cursor-not-allowed border-border bg-muted/30 opacity-50"
                            : selectedChannel === channel.id
                              ? "option-selected border-violet-500/50 bg-violet-500/10 text-white"
                              : "border-border/50 bg-muted/50 text-foreground/80 hover:border-border hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <span className="text-sm">
                          {getChannelIcon(channel.id)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium leading-none">
                            {channel.name}
                          </span>
                          {!available && (
                            <Badge
                              variant="secondary"
                              className="rounded bg-border/50 px-1 py-0 text-[8px] tracking-wide text-muted-foreground"
                            >
                              {t("soon")}
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedChannel === "telegram" && (
                <div className="space-y-2 animate-fade-in-up mt-2">
                  <Label
                    htmlFor="bot-token"
                    className="mb-1 block text-xs font-medium text-foreground/80"
                  >
                    {t("telegramBotToken")}
                  </Label>
                  <Input
                    id="bot-token"
                    type="password"
                    placeholder="123456:ABC-DEF..."
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    className="h-8 rounded-lg border-border bg-muted/50 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-violet-500 focus:ring-violet-500/20"
                  />
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
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

              {selectedChannel === "whatsapp" && (
                <div className="space-y-2 animate-fade-in-up mt-2">
                  <Label
                    htmlFor="whatsapp-phone"
                    className="mb-1 block text-xs font-medium text-foreground/80"
                  >
                    {t("whatsappPhoneNumber")}
                  </Label>
                  <Input
                    id="whatsapp-phone"
                    type="tel"
                    placeholder="+15551234567"
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                    className="h-8 rounded-lg border-border bg-muted/50 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-violet-500 focus:ring-violet-500/20"
                  />
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    {t("whatsappPhoneHelp")}
                  </p>
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                      <span className="font-medium text-emerald-400">
                        {t("whatsappDedicatedLabel")}
                      </span>{" "}
                      {t("whatsappDedicatedNote")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Review & Deploy */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <h4 className="mb-3 text-xs font-semibold text-foreground uppercase tracking-wider">
                  {t("summary")}
                </h4>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {t("name")}
                    </span>
                    <span className="text-xs font-medium text-foreground">
                      {name}
                    </span>
                  </div>
                  <div className="h-px bg-border/60" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {t("selectModel")}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <div className="scale-75 origin-right">
                        {selectedProviderData &&
                          getProviderIcon(selectedProviderData.id)}
                      </div>
                      {getModelName()}
                    </span>
                  </div>
                  <div className="h-px bg-border/60" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {t("selectChannel")}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <span className="text-[10px]">
                        {selectedChannelData &&
                          getChannelIcon(selectedChannelData.id)}
                      </span>
                      {selectedChannelData?.name}
                    </span>
                  </div>
                  <div className="h-px bg-border/60" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {selectedChannel === "whatsapp"
                        ? t("phoneNumber")
                        : t("token")}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {selectedChannel === "whatsapp"
                        ? whatsappPhone
                        : `${botToken.slice(0, 8)}•••••`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2.5">
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  <span className="font-medium text-violet-400">
                    {t("deployNoteLabel")}
                  </span>{" "}
                  {t("deployNote")}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          {step > 1 ? (
            <Button
              variant="ghost"
              onClick={() => setStep(step - 1)}
              className="cursor-pointer gap-1.5 text-sm text-muted-foreground hover:text-foreground"
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
              className="cursor-pointer gap-1.5 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background shadow-lg transition-all duration-300 hover:bg-foreground/90 hover:shadow-xl disabled:opacity-40"
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
