import { Composio } from "@composio/core";

let _composio: Composio | null = null;

export function getComposio(): Composio {
  if (!_composio) {
    if (!process.env.COMPOSIO_API_KEY) {
      throw new Error("COMPOSIO_API_KEY is not set");
    }
    _composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
  }
  return _composio;
}

if (process.env.NODE_ENV === "development") {
  const CURATED_SLUGS = [
    "gmail",
    "googlecalendar",
    "googledrive",
    "googlesheets",
    "notion",
    "linear",
    "slack",
    "github",
  ] as const;

  void (async () => {
    try {
      const composio = getComposio();
      await Promise.all(
        CURATED_SLUGS.map((slug) => composio.toolkits.get(slug)),
      );
    } catch (err) {
      console.error(
        "[composio] Startup self-test failed — one or more curated slugs are invalid:",
        err,
      );
    }
  })();
}
