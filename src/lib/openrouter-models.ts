/**
 * OpenRouter public model catalog (no API key needed).
 *
 * Backs the OpenRouter model picker in the deploy wizard and the reconfigure
 * module. Replaces the free-text "custom model" field, which let users submit
 * typos (`antrophic/sonne-5.0`) or their API key as the model id.
 */

export interface OpenRouterModel {
  /** OpenRouter id, e.g. `anthropic/claude-haiku-4.5` (no `openrouter/` prefix). */
  id: string;
  name: string;
  contextLength: number;
  /** USD per 1M prompt tokens. */
  promptPerMillion: number;
  /** USD per 1M completion tokens. */
  completionPerMillion: number;
  /** OpenClaw agents need tool calling; models without it are shown but flagged. */
  supportsTools: boolean;
  /** Curated pick — listed first. */
  featured: boolean;
}

/** Curated list shown first, in this order. Ids must exist in the catalog. */
export const FEATURED_OPENROUTER_MODEL_IDS: readonly string[] = [
  "anthropic/claude-haiku-4.5",
  "anthropic/claude-sonnet-4.6",
  "anthropic/claude-sonnet-5",
  "minimax/minimax-m3",
  "openai/gpt-5.4-mini",
  "google/gemini-3.8-flash",
  "deepseek/deepseek-v4.1-flash",
];

export const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

type RawModel = {
  id?: unknown;
  name?: unknown;
  context_length?: unknown;
  pricing?: { prompt?: unknown; completion?: unknown };
  supported_parameters?: unknown;
};

function perMillion(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1_000_000 * 1000) / 1000;
}

/** Shape the raw API payload into the picker's model list. */
export function parseOpenRouterModels(payload: unknown): OpenRouterModel[] {
  const data =
    payload && typeof payload === "object"
      ? (payload as { data?: unknown }).data
      : undefined;
  if (!Array.isArray(data)) return [];

  const featuredRank = new Map(
    FEATURED_OPENROUTER_MODEL_IDS.map((id, i) => [id, i] as const),
  );

  const models: OpenRouterModel[] = [];
  for (const raw of data as RawModel[]) {
    if (typeof raw.id !== "string" || !raw.id) continue;
    // Batch endpoints are async and useless for a chat agent.
    if (raw.id.endsWith(":batch")) continue;
    const params = Array.isArray(raw.supported_parameters)
      ? (raw.supported_parameters as unknown[])
      : [];
    models.push({
      id: raw.id,
      name: typeof raw.name === "string" && raw.name ? raw.name : raw.id,
      contextLength:
        typeof raw.context_length === "number" ? raw.context_length : 0,
      promptPerMillion: perMillion(raw.pricing?.prompt),
      completionPerMillion: perMillion(raw.pricing?.completion),
      supportsTools: params.includes("tools"),
      featured: featuredRank.has(raw.id),
    });
  }

  models.sort((a, b) => {
    const ra = featuredRank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const rb = featuredRank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });
  return models;
}

/** Fetch and parse the public catalog. Throws on HTTP errors. */
export async function fetchOpenRouterModels(
  fetchImpl: typeof fetch = fetch,
): Promise<OpenRouterModel[]> {
  const res = await fetchImpl(OPENROUTER_MODELS_URL, {
    headers: { Accept: "application/json" },
    // Next.js fetch cache: catalog changes rarely.
    next: { revalidate: 3600 },
  } as RequestInit);
  if (!res.ok) {
    throw new Error(`OpenRouter models request failed: ${res.status}`);
  }
  return parseOpenRouterModels(await res.json());
}
