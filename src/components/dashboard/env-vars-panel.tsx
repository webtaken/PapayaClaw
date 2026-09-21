"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ClipboardPaste,
  Copy,
  Eye,
  EyeOff,
  FileKey2,
  Loader2,
  Plus,
  RefreshCw,
  RotateCw,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { apiErrorMessage, type ApiErrorBody } from "@/lib/api-errors";
import {
  ENV_LIMITS,
  mergeEnvVars,
  parseEnvFile,
  validateEnvVars,
  type EnvIssue,
  type EnvVar,
  type EnvValidationError,
} from "@/lib/env-file";
import type { GatewayHealth, HealthReason } from "@/lib/gateway-health";

interface EnvResponse extends Partial<ApiErrorBody> {
  vars?: EnvVar[];
  skippedLines?: number;
}

interface SaveResponse extends Partial<ApiErrorBody> {
  success?: boolean;
  vars?: EnvVar[];
  health?: GatewayHealth;
  healthReason?: HealthReason | null;
}

interface Row {
  id: string;
  key: string;
  value: string;
  revealed: boolean;
}

// Module-level counter: stable React keys without crypto.randomUUID (which
// is unavailable on non-secure origins).
let rowSeq = 0;
const newRowId = () => `env-row-${++rowSeq}`;

const toRows = (vars: EnvVar[]): Row[] =>
  vars.map((v) => ({ id: newRowId(), key: v.key, value: v.value, revealed: false }));

const toVars = (rows: Row[]): EnvVar[] =>
  rows.map(({ key, value }) => ({ key, value }));

const sameVars = (a: EnvVar[], b: EnvVar[]) =>
  a.length === b.length &&
  a.every((v, i) => v.key === b[i].key && v.value === b[i].value);

const PROVIDER_KEY_RE = /_API_KEY$/;

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/* -------------------------------------------------------------------------- */
/* Small pieces                                                                */
/* -------------------------------------------------------------------------- */

function ToolbarButton({
  icon,
  label,
  onClick,
  disabled,
  spinning,
  emphasis,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  spinning?: boolean;
  emphasis?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 font-mono text-[11px] uppercase tracking-wider transition-colors disabled:opacity-50",
        emphasis
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
          : "border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span className={cn("[&>svg]:h-3.5 [&>svg]:w-3.5", spinning && "animate-spin")}>
        {icon}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function EnvRow({
  row,
  issue,
  autoFocus,
  onChange,
  onRemove,
  onEnter,
  labels,
}: {
  row: Row;
  issue: EnvIssue | undefined;
  autoFocus: boolean;
  onChange: (patch: Partial<Row>) => void;
  onRemove: () => void;
  onEnter: () => void;
  labels: {
    keyPlaceholder: string;
    valuePlaceholder: string;
    reveal: string;
    hide: string;
    copy: string;
    copied: string;
    copyFailed: string;
    remove: string;
    issue: string | null;
  };
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(id);
  }, [copied]);

  const copyValue = async () => {
    try {
      await navigator.clipboard.writeText(row.value);
      setCopied(true);
    } catch {
      toast.error(labels.copyFailed);
    }
  };

  return (
    <li
      className={cn(
        "group/row grid grid-cols-1 gap-2 px-4 py-2.5 transition-colors sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)_2rem] sm:items-start",
        issue ? "bg-destructive/[0.04]" : "hover:bg-muted/30",
      )}
    >
      <div className="flex flex-col gap-1">
        <Input
          value={row.key}
          onChange={(e) => onChange({ key: e.target.value })}
          placeholder={labels.keyPlaceholder}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={issue ? true : undefined}
          aria-label={labels.keyPlaceholder}
          className="h-8 border-border/70 bg-background/60 font-mono text-xs text-emerald-300/90 placeholder:text-muted-foreground/40 placeholder:normal-case"
        />
        {issue && labels.issue ? (
          <p className="flex items-center gap-1 font-mono text-[11px] text-destructive">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {labels.issue}
          </p>
        ) : null}
      </div>

      <InputGroup className="h-8 border-border/70 bg-background/60">
        <InputGroupInput
          type={row.revealed ? "text" : "password"}
          value={row.value}
          onChange={(e) => onChange({ value: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onEnter();
            }
          }}
          placeholder={labels.valuePlaceholder}
          autoComplete="off"
          spellCheck={false}
          aria-label={labels.valuePlaceholder}
          className="h-8 font-mono text-xs placeholder:text-muted-foreground/40"
        />
        <InputGroupAddon align="inline-end" className="gap-0.5">
          <InputGroupButton
            size="icon-xs"
            onClick={() => onChange({ revealed: !row.revealed })}
            aria-label={row.revealed ? labels.hide : labels.reveal}
            title={row.revealed ? labels.hide : labels.reveal}
            aria-pressed={row.revealed}
          >
            {row.revealed ? <EyeOff /> : <Eye />}
          </InputGroupButton>
          <InputGroupButton
            size="icon-xs"
            onClick={copyValue}
            disabled={row.value === ""}
            aria-label={copied ? labels.copied : labels.copy}
            title={copied ? labels.copied : labels.copy}
            className={cn(copied && "text-emerald-400")}
          >
            {copied ? <Check /> : <Copy />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        aria-label={labels.remove}
        title={labels.remove}
        className="justify-self-end text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive sm:justify-self-auto"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Panel                                                                       */
/* -------------------------------------------------------------------------- */

export function EnvVarsPanel({ instanceId }: { instanceId: string }) {
  const t = useTranslations("InstanceDetail");
  const te = useTranslations("InstanceDetail.ssh.env");

  const { data, error, isLoading, isValidating, mutate } = useSWR<EnvResponse>(
    `/api/instances/${instanceId}/env`,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  const [draft, setDraft] = useState<Row[]>([]);
  const [synced, setSynced] = useState<EnvResponse | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [focusRowId, setFocusRowId] = useState<string | null>(null);
  const [serverIssues, setServerIssues] = useState<EnvValidationError[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");

  // Re-seed the draft whenever a fresh server snapshot arrives. Revalidation
  // only happens on explicit Refresh (disabled while dirty) or after a save,
  // so this never clobbers in-progress edits.
  if (data && data.vars && data !== synced) {
    setSynced(data);
    setDraft(toRows(data.vars));
    setServerIssues([]);
  }

  const savedVars = data?.vars ?? [];
  const vars = toVars(draft);
  const dirty = !sameVars(vars, savedVars);
  const issues = serverIssues.length > 0 ? serverIssues : validateEnvVars(vars);
  const rowIssues = new Map<number, EnvIssue>();
  let fileIssue: EnvIssue | null = null;
  for (const issue of issues) {
    if (issue.index < 0) fileIssue = issue.issue;
    else rowIssues.set(issue.index, issue.issue);
  }
  const canSave = dirty && issues.length === 0 && !saving;
  const removedProviderKeys = savedVars
    .filter((v) => PROVIDER_KEY_RE.test(v.key) && !draft.some((r) => r.key === v.key))
    .map((v) => v.key);

  const updateDraft = (next: Row[]) => {
    setDraft(next);
    setServerIssues([]);
  };

  const addRow = () => {
    if (draft.length >= ENV_LIMITS.maxVars) return;
    const row: Row = { id: newRowId(), key: "", value: "", revealed: true };
    updateDraft([...draft, row]);
    setFocusRowId(row.id);
  };

  const patchRow = (id: string, patch: Partial<Row>) =>
    updateDraft(draft.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const removeRow = (id: string) => updateDraft(draft.filter((r) => r.id !== id));

  const discard = () => {
    updateDraft(toRows(savedVars));
    setFocusRowId(null);
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/instances/${instanceId}/env`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vars }),
      });
      const body = (await res.json().catch(() => ({}))) as SaveResponse;

      if (!res.ok) {
        if (body.code === "invalid_env" && body.issues) setServerIssues(body.issues);
        toast.error(apiErrorMessage(t, body, "ssh.env.saveFailed"));
        // The file may have changed even when the restart failed.
        if (body.code !== "invalid_env") await mutate();
        return;
      }

      const next: EnvResponse = { vars: body.vars ?? vars, skippedLines: 0 };
      await mutate(next, { revalidate: false });
      if (body.health === "healthy") {
        toast.success(te("savedTitle"), { description: te("savedDescription") });
      } else {
        const reasonKey = body.healthReason ?? "gateway-unreachable";
        toast.warning(te("savedTitle"), {
          description: te("savedDegraded", { reason: t(`healthReason.${reasonKey}`) }),
        });
      }
    } catch {
      toast.error(t("errors.network"));
    } finally {
      setSaving(false);
    }
  };

  // Import preview is derived from the textarea on every render.
  const importParsed = parseEnvFile(importText);
  const importMerge = mergeEnvVars(vars, importParsed.vars);
  const importHasChanges = importMerge.added + importMerge.updated > 0;

  const confirmImport = () => {
    const byKey = new Map(draft.map((r) => [r.key, r] as const));
    const next: Row[] = importMerge.vars.map((v) => {
      const existing = byKey.get(v.key);
      return existing
        ? { ...existing, value: v.value }
        : { id: newRowId(), key: v.key, value: v.value, revealed: false };
    });
    updateDraft(next);
    setImportText("");
    setImportOpen(false);
  };

  const fetchError = error || data?.error;
  const issueLabel = (issue: EnvIssue | undefined) =>
    issue ? te(`issues.${issue}`) : null;

  /* ---------------------------------------------------------------------- */

  return (
    <section
      aria-label={te("title")}
      className="flex flex-col rounded-xl border border-border bg-card shadow-2xl"
    >
      {/* Header bar — same chrome as the terminal card below it */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/50 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-xs font-mono font-semibold uppercase tracking-wide text-foreground/80">
            {te("title")}
          </span>
          {data?.vars ? (
            <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
              {te("count", { count: savedVars.length })}
            </span>
          ) : null}
          {dirty ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-amber-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
              </span>
              {te("unsaved")}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <ToolbarButton
            icon={<RefreshCw />}
            label={te("refresh")}
            onClick={() => mutate()}
            disabled={dirty || saving || isValidating}
            spinning={isValidating}
          />
          <ToolbarButton
            icon={<ClipboardPaste />}
            label={te("import")}
            onClick={() => setImportOpen(true)}
            disabled={isLoading || !!fetchError || saving}
          />
        </div>
      </div>

      {/* Path + restart notice */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/60 px-4 py-2 font-mono text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <FileKey2 className="h-3 w-3 text-emerald-400/80" />
          <span className="text-foreground/70">/root/.openclaw/.env</span>
        </span>
        <span className="hidden text-border sm:inline">·</span>
        <span>{te("restartNotice")}</span>
      </div>

      {/* Body */}
      {isLoading && !data ? (
        <ul aria-busy="true" aria-label={te("loadingAria")} className="divide-y divide-border/60">
          {[0, 1, 2].map((i) => (
            <li key={i} className="grid grid-cols-1 gap-2 px-4 py-2.5 sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)_2rem]">
              <div className="h-8 animate-pulse rounded-md bg-muted/50" />
              <div className="h-8 animate-pulse rounded-md bg-muted/50" />
            </li>
          ))}
        </ul>
      ) : fetchError ? (
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <AlertCircle className="h-6 w-6 text-destructive/70" />
          <p className="max-w-sm font-mono text-xs text-muted-foreground">
            {apiErrorMessage(t, data, "ssh.env.loadFailed")}
          </p>
          <ToolbarButton
            icon={<RefreshCw />}
            label={te("retry")}
            onClick={() => mutate()}
            spinning={isValidating}
            disabled={isValidating}
          />
        </div>
      ) : (
        <>
          {/* Warnings */}
          {(data?.skippedLines ?? 0) > 0 || removedProviderKeys.length > 0 ? (
            <div className="flex flex-col gap-1 border-b border-amber-500/20 bg-amber-500/[0.06] px-4 py-2 font-mono text-[11px] text-amber-300/90">
              {(data?.skippedLines ?? 0) > 0 ? (
                <p className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {te("skippedLines", { count: data?.skippedLines ?? 0 })}
                </p>
              ) : null}
              {removedProviderKeys.length > 0 ? (
                <p className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {te("providerKeyRemoved", { keys: removedProviderKeys.join(", ") })}
                </p>
              ) : null}
            </div>
          ) : null}

          {draft.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border/80 bg-muted/50">
                <FileKey2 className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground/80">
                {te("empty")}
              </p>
              <p className="mt-1 max-w-xs font-mono text-xs leading-relaxed text-muted-foreground">
                {te("emptyHint")}
              </p>
              <div className="mt-5 flex items-center gap-2">
                <ToolbarButton icon={<Plus />} label={te("addVariable")} onClick={addRow} emphasis />
                <ToolbarButton
                  icon={<ClipboardPaste />}
                  label={te("import")}
                  onClick={() => setImportOpen(true)}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="hidden grid-cols-[minmax(0,5fr)_minmax(0,7fr)_2rem] gap-2 px-4 pt-2.5 pb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 sm:grid">
                <span>{te("keyColumn")}</span>
                <span>{te("valueColumn")}</span>
                <span />
              </div>
              <ul className="divide-y divide-border/60">
                {draft.map((row, index) => (
                  <EnvRow
                    key={row.id}
                    row={row}
                    issue={rowIssues.get(index)}
                    autoFocus={row.id === focusRowId}
                    onChange={(patch) => patchRow(row.id, patch)}
                    onRemove={() => removeRow(row.id)}
                    onEnter={addRow}
                    labels={{
                      keyPlaceholder: te("keyPlaceholder"),
                      valuePlaceholder: te("valuePlaceholder"),
                      reveal: te("reveal"),
                      hide: te("hide"),
                      copy: te("copy"),
                      copied: te("copied"),
                      copyFailed: te("copyFailed"),
                      remove: te("remove"),
                      issue: issueLabel(rowIssues.get(index)),
                    }}
                  />
                ))}
              </ul>
              <div className="border-t border-border/60 px-4 py-2.5">
                <ToolbarButton
                  icon={<Plus />}
                  label={te("addVariable")}
                  onClick={addRow}
                  disabled={draft.length >= ENV_LIMITS.maxVars}
                />
              </div>
            </>
          )}

          {/* Footer — only when there is something to save */}
          {dirty ? (
            <div className="flex flex-col gap-3 border-t border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p
                className={cn(
                  "font-mono text-[11px]",
                  issues.length > 0 ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {fileIssue
                  ? te(`issues.${fileIssue}`)
                  : issues.length > 0
                    ? te("issueCount", { count: issues.length })
                    : te("restartNotice")}
              </p>
              <div className="flex items-center gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={discard}
                  disabled={saving}
                  className="font-mono text-xs uppercase tracking-wider text-muted-foreground"
                >
                  {te("discard")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={save}
                  disabled={!canSave}
                  className="gap-2 border border-emerald-500/40 bg-emerald-500/15 font-mono text-xs uppercase tracking-wider text-emerald-300 shadow-none hover:bg-emerald-500/25 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCw className="h-3.5 w-3.5" />
                  )}
                  {saving ? te("saving") : te("save")}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* Import dialog */}
      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open) setImportText("");
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm uppercase tracking-wider">
              {te("importTitle")}
            </DialogTitle>
            <DialogDescription>{te("importDescription")}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={te("importPlaceholder")}
            rows={10}
            autoComplete="off"
            spellCheck={false}
            aria-label={te("importTitle")}
            className="min-h-40 resize-y font-mono text-xs"
          />
          <p
            className={cn(
              "font-mono text-[11px]",
              importText.trim() === ""
                ? "text-muted-foreground/60"
                : importHasChanges
                  ? "text-emerald-400"
                  : "text-muted-foreground",
            )}
            aria-live="polite"
          >
            {importText.trim() === ""
              ? te("importEmpty")
              : [
                  te("importPreview", {
                    added: importMerge.added,
                    updated: importMerge.updated,
                  }),
                  importMerge.skippedReserved > 0
                    ? te("importSkippedReserved", { count: importMerge.skippedReserved })
                    : null,
                  importParsed.skippedLines > 0
                    ? te("importSkippedLines", { count: importParsed.skippedLines })
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setImportOpen(false)}
              className="font-mono text-xs uppercase tracking-wider"
            >
              {te("cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={confirmImport}
              disabled={!importHasChanges}
              className="font-mono text-xs uppercase tracking-wider"
            >
              {te("importConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
