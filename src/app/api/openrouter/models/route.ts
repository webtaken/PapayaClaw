import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSessionContext } from "@/lib/auth-context";
import {
  fetchOpenRouterModels,
  type OpenRouterModel,
} from "@/lib/openrouter-models";

/**
 * GET /api/openrouter/models
 *
 * Public OpenRouter catalog, shaped for the model picker. Cached in-process
 * for an hour so the wizard never waits on OpenRouter for repeat opens.
 */
const CACHE_TTL_MS = 60 * 60 * 1000;
let cache: { at: number; models: OpenRouterModel[] } | null = null;

export async function GET() {
  const ctx = await getSessionContext(await headers());
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json({ models: cache.models, cached: true });
  }

  try {
    const models = await fetchOpenRouterModels();
    cache = { at: Date.now(), models };
    return NextResponse.json({ models, cached: false });
  } catch (err) {
    console.error("[openrouter/models] fetch failed:", err);
    // Serve stale data rather than nothing.
    if (cache) {
      return NextResponse.json({ models: cache.models, cached: true, stale: true });
    }
    return NextResponse.json(
      { error: "Could not load the OpenRouter model list" },
      { status: 502 },
    );
  }
}
