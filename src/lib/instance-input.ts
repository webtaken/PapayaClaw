/**
 * Validation for the instance-creation payload, shared by
 * `POST /api/instances` and the Polar checkout server action so both paths
 * reject the same bad input (notably an API key or typo submitted as the
 * model — see model-ref.ts).
 */
import { validateModelRef } from "./model-ref";

export type InstanceInputErrorCode =
  | "invalidBody"
  | "missingFields"
  | "invalidModelApiKey"
  | "invalidModelFormat"
  | "telegramRequiresToken"
  | "whatsappRequiresPhone";

export type ValidatedInstanceInput = {
  name: string;
  model: string;
  modelApiKey: string | null;
  channel: string;
  botToken?: string;
  channelPhone?: string;
  planType?: "basic" | "pro";
};

export type InstanceInputResult =
  | { ok: true; data: ValidatedInstanceInput }
  | { ok: false; error: InstanceInputErrorCode };

/** English messages for API responses (the UI toasts them as-is). */
export const INSTANCE_INPUT_MESSAGES: Record<InstanceInputErrorCode, string> = {
  invalidBody: "Invalid body",
  missingFields: "Missing required fields",
  invalidModelApiKey:
    "The model field contains an API key. Pick a model and paste the key in the API key field.",
  invalidModelFormat:
    "Model must look like provider/model (e.g. openrouter/anthropic/claude-haiku-4.5).",
  telegramRequiresToken: "Telegram requires a bot token",
  whatsappRequiresPhone: "WhatsApp requires a phone number",
};

export function validateInstanceInput(
  body: unknown,
  opts: { requireApiKey?: boolean } = {},
): InstanceInputResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalidBody" };
  }
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const rawModel = typeof b.model === "string" ? b.model : "";
  const channel = typeof b.channel === "string" ? b.channel : "";
  const modelApiKey =
    typeof b.modelApiKey === "string" && b.modelApiKey.trim()
      ? b.modelApiKey.trim()
      : null;
  const botToken =
    typeof b.botToken === "string" && b.botToken.trim()
      ? b.botToken.trim()
      : undefined;
  const channelPhone =
    typeof b.channelPhone === "string" && b.channelPhone.trim()
      ? b.channelPhone.trim()
      : undefined;
  const planType =
    b.planType === "basic" || b.planType === "pro" ? b.planType : undefined;

  if (!name || !rawModel.trim() || !channel) {
    return { ok: false, error: "missingFields" };
  }
  if (opts.requireApiKey && !modelApiKey) {
    return { ok: false, error: "missingFields" };
  }

  const modelCheck = validateModelRef(rawModel);
  if (!modelCheck.ok) {
    return {
      ok: false,
      error:
        modelCheck.reason === "api-key"
          ? "invalidModelApiKey"
          : "invalidModelFormat",
    };
  }

  if (channel === "telegram" && !botToken) {
    return { ok: false, error: "telegramRequiresToken" };
  }
  if (channel === "whatsapp" && !channelPhone) {
    return { ok: false, error: "whatsappRequiresPhone" };
  }

  return {
    ok: true,
    data: {
      name,
      model: modelCheck.model,
      modelApiKey,
      channel,
      botToken,
      channelPhone,
      planType,
    },
  };
}
