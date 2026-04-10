const templates = [
  { emoji: "💬", label: "Support" },
  { emoji: "💻", label: "Code Rev" },
  { emoji: "📊", label: "Analyst" },
  { emoji: "✍️", label: "Writer" },
  { emoji: "✈️", label: "Travel" },
  { emoji: "📚", label: "Tutor" },
];

export function StepMarketplace() {
  return (
    <div
      aria-hidden="true"
      tabIndex={-1}
      className="pointer-events-none select-none flex items-center justify-center h-full w-full p-6"
    >
      <div className="w-full max-w-xs rounded-xl border border-border bg-card shadow-sm p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Templates</span>
          <div className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1">
            <svg className="h-3 w-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-xs text-muted-foreground">Search</span>
          </div>
        </div>

        {/* Grid of template cards */}
        <div className="grid grid-cols-3 gap-2">
          {templates.map((tpl, i) => (
            <div
              key={i}
              className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 ${
                i === 0
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background"
              }`}
            >
              <span className="text-lg leading-none">{tpl.emoji}</span>
              <span className="text-[10px] font-medium text-muted-foreground text-center leading-tight">
                {tpl.label}
              </span>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground/60 text-center">
          20+ ready-to-deploy templates
        </p>
      </div>
    </div>
  );
}
