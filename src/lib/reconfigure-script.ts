/**
 * Builds the bash script that reconfigures the AI provider/model on a VPS.
 *
 * Safety: the API key and model are shipped base64-encoded and expanded into
 * shell variables; `"$KEY"` inside double quotes is never re-parsed by bash,
 * so no user-controlled bytes reach the parser. Distinct exit codes let the
 * route map "config invalid" (409) apart from other CLI failures (500).
 * No `set -e`: every step has an explicit `|| exit N` or `|| { ...; exit N; }`.
 *
 * `restore()` rolls back BOTH the config backup and the `.env` file (when the
 * provider is an env-var/"skip" provider) — the `.env` write happens before
 * `openclaw onboard` runs and must be undone on any later failure, not just
 * the config patch.
 */
import { OPENCLAW_ENV } from "./gateway-health";

export const RECONFIGURE_EXIT = {
  /** Pre-existing config is invalid; nothing was touched. */
  configInvalidBefore: 42,
  onboardFailed: 43,
  patchFailed: 44,
  /** Config invalid after patch; restored from backup. */
  configInvalidAfter: 45,
  envWriteFailed: 46,
} as const;

const CFG = "/root/.openclaw/openclaw.json";
const ENV_FILE = "/root/.openclaw/.env";
// Under /run (tmpfs, root-only), not /tmp (world-writable) — a non-root
// process cannot pre-plant a symlink here for root's `2>` redirect to follow.
const VALIDATE_ERR = "/run/oc-validate.err";
const SKIP_FLAGS =
  "--skip-channels --skip-skills --skip-daemon --skip-ui --skip-search --skip-health";

const KNOWN_ENV_VARS: Record<string, string> = {
  groq: "GROQ_API_KEY",
  nvidia: "NVIDIA_API_KEY",
};

export function envVarNameFor(providerId: string): string {
  const name =
    KNOWN_ENV_VARS[providerId] ??
    `${providerId.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}_API_KEY`;
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe env var name derived from provider "${providerId}"`);
  }
  return name;
}

export interface ReconfigureInput {
  provider: { id: string; authChoice: string; apiKeyFlag?: string };
  primaryModel: string;
  apiKey: string;
}

const b64 = (value: string) => Buffer.from(value, "utf8").toString("base64");

/** Steps for env-var/"skip" providers (Groq, NVIDIA): back up `.env`, rewrite
 * the one key line without `sed`, then onboard with `--auth-choice skip`. */
function skipOnboardSteps(
  provider: { id: string },
  fail: (code: number) => string,
): string[] {
  const envVarName = envVarNameFor(provider.id);
  return [
    // Nothing has been mutated yet at this point (only openclaw.json.bak
    // exists) — if `cp` itself fails partway (e.g. ENOSPC), drop the
    // truncated .env.bak before calling restore(), so restore() never mv's
    // a corrupt backup over the still-intact live .env.
    `if [ -f ${ENV_FILE} ]; then cp ${ENV_FILE} ${ENV_FILE}.bak || { rm -f ${ENV_FILE}.bak; restore; exit ${RECONFIGURE_EXIT.envWriteFailed}; }; else : > ${ENV_FILE}.absent; fi`,
    `umask 077`,
    `{ grep -v "^${envVarName}=" ${ENV_FILE} 2>/dev/null; printf '%s=%s\\n' "${envVarName}" "$KEY"; } > ${ENV_FILE}.tmp || ${fail(RECONFIGURE_EXIT.envWriteFailed)}`,
    `mv ${ENV_FILE}.tmp ${ENV_FILE} || ${fail(RECONFIGURE_EXIT.envWriteFailed)}`,
    `chmod 600 ${ENV_FILE} || ${fail(RECONFIGURE_EXIT.envWriteFailed)}`,
    `openclaw onboard --non-interactive --accept-risk --auth-choice skip ${SKIP_FLAGS} || ${fail(RECONFIGURE_EXIT.onboardFailed)}`,
  ];
}

export function buildReconfigureScript(input: ReconfigureInput): string {
  const { provider } = input;

  if (/[\x00-\x1f\x7f]/.test(input.apiKey)) {
    throw new Error("API key contains control characters");
  }
  if (provider.authChoice !== "skip" && !provider.apiKeyFlag) {
    throw new Error(
      `Provider "${provider.id}" cannot be reconfigured with an API key`,
    );
  }

  const fail = (code: number) => `{ restore; exit ${code}; }`;

  const onboard: string[] =
    provider.authChoice === "skip"
      ? skipOnboardSteps(provider, fail)
      : [
          `openclaw onboard --non-interactive --accept-risk --auth-choice "${provider.authChoice}" ${provider.apiKeyFlag} "$KEY" ${SKIP_FLAGS} || ${fail(RECONFIGURE_EXIT.onboardFailed)}`,
        ];

  return [
    OPENCLAW_ENV,
    `KEY=$(echo '${b64(input.apiKey)}' | base64 -d)`,
    `MODEL=$(echo '${b64(input.primaryModel)}' | base64 -d)`,
    `openclaw config validate >/dev/null 2>${VALIDATE_ERR} || { cat ${VALIDATE_ERR} >&2; exit ${RECONFIGURE_EXIT.configInvalidBefore}; }`,
    `cp ${CFG} ${CFG}.bak || exit ${RECONFIGURE_EXIT.patchFailed}`,
    // Drop any stale markers a previous killed run left behind — otherwise
    // restore() below could act on backups it didn't create itself, e.g.
    // `rm -f`-ing a live .env because of a leftover .env.absent marker on a
    // run that never touched .env at all (the non-skip path).
    `rm -f ${ENV_FILE}.bak ${ENV_FILE}.absent`,
    `restore() { mv -f ${CFG}.bak ${CFG}; if [ -f ${ENV_FILE}.bak ]; then mv -f ${ENV_FILE}.bak ${ENV_FILE}; elif [ -f ${ENV_FILE}.absent ]; then rm -f ${ENV_FILE} ${ENV_FILE}.absent; fi; }`,
    ...onboard,
    `jq --arg model "$MODEL" '.agents.defaults.model.primary = $model' ${CFG} > /run/oc.json || ${fail(RECONFIGURE_EXIT.patchFailed)}`,
    `mv /run/oc.json ${CFG} || ${fail(RECONFIGURE_EXIT.patchFailed)}`,
    `openclaw config validate >/dev/null 2>${VALIDATE_ERR} || { cat ${VALIDATE_ERR} >&2; restore; exit ${RECONFIGURE_EXIT.configInvalidAfter}; }`,
    `rm -f ${CFG}.bak ${ENV_FILE}.bak ${ENV_FILE}.absent ${VALIDATE_ERR}`,
    `echo RECONFIGURED`,
  ].join("\n");
}
