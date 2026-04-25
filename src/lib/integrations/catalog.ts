export const TOOLKIT_SLUGS = [
  "gmail",
  "googlecalendar",
  "googledrive",
  "googlesheets",
  "notion",
  "linear",
  "slack",
  "github",
] as const;

export type ToolkitSlug = (typeof TOOLKIT_SLUGS)[number];

export interface CatalogEntry {
  slug: ToolkitSlug;
  labelKey: string;
  descriptionKey: string;
  iconId: string;
}

export const CATALOG: readonly CatalogEntry[] = [
  {
    slug: "gmail",
    labelKey: "Integrations.services.gmail.label",
    descriptionKey: "Integrations.services.gmail.description",
    iconId: "gmail",
  },
  {
    slug: "googlecalendar",
    labelKey: "Integrations.services.googlecalendar.label",
    descriptionKey: "Integrations.services.googlecalendar.description",
    iconId: "google-calendar",
  },
  {
    slug: "googledrive",
    labelKey: "Integrations.services.googledrive.label",
    descriptionKey: "Integrations.services.googledrive.description",
    iconId: "google-drive",
  },
  {
    slug: "googlesheets",
    labelKey: "Integrations.services.googlesheets.label",
    descriptionKey: "Integrations.services.googlesheets.description",
    iconId: "google-sheets",
  },
  {
    slug: "notion",
    labelKey: "Integrations.services.notion.label",
    descriptionKey: "Integrations.services.notion.description",
    iconId: "notion",
  },
  {
    slug: "linear",
    labelKey: "Integrations.services.linear.label",
    descriptionKey: "Integrations.services.linear.description",
    iconId: "linear",
  },
  {
    slug: "slack",
    labelKey: "Integrations.services.slack.label",
    descriptionKey: "Integrations.services.slack.description",
    iconId: "slack",
  },
  {
    slug: "github",
    labelKey: "Integrations.services.github.label",
    descriptionKey: "Integrations.services.github.description",
    iconId: "github",
  },
] as const;

export function getCatalogEntry(slug: string): CatalogEntry | undefined {
  return CATALOG.find((e) => e.slug === slug);
}

export function isToolkitSlug(slug: string): slug is ToolkitSlug {
  return (TOOLKIT_SLUGS as readonly string[]).includes(slug);
}
