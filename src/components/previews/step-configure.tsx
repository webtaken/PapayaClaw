export function StepConfigure() {
  return (
    <div
      aria-hidden="true"
      tabIndex={-1}
      className="pointer-events-none select-none flex items-center justify-center h-full w-full p-6"
    >
      <div className="w-full max-w-xs rounded-xl border border-border bg-card shadow-sm p-6 flex flex-col gap-5">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Configure your AI Employee
          </span>
        </div>

        {/* Provider selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">AI Provider</label>
          <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Anthropic Claude</span>
            </div>
            <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Channel selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Channel</label>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 rounded-md border-2 border-primary bg-primary/5 px-3 py-2">
              <div className="h-3 w-3 rounded-full border-2 border-primary bg-primary" />
              <span className="text-xs font-medium text-foreground">Telegram</span>
            </div>
            <div className="flex-1 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
              <div className="h-3 w-3 rounded-full border-2 border-border" />
              <span className="text-xs font-medium text-muted-foreground">WhatsApp</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-md bg-foreground px-4 py-2.5 text-center">
          <span className="text-sm font-semibold text-background">Continue</span>
        </div>
      </div>
    </div>
  );
}
