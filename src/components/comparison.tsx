const traditionalSteps = [
  { label: "Purchasing local virtual machine", time: "15 min" },
  { label: "Creating SSH keys and storing securely", time: "10 min" },
  { label: "Connecting to the server via SSH", time: "5 min" },
  { label: "Installing Node.js and NPM", time: "5 min" },
  { label: "Installing OpenClaw", time: "7 min" },
  { label: "Setting up OpenClaw", time: "10 min" },
  { label: "Connecting to AI provider", time: "4 min" },
  { label: "Pairing with Telegram", time: "4 min" },
];

export function Comparison() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <h2 className="mb-12 text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        Traditional Method vs{" "}
        <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
          PapayaClaw
        </span>
      </h2>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Traditional Column */}
        <div className="card-glow rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h3 className="mb-6 text-lg font-semibold text-red-400">
            Traditional
          </h3>
          <div className="space-y-3">
            {traditionalSteps.map((step, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-zinc-800/50 bg-zinc-800/30 px-4 py-2.5 transition-colors hover:bg-zinc-800/60"
              >
                <span className="text-sm text-zinc-300">{step.label}</span>
                <span className="ml-4 whitespace-nowrap text-sm font-medium text-red-400/80">
                  {step.time}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-zinc-800 pt-4">
            <span className="text-sm font-medium text-zinc-400">Total</span>
            <span className="text-lg font-bold text-red-400">60 min</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-zinc-500">
            If you&apos;re non-technical, multiply these times by 10 — you have
            to learn each step before doing.
          </p>
        </div>

        {/* PapayaClaw Column */}
        <div className="card-glow flex flex-col items-center justify-center rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-blue-500/5 p-6">
          <h3 className="mb-6 text-lg font-semibold text-violet-400">
            PapayaClaw
          </h3>
          <div className="animate-float mb-6 flex items-center gap-3">
            <span className="text-6xl font-bold tracking-tight text-white sm:text-7xl">
              &lt;1
            </span>
            <span className="text-2xl font-semibold text-zinc-400 sm:text-3xl">
              min
            </span>
          </div>
          <p className="mb-8 max-w-sm text-center text-sm leading-relaxed text-zinc-400">
            Pick a model, connect Telegram, deploy — done under 1 minute.
          </p>
          <div className="w-full space-y-3">
            {[
              "Servers, SSH and OpenClaw Environment are already set up",
              "Waiting to get assigned",
              "Simple, secure and fast connection to your bot",
            ].map((benefit, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg bg-zinc-800/30 px-4 py-2.5"
              >
                <span className="text-green-400">✓</span>
                <span className="text-sm text-zinc-300">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
