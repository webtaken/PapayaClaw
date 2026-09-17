/**
 * Model reference helpers shared by the deploy wizard, the reconfigure
 * module and the API routes that persist a model string.
 *
 * A model ref is `provider/model` (OpenRouter refs are
 * `openrouter/<vendor>/<model>`). These helpers exist because a free-text
 * field once let users submit API keys or typos as the model, which then
 * landed verbatim in `agents.defaults.model.primary` on the VPS.
 */

/** Matches OpenAI/Anthropic/OpenRouter-style secret keys anywhere in the string. */
const API_KEY_PATTERN = /(^|\/)sk-[a-z0-9-]+/i;

/** `provider/model` — provider is lowercase slug, model is any non-space text. */
const MODEL_REF_PATTERN = /^[a-z0-9-]+\/\S+$/;

export type ModelRefValidation =
  | { ok: true; model: string }
  | { ok: false; reason: "empty" | "api-key" | "format" };

/**
 * Trim, lowercase the provider segment and collapse a duplicated provider
 * prefix (`openrouter/openrouter/auto` → `openrouter/auto`).
 */
export function normalizeModelRef(input: string): string {
  const trimmed = input.trim();
  const slash = trimmed.indexOf("/");
  if (slash === -1) return trimmed;

  const provider = trimmed.slice(0, slash).toLowerCase();
  let rest = trimmed.slice(slash + 1);
  const dupPrefix = `${provider}/`;
  while (rest.toLowerCase().startsWith(dupPrefix)) {
    rest = rest.slice(dupPrefix.length);
  }
  return `${provider}/${rest}`;
}

/** True when the value looks like a secret key rather than a model id. */
export function looksLikeApiKey(input: string): boolean {
  return API_KEY_PATTERN.test(input.trim());
}

/** Normalize and validate a user-supplied model ref. */
export function validateModelRef(input: string): ModelRefValidation {
  const model = normalizeModelRef(input);
  if (!model) return { ok: false, reason: "empty" };
  if (looksLikeApiKey(model)) return { ok: false, reason: "api-key" };
  if (!MODEL_REF_PATTERN.test(model)) return { ok: false, reason: "format" };
  return { ok: true, model };
}
