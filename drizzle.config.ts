import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// In production (Railway), DATABASE_URL is injected as a real env var.
// Locally, load from .env.development.local.
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: ".env.development.local" });
}

export default defineConfig({
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
