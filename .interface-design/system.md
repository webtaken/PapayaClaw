# PapayaClaw dashboard — interface system

Extracted from the instance detail screen (2026-09-17). Apply to all dashboard / instance UI.

## Direction

Ops console. The customer is checking "is my agent alive?" and fixing it in one click.
Feels like a quiet telemetry panel, not a marketing card: monospace labels, terminal-style
provisioning log, status dots that glow. Craft whispers; nothing shouts.

## Depth: borders only

- Cards: `rounded-xl border border-border bg-card shadow-2xl` (the shadow is the one lift; no stacked shadows).
- Card header strip: `border-b border-border bg-muted/50 px-4 py-2.5|3`.
- Telemetry band: cells separated by `gap-px bg-muted/50`, each cell `bg-card p-4`. Never draw cell borders.
- No gradients, no colored surfaces. Hue stays constant; only lightness shifts.

## Typography

- Section / card titles and status text: `text-xs font-mono font-semibold uppercase tracking-wide|widest`.
- Telemetry cell label: `text-xs uppercase tracking-widest text-muted-foreground font-semibold`.
- Telemetry cell value: `font-mono text-sm text-foreground/90`.
- Reason / helper text: `text-xs text-muted-foreground`; raw machine detail (sentinels, codes) in `font-mono text-muted-foreground/60` inside `[brackets]`.

## Spacing

Base 4px. Cell padding 16 (`p-4`), card body 24 (`p-6`), section gap 24 (`gap-6`), inline gap 8–12.

## Status color semantics (shared by badge, telemetry dots, card indicators)

| Meaning | Color | Dot |
|---|---|---|
| Live / healthy | emerald-400/500 | solid + glow `shadow-[0_0_8px_rgba(52,211,153,0.5)]` |
| Fault (degraded, VM on but agent broken) | amber-400 | **solid** + glow — a fault is a state, not a transition |
| In transition (deploying, starting, stopping) | amber / blue / violet | `animate-pulse`, no glow for zinc |
| Inert (stopped, off) | zinc-400/500 | solid, no glow |
| Unknown (cannot observe) | zinc-400 | `animate-pulse` |
| Error (setup failed) | red-500 | solid + glow |

Rule: pulse = "still changing", solid = "settled". Never pulse a fault.

## Patterns

**Status badge** (header, `Badge variant="outline"`):
`gap-1.5 rounded-md px-2.5 py-1 text-xs font-mono uppercase tracking-wider border-<c>-500/30 bg-<c>-500/10 text-<c>-400` + `h-1.5 w-1.5 rounded-full` dot. Wrap in `flex flex-col items-end gap-1` and put the reason line under it, right-aligned. Labels always via i18n `InstanceDetail.status.*`.

**Card header indicator** (right side of header strip): `h-1.5 w-1.5 rounded-full <dot>` + `text-xs font-mono font-medium uppercase tracking-widest <text>`; `title` carries the long reason.

**Telemetry cell with state**: label + `flex items-center gap-2 font-mono text-sm` value, dot first (`shrink-0`). Value is the raw machine word (`running`, `off`), not a translation — it is a debugging readout.

**Primary action button**: `bg-foreground text-background hover:bg-foreground/90 h-11 px-6 shadow-none gap-2 font-mono text-xs uppercase tracking-wider`.
**Secondary action**: same size and type, `variant="outline"`. Swap the icon for `Loader2 animate-spin` and the label for its `…ing` form while in flight; disable, never hide.

**Feedback**: Sonner toasts from the click handler only (never from effects). success / warning-with-reason / error with server `detail` appended after `: `.

## Two signals, two indicators

Independent truths get independent UI. VM power state (Hetzner) and agent health (gateway probe)
are never merged into one badge: header badge = agent health, telemetry cell = server state.
