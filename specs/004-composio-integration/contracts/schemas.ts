/**
 * Contract: Composio Integration Layer — Zod schemas (spec artifact, not yet wired to runtime).
 * Lives in the spec folder; implementation imports/adapts these into the route handlers.
 *
 * NOTE: Keep this file free of runtime side effects — it is a contract reference.
 */

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*                              Curated catalog                                */
/* -------------------------------------------------------------------------- */

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

export const ToolkitSlug = z.enum(TOOLKIT_SLUGS);
export type ToolkitSlug = z.infer<typeof ToolkitSlug>;

export const CatalogEntry = z.object({
  slug: ToolkitSlug,
  labelKey: z.string(),
  descriptionKey: z.string(),
  iconId: z.string(),
});

export const CatalogResponse = z.object({
  services: z.array(CatalogEntry).length(8),
});

/* -------------------------------------------------------------------------- */
/*                             Connection lifecycle                            */
/* -------------------------------------------------------------------------- */

export const ConnectionStatus = z.enum([
  "pending",
  "connected",
  "reconnect_required",
  "expired",
  "revoked",
]);
export type ConnectionStatus = z.infer<typeof ConnectionStatus>;

export const ConnectRequest = z.object({
  toolkitSlug: ToolkitSlug,
});

export const ConnectResponse = z.object({
  connectionId: z.string().uuid(),
  redirectUrl: z.string().url(),
});

export const CallbackQuery = z.object({
  state: z.string().min(32),
  composioConnectedAccountId: z.string().min(1),
  status: z.string().optional(),
});

export const ConnectionDto = z.object({
  id: z.string().uuid(),
  toolkitSlug: ToolkitSlug,
  accountLabel: z.string().nullable(),
  status: ConnectionStatus,
  lastHealthCheckAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const ConnectionsResponse = z.object({
  connections: z.array(ConnectionDto),
});

export const ReconnectRequest = z.object({}).strict();

export const ReconnectResponse = z.object({
  redirectUrl: z.string().url(),
});

/* -------------------------------------------------------------------------- */
/*                         Per-instance binding surface                        */
/* -------------------------------------------------------------------------- */

export const AvailableConnectionSummary = z.object({
  id: z.string().uuid(),
  accountLabel: z.string().nullable(),
  status: ConnectionStatus,
});

export const InstanceBindingDto = z.object({
  toolkitSlug: ToolkitSlug,
  enabled: z.boolean(),
  selectedConnectionId: z.string().uuid().nullable(),
  availableConnections: z.array(AvailableConnectionSummary),
});

export const InstanceBindingsResponse = z.object({
  bindings: z.array(InstanceBindingDto).length(8),
});

export const InstanceBindingUpdate = z
  .object({
    enabled: z.boolean(),
    selectedConnectionId: z.string().uuid().nullable(),
  })
  .strict();

/* -------------------------------------------------------------------------- */
/*                                Activity panel                               */
/* -------------------------------------------------------------------------- */

export const InvocationOutcome = z.enum([
  "success",
  "provider_error",
  "auth_denied",
  "connection_unhealthy",
  "not_enabled",
]);
export type InvocationOutcome = z.infer<typeof InvocationOutcome>;

export const InvocationDto = z.object({
  toolkitSlug: ToolkitSlug,
  actionSlug: z.string(),
  outcome: InvocationOutcome,
  errorClass: z.string().nullable(),
  latencyMs: z.number().int().nonnegative().nullable(),
  occurredAt: z.string().datetime(),
});

export const ActivityResponse = z.object({
  invocations: z.array(InvocationDto).max(50),
});

/* -------------------------------------------------------------------------- */
/*                             Bot-facing runtime API                          */
/* -------------------------------------------------------------------------- */

export const ManifestToolDto = z.object({
  actionSlug: z.string(),
  toolkitSlug: ToolkitSlug,
  name: z.string(),
  description: z.string(),
  parameters: z.unknown(), // JSON Schema — not re-validated here
});

export const ManifestResponse = z.object({
  tools: z.array(ManifestToolDto),
});

export const InvokeRequest = z.object({
  actionSlug: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()),
});

export const InvokeResponse = z.object({
  outcome: InvocationOutcome,
  result: z.unknown().optional(),
});

/* -------------------------------------------------------------------------- */
/*                              Error envelope                                 */
/* -------------------------------------------------------------------------- */

export const ErrorCode = z.enum([
  "INVALID_TOOLKIT",
  "CONNECTION_NOT_FOUND",
  "NO_CONNECTED_ACCOUNT",
  "AMBIGUOUS_ACCOUNT",
  "SELECTED_CONNECTION_NOT_OWNED",
  "NOT_ENABLED",
  "CONNECTION_UNHEALTHY",
  "PROVIDER_ERROR",
  "UPSTREAM_UNAVAILABLE",
  "INTEGRATION_UNAVAILABLE",
]);

export const ErrorBody = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
  }),
});
