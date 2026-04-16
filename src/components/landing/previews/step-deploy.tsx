export function StepDeploy() {
  const steps = [
    { label: "Provisioning server", width: "w-full", done: true },
    { label: "Installing agent", width: "w-3/4", done: true },
    { label: "Connecting channel", width: "w-1/3", done: false },
    { label: "Going live", width: "w-0", done: false },
  ];

  return (
    <div
      aria-hidden="true"
      tabIndex={-1}
      className="pointer-events-none select-none flex items-center justify-center h-full w-full p-6"
    >
      <div className="w-full max-w-xs rounded-xl border border-border bg-card shadow-sm p-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Deploying...</p>
            <p className="text-xs text-muted-foreground">Estimated ~30 seconds</p>
          </div>
        </div>

        {/* Progress steps */}
        <div className="flex flex-col gap-3">
          {steps.map((step, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${step.done ? "text-foreground" : "text-muted-foreground/50"}`}>
                  {step.label}
                </span>
                {step.done && (
                  <svg className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${step.done ? "bg-primary" : "bg-primary/30"} ${step.width}`}
                />
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground/60 text-center">
          Your AI employee will be online shortly
        </p>
      </div>
    </div>
  );
}
