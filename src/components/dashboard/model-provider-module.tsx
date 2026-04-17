"use client";

import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import {
  getDeployableProviders,
  getModelsByProvider,
  getProvider,
  detectProviderByModelId,
  type ProviderId,
} from "@/lib/ai-config";
import { getProviderIcon, formatModelInfo } from "@/lib/ai-config-ui";

const PASS_THROUGH_PROVIDERS = new Set<string>([
  "openrouter",
  "huggingface",
  "synthetic",
  "litellm",
  "qianfan",
]);

function isPassThrough(providerId: string): boolean {
  return PASS_THROUGH_PROVIDERS.has(providerId);
}

export function ModelProviderModule({
  instanceId,
  currentModel,
  onModelChanged,
}: {
  instanceId: string;
  currentModel: string;
  onModelChanged: (newModel: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit form state
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [customModelId, setCustomModelId] = useState("");
  const [modelApiKey, setModelApiKey] = useState("");

  const currentInfo = formatModelInfo(currentModel);
  const currentProvider = detectProviderByModelId(currentModel);

  const deployableProviders = getDeployableProviders();

  const resetForm = useCallback(() => {
    setSelectedProvider(null);
    setSelectedModel(null);
    setCustomModelId("");
    setModelApiKey("");
  }, []);

  const startEditing = useCallback(() => {
    resetForm();
    setIsEditing(true);
  }, [resetForm]);

  const cancelEditing = useCallback(() => {
    resetForm();
    setIsEditing(false);
  }, [resetForm]);

  const selectedProviderData = selectedProvider
    ? getProvider(selectedProvider as ProviderId)
    : null;

  const isCustom = selectedProvider ? isPassThrough(selectedProvider) : false;

  const finalModelId = isCustom
    ? `${selectedProvider}/${customModelId}`
    : selectedModel;

  const canSave = selectedProvider && finalModelId && modelApiKey.trim();

  const handleSave = useCallback(async () => {
    if (!canSave || !finalModelId) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/instances/${instanceId}/reconfigure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: finalModelId,
          modelApiKey: modelApiKey.trim(),
        }),
      });

      if (res.ok) {
        onModelChanged(finalModelId);
        setIsEditing(false);
        resetForm();
        toast.success("Model updated", {
          description:
            "Your instance is being reconfigured with the new model.",
        });
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to reconfigure");
      }
    } catch {
      toast.error("Failed to connect");
    } finally {
      setIsSaving(false);
    }
  }, [
    canSave,
    finalModelId,
    modelApiKey,
    instanceId,
    onModelChanged,
    resetForm,
  ]);

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {currentProvider
              ? getProviderIcon(currentProvider.id, "h-4 w-4")
              : "⚪"}
          </span>
          <h3 className="text-xs font-mono font-semibold tracking-wide text-foreground/80 uppercase">
            AI Provider
          </h3>
        </div>
        {!isEditing ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={startEditing}
            className="h-6 px-2 text-sm font-mono hover:bg-muted hover:text-foreground text-muted-foreground border border-border/50 rounded gap-1"
          >
            <Pencil className="h-3 w-3" />
            CHANGE
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={cancelEditing}
            disabled={isSaving}
            className="h-6 px-2 text-sm font-mono hover:bg-muted hover:text-foreground text-muted-foreground border border-border/50 rounded gap-1"
          >
            <X className="h-3 w-3" />
            CANCEL
          </Button>
        )}
      </div>

      <div className="p-6">
        {!isEditing ? (
          /* ── View mode ── */
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">
                {currentProvider
                  ? getProviderIcon(currentProvider.id, "h-8 w-8")
                  : "⚪"}
              </span>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-medium text-foreground truncate">
                  {currentInfo.name}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground truncate">
                  {currentProvider?.name ?? "Unknown"} &middot; {currentModel}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* ── Edit mode ── */
          <div className="flex flex-col gap-4">
            {/* Provider combobox */}
            <div>
              <Label className="mb-2 block text-xs font-medium text-foreground/80">
                Select Provider
              </Label>
              <Combobox
                items={deployableProviders.map((p) => p.id)}
                value={selectedProvider ?? ""}
                onValueChange={(val) => {
                  setSelectedProvider(val || null);
                  setSelectedModel(null);
                  setCustomModelId("");
                }}
                itemToStringLabel={(val) =>
                  deployableProviders.find((p) => p.id === val)?.name ?? val
                }
              >
                <ComboboxInput
                  placeholder="Search AI provider..."
                  showClear={!!selectedProvider}
                  className="w-full border-border bg-muted/50 focus-within:border-violet-500 focus-within:ring-violet-500/20"
                />
                <ComboboxContent align="start" className="pointer-events-auto">
                  <ComboboxEmpty>No provider found.</ComboboxEmpty>
                  <ComboboxList className="max-h-56 overflow-y-auto">
                    {(id: string) => {
                      const provider = deployableProviders.find(
                        (p) => p.id === id,
                      );
                      if (!provider) return null;
                      return (
                        <ComboboxItem key={id} value={id}>
                          <span className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4">
                            {getProviderIcon(provider.id)}
                          </span>
                          <span className="flex-1">{provider.name}</span>
                          {provider.badge === "recommended" && (
                            <Badge
                              variant="secondary"
                              className="ml-auto bg-violet-500 px-1.5 text-[9px] font-medium text-white border-none"
                            >
                              ★
                            </Badge>
                          )}
                        </ComboboxItem>
                      );
                    }}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>

            {/* Model selection — predefined models */}
            {selectedProvider && !isCustom && (
              <div className="animate-fade-in-up">
                <Label className="mb-2 block text-xs font-medium text-foreground/80">
                  Select Model
                </Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {getModelsByProvider(selectedProvider as ProviderId).map(
                    (m) => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedModel(m.id)}
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
                    ),
                  )}
                </div>
              </div>
            )}

            {/* Model selection — custom/pass-through input */}
            {selectedProvider && isCustom && (
              <div className="animate-fade-in-up">
                <Label
                  htmlFor="reconfigure-model-id"
                  className="mb-1.5 block text-xs font-medium text-foreground/80"
                >
                  Model ID
                </Label>
                <div className="flex rounded-lg overflow-hidden border border-border bg-muted/50 shadow-sm focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500/20">
                  <div className="bg-muted px-2.5 py-1.5 text-xs font-mono text-muted-foreground flex items-center border-r border-border">
                    {selectedProvider}/
                  </div>
                  <input
                    id="reconfigure-model-id"
                    type="text"
                    placeholder="model-name"
                    value={customModelId}
                    onChange={(e) => setCustomModelId(e.target.value)}
                    className="flex-1 bg-transparent px-2.5 py-1.5 text-xs text-foreground font-mono placeholder:text-muted-foreground/60 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* API key input */}
            {selectedProvider && (
              <div className="animate-fade-in-up">
                <Label
                  htmlFor="reconfigure-api-key"
                  className="mb-1.5 block text-xs font-medium text-foreground/80"
                >
                  API Key for {selectedProviderData?.name ?? ""}
                </Label>
                <Input
                  id="reconfigure-api-key"
                  type="password"
                  placeholder="sk-..."
                  value={modelApiKey}
                  onChange={(e) => setModelApiKey(e.target.value)}
                  className="h-8 rounded-lg border-border bg-muted/50 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-violet-500 focus:ring-violet-500/20"
                />
              </div>
            )}

            {/* Save button */}
            {selectedProvider && (
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={!canSave || isSaving}
                  className="gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-mono font-semibold text-white uppercase tracking-wider shadow-none hover:bg-violet-500 disabled:opacity-40"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Reconfiguring...
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3" />
                      Save & Reconfigure
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
