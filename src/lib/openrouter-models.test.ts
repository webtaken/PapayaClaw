import { describe, it, expect, vi } from "vitest";
import {
  parseOpenRouterModels,
  fetchOpenRouterModels,
  FEATURED_OPENROUTER_MODEL_IDS,
} from "./openrouter-models";

const apiPayload = {
  data: [
    {
      id: "anthropic/claude-haiku-4.5",
      name: "Anthropic: Claude Haiku 4.5",
      context_length: 200000,
      pricing: { prompt: "0.000001", completion: "0.000005" },
      supported_parameters: ["tools", "max_tokens"],
    },
    {
      id: "anthropic/claude-haiku-4.5:batch",
      name: "Anthropic: Claude Haiku 4.5 (batch)",
      context_length: 200000,
      pricing: { prompt: "0.0000005", completion: "0.0000025" },
      supported_parameters: ["tools"],
    },
    {
      id: "stealth/union-alpha",
      name: "Union Alpha",
      context_length: 262144,
      pricing: { prompt: "0", completion: "0" },
      supported_parameters: ["max_tokens"],
    },
    {
      id: "minimax/minimax-m3",
      name: "MiniMax: MiniMax M3",
      context_length: 1000000,
      pricing: { prompt: "0.0000003", completion: "0.0000012" },
      supported_parameters: ["tools"],
    },
  ],
};

describe("parseOpenRouterModels", () => {
  const models = parseOpenRouterModels(apiPayload);

  it("drops :batch variants", () => {
    expect(models.map((m) => m.id)).not.toContain(
      "anthropic/claude-haiku-4.5:batch",
    );
  });

  it("maps pricing to USD per million tokens and flags tool support", () => {
    const haiku = models.find((m) => m.id === "anthropic/claude-haiku-4.5");
    expect(haiku).toEqual({
      id: "anthropic/claude-haiku-4.5",
      name: "Anthropic: Claude Haiku 4.5",
      contextLength: 200000,
      promptPerMillion: 1,
      completionPerMillion: 5,
      supportsTools: true,
      featured: true,
    });
  });

  it("marks non-featured models", () => {
    const union = models.find((m) => m.id === "stealth/union-alpha");
    expect(union?.featured).toBe(false);
    expect(union?.supportsTools).toBe(false);
  });

  it("orders featured models first, in curated order", () => {
    const ids = models.map((m) => m.id);
    const featuredInPayload = FEATURED_OPENROUTER_MODEL_IDS.filter((id) =>
      ids.includes(id),
    );
    expect(ids.slice(0, featuredInPayload.length)).toEqual(featuredInPayload);
  });

  it("returns an empty list for a malformed payload", () => {
    expect(parseOpenRouterModels({ nope: true })).toEqual([]);
  });
});

describe("fetchOpenRouterModels", () => {
  it("fetches the public catalog without an API key", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(apiPayload), { status: 200 }),
    );
    const models = await fetchOpenRouterModels(fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/models",
      expect.objectContaining({ headers: expect.not.objectContaining({ Authorization: expect.anything() }) }),
    );
    expect(models.length).toBe(3);
  });

  it("throws on a non-2xx response", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 503 }));
    await expect(
      fetchOpenRouterModels(fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow(/503/);
  });
});
