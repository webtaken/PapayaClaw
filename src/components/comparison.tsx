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
    <section className="mx-auto max-w-6xl px-6 py-24 border-t-2 border-border bg-gradient-mesh">
      <h2 className="mb-16 text-center text-4xl font-extrabold uppercase tracking-tight text-white sm:text-5xl">
        Traditional Method vs{" "}
        <span className="text-secondary drop-shadow-[2px_2px_0_rgba(255,87,34,1)]">
          PapayaClaw
        </span>
      </h2>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Traditional Column */}
        <div className="neo-card flex flex-col rounded-none border-2 border-border bg-[#0f1014] p-8 neo-shadow transition-transform hover:-translate-y-1">
          <h3 className="mb-8 text-2xl font-bold uppercase text-zinc-500">
            Traditional
          </h3>
          <div className="space-y-3">
            {traditionalSteps.map((step, i) => (
              <div
                key={i}
                className="flex items-center justify-between border-b-2 border-border py-4"
              >
                <span className="text-base font-medium text-zinc-400">
                  {step.label}
                </span>
                <span className="ml-4 whitespace-nowrap text-base font-bold text-zinc-500">
                  {step.time}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-8 flex items-center justify-between bg-zinc-900 px-4 py-3 border-2 border-zinc-800">
            <span className="text-lg font-bold uppercase text-zinc-500">
              Total
            </span>
            <span className="text-xl font-black text-zinc-500">60 min</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-zinc-500">
            If you&apos;re non-technical, multiply these times by 10 — you have
            to learn each step before doing.
          </p>
        </div>

        {/* PapayaClaw Column */}
        <div className="neo-card flex flex-col justify-center rounded-none border-2 border-primary bg-[#ff5722]/5 p-8 neo-shadow-lime transition-transform hover:-translate-y-1">
          <h3 className="mb-8 text-2xl font-bold uppercase text-white drop-shadow-[2px_2px_0_rgba(255,87,34,1)]">
            PapayaClaw
          </h3>
          <div className="animate-float mb-8 flex items-center gap-4">
            <span className="text-5xl font-black tracking-tighter text-secondary [-webkit-text-stroke:2px_#000] drop-shadow-[4px_4px_0_rgba(255,87,34,1)]">
              FEW
            </span>
            <span className="text-3xl font-bold uppercase text-primary">
              mins
            </span>
          </div>
          <p className="mb-10 text-lg font-medium leading-relaxed text-zinc-300 border-l-4 border-secondary pl-4">
            Pick a model, connect Telegram, deploy — spinning up your secure
            instance in a few minutes.
          </p>
          <div className="w-full space-y-3">
            {[
              "Servers, SSH and OpenClaw Environment are already set up",
              "Waiting to get assigned",
              "Simple, secure and fast connection to your bot",
            ].map((benefit, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b-2 border-primary/30 py-4 last:border-0"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-none border-2 border-secondary bg-secondary text-black font-bold">
                  ✓
                </div>
                <span className="text-base font-bold text-white">
                  {benefit}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
