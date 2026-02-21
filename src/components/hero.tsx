export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background glow effect */}
      <div className="hero-glow pointer-events-none absolute inset-0" />

      <div className="relative mx-auto max-w-4xl px-6 pb-8 pt-20 text-center">
        <h1 className="animate-fade-in-up text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl">
          Deploy OpenClaw under{" "}
          <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
            1 minute
          </span>
        </h1>
        <p className="animate-fade-in-up-delay-1 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
          Avoid all technical complexity and one-click deploy your own 24/7
          active OpenClaw instance under 1 minute.
        </p>
      </div>
    </section>
  );
}
