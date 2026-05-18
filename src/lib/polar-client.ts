import { Polar } from "@polar-sh/sdk";

let cached: Polar | null = null;

export function getPolarClient(): Polar {
  if (cached) return cached;
  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("POLAR_ACCESS_TOKEN is not set");
  }
  cached = new Polar({
    accessToken,
    server:
      (process.env.POLAR_SERVER as "sandbox" | "production" | undefined) ||
      "sandbox",
  });
  return cached;
}
